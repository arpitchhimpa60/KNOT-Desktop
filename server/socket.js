let io;

const setIO = (socketServer) => {
  io = socketServer;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};

module.exports = { setIO, getIO };