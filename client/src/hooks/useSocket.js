import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

const useSocket = (roomType, roomId, handlers) => {
  const socketRef = useRef(null);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!roomId) return;

    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    socket.emit(roomType, roomId);

    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomType, roomId]);

  return socketRef.current;
};

export default useSocket;