import { io } from "socket.io-client";
import { socketIoUrl } from "./config";

const JOIN_EVENT = { org: "join:dashboard", status: "join:status" };

/**
 * Socket.IO (Node server). Room membership lives on the server connection, so the room
 * is joined again on every (re)connect; joining only once left a reconnected client in
 * no room, silently receiving nothing.
 */
export const connectSocketIo = ({ room, onEvent, onStatus }) => {
  const socket = io(socketIoUrl(), {
    transports: ["websocket", "polling"],
    withCredentials: true,
  });

  socket.on("connect", () => {
    socket.emit(JOIN_EVENT[room.type], room.id);
    onStatus("live");
  });
  socket.on("disconnect", () => onStatus("reconnecting"));
  socket.on("connect_error", () => onStatus("reconnecting"));
  socket.onAny((event, data) => onEvent(event, data));

  onStatus("connecting");
  return () => {
    socket.offAny();
    socket.removeAllListeners();
    socket.disconnect();
  };
};
