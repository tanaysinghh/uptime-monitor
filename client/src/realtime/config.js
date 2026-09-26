// Which real-time transport this build talks to. Build-time, like the API URL:
//   VITE_REALTIME_TRANSPORT=socketio (default)  Socket.IO, the Node server
//   VITE_REALTIME_TRANSPORT=stomp               STOMP over WebSocket, the Spring Boot server
// Switching backends (or rolling back) is an env change plus a rebuild, no code change.
const env = import.meta.env;

export const TRANSPORT = env.VITE_REALTIME_TRANSPORT === "stomp" ? "stomp" : "socketio";

export const socketIoUrl = () => env.VITE_SOCKET_URL || window.location.origin;

// STOMP endpoint: VITE_WS_URL, else /ws next to the API (https://host/api -> wss://host/ws).
export const stompUrl = () => {
  if (env.VITE_WS_URL) return env.VITE_WS_URL;
  const url = new URL(env.VITE_API_URL || "/api", window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = url.pathname.replace(/\/api\/?$/, "") + "/ws";
  url.search = "";
  url.hash = "";
  return url.toString();
};

// Label for the LIVE indicator.
export const liveLabel = (status) =>
  ({
    live: "LIVE",
    connecting: "CONNECTING",
    reconnecting: "RECONNECTING",
    error: "OFFLINE",
  })[status] || "LIVE";
