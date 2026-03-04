const { Server } = require("socket.io");

let io = null;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join:dashboard", (orgId) => {
      socket.join(`org:${orgId}`);
    });

    socket.on("join:status", (slug) => {
      socket.join(`status:${slug}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

const emitMonitorUpdate = (orgId, data) => {
  if (io) {
    io.to(`org:${orgId}`).emit("monitor:update", data);
  }
};

const emitIncidentUpdate = (orgId, slug, data) => {
  if (io) {
    io.to(`org:${orgId}`).emit("incident:update", data);
    if (slug) {
      io.to(`status:${slug}`).emit("incident:update", data);
    }
  }
};

const emitCheckResult = (orgId, data) => {
  if (io) {
    io.to(`org:${orgId}`).emit("check:result", data);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitMonitorUpdate,
  emitIncidentUpdate,
  emitCheckResult,
};