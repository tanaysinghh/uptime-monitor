import { Client, ReconnectionTimeMode } from "@stomp/stompjs";
import { stompUrl } from "./config";
import { freshAccessToken } from "./token";

const DESTINATION = {
  org: (id) => `/topic/org/${id}`,
  status: (slug) => `/topic/status/${slug}`,
};

/**
 * STOMP over WebSocket (Spring Boot server). Dashboards authenticate the CONNECT frame
 * with the access token, refreshed first if it is about to expire; status pages connect
 * anonymously. Each message's `event` header is the Socket.IO event name and the body
 * is the same JSON, so pages handle both transports identically.
 *
 * Reconnects with exponential backoff (1s doubling to 30s). A dropped connection is
 * detected by 10s heartbeats; each new connection subscribes again.
 */
export const connectStomp = ({ room, onEvent, onStatus }) => {
  let stopped = false;
  let forceRefresh = false;

  const client = new Client({
    brokerURL: stompUrl(),
    connectionTimeout: 10_000,
    reconnectDelay: 1_000,
    reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
    maxReconnectDelay: 30_000,
    heartbeatIncoming: 10_000,
    heartbeatOutgoing: 10_000,
  });

  client.beforeConnect = async () => {
    if (room.type !== "org") return;
    const token = await freshAccessToken({ force: forceRefresh });
    forceRefresh = false;
    if (!token) {
      // No session any more (the refresh failed and the app is leaving for /login).
      stopped = true;
      await client.deactivate();
      return;
    }
    client.connectHeaders = { Authorization: `Bearer ${token}` };
  };

  client.onConnect = () => {
    onStatus("live");
    client.subscribe(DESTINATION[room.type](room.id), (message) => {
      let data;
      try {
        data = JSON.parse(message.body);
      } catch {
        return;
      }
      onEvent(message.headers.event, data);
    });
  };

  client.onStompError = (frame) => {
    // An ERROR answering CONNECT reaches us still STOMP-escaped (":" as "\c").
    const reason = (frame.headers.message || "").replace(/\\c/g, ":");
    if (reason.startsWith("Forbidden")) {
      // Retrying cannot help (wrong organization, bad destination).
      stopped = true;
      client.deactivate();
      onStatus("error");
      return;
    }
    // "Unauthorized: ..." (expired or revoked token): the server closes the socket and
    // the next attempt fetches a new token first.
    if (reason.startsWith("Unauthorized")) forceRefresh = true;
  };

  client.onWebSocketClose = () => {
    if (!stopped) onStatus("reconnecting");
  };

  onStatus("connecting");
  client.activate();
  return () => {
    stopped = true;
    client.deactivate();
  };
};
