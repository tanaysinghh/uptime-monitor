import { useEffect, useRef, useState } from "react";
import { TRANSPORT } from "../realtime/config";
import { connectSocketIo } from "../realtime/socketioTransport";
import { connectStomp } from "../realtime/stompTransport";

/**
 * Live events for one audience, over whichever transport this build uses.
 *
 *   useRealtime({ type: "org", id: organizationId }, { "check:result": fn, ... })
 *   useRealtime({ type: "status", id: slug }, { "incident:update": fn })
 *
 * Handlers are keyed by event name ("monitor:update", "incident:update",
 * "check:result") and may change between renders without reconnecting.
 * Returns the connection state: "idle" | "connecting" | "live" | "reconnecting" | "error".
 */
const useRealtime = (room, handlers) => {
  const handlersRef = useRef(handlers);
  const [status, setStatus] = useState("idle");
  const type = room?.type;
  const id = room?.id;

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    if (!type || !id) return undefined;
    let active = true;
    const connect = TRANSPORT === "stomp" ? connectStomp : connectSocketIo;
    const close = connect({
      room: { type, id },
      onEvent: (event, data) => {
        const fn = handlersRef.current?.[event];
        if (active && typeof fn === "function") fn(data);
      },
      onStatus: (next) => {
        if (!active) return;
        console.debug(`[realtime] ${TRANSPORT} ${type} ${next}`);
        setStatus(next);
      },
    });
    return () => {
      active = false;
      close();
      setStatus("idle");
    };
  }, [type, id]);

  return status;
};

export default useRealtime;
