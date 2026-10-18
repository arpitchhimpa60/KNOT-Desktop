
let io;

const onlineUsers = new Map();

const setIO = (socketServer) => {
  io = socketServer;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }

  return io;
};

const addOnlineUser = (userId) => {
  const count = onlineUsers.get(userId) || 0;
  onlineUsers.set(userId, count + 1);

  // Announce online only for the first active connection.
  if (count === 0) {
    io.emit("presence-update", {
      userId,
      isOnline: true,
    });
  }
};

const removeOnlineUser = (userId) => {
  const count = onlineUsers.get(userId) || 0;

  if (count <= 1) {
    onlineUsers.delete(userId);

    io.emit("presence-update", {
      userId,
      isOnline: false,
    });
  } else {
    onlineUsers.set(userId, count - 1);
  }
};

const getOnlineUserIds = () => Array.from(onlineUsers.keys());

module.exports = {
  setIO,
  getIO,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUserIds,
};
