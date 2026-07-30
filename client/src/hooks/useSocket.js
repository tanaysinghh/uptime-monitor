import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

const useSocket = (roomType, roomId, handlers) => {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!roomId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    socket.emit(roomType, roomId);

    const events = Object.keys(handlersRef.current);
    const dispatchers = {};
    for (const event of events) {
      const dispatch = (...args) => {
        const fn = handlersRef.current[event];
        if (typeof fn === "function") fn(...args);
      };
      dispatchers[event] = dispatch;
      socket.on(event, dispatch);
    }

    return () => {
      for (const event of events) {
        socket.off(event, dispatchers[event]);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomType, roomId]);
};

export default useSocket;