
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const socketAuth = require("./middleware/socketAuth");
const Message = require("./models/Messages");
const Group = require("./models/Group");

let io = null;

// Track active socket connections per user (userId -> connection count)
const onlineUsers = new Map();

/**
 * Deliver pending messages sent while the user was offline.
 * Marks them as "delivered" and notifies the original senders.
 */
async function deliverPendingMessages(userId) {
  try {
    const pendingMessages = await Message.find({
      recipient: userId,
      status: "sent",
    });

    for (const message of pendingMessages) {
      message.status = "delivered";
      await message.save();

      io.to(String(message.sender)).emit("message-status", {
        messageId: String(message._id),
        status: "delivered",
      });
    }
  } catch (error) {
    console.error("Pending delivery sync failed:", error);
  }
}

/**
 * Increment active connection count for a user.
 * Emits "presence-update" with isOnline: true on the first connection.
 */
function addOnlineUser(userId) {
  const count = onlineUsers.get(userId) || 0;
  onlineUsers.set(userId, count + 1);

  if (count === 0 && io) {
    io.emit("presence-update", {
      userId,
      isOnline: true,
    });
  }
}

/**
 * Decrement active connection count for a user.
 * Emits "presence-update" with isOnline: false when all connections close.
 */
function removeOnlineUser(userId) {
  const count = onlineUsers.get(userId) || 0;

  if (count <= 1) {
    onlineUsers.delete(userId);

    if (io) {
      io.emit("presence-update", {
        userId,
        isOnline: false,
      });
    }
  } else {
    onlineUsers.set(userId, count - 1);
  }
}

/**
 * Return array of currently online user IDs
 */
function getOnlineUserIds() {
  return Array.from(onlineUsers.keys());
}

/**
 * Set an existing Socket.IO instance (for backwards compatibility)
 */
function setIO(socketServer) {
  io = socketServer;
}

/**
 * Get the initialized Socket.IO instance for controllers to broadcast events
 */
function getIO() {
  if (!io) {
    throw new Error("Socket.IO has not been initialized");
  }
  return io;
}

/**
 * Initialize Socket.IO on the HTTP server and register all real-time events
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ["GET", "POST"],
    },
  });

  // Authenticate socket connections using JWT
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const userId = String(socket.userId);

    // 1. Join personal room (for 1-on-1 direct messages & notifications)
    socket.join(userId);

    // 2. Mark user online & send current online list
    addOnlineUser(userId);
    socket.emit("online-users", getOnlineUserIds());

    // 3. Deliver pending messages sent while offline
    deliverPendingMessages(userId);

    console.log(`User ${userId} connected`);

    // 4. Auto-join all authorized group rooms on connect / reconnect
    Group.find({ members: userId })
      .select("_id")
      .then((userGroups) => {
        for (const grp of userGroups) {
          socket.join(`group:${grp._id}`);
        }
      })
      .catch((err) => {
        console.error("Error restoring group rooms:", err);
      });

    // 5. Direct Message Typing Indicator
    socket.on("typing", ({ recipientId, isTyping }) => {
      if (!recipientId || recipientId === userId) return;

      io.to(String(recipientId)).emit("typing-update", {
        userId,
        isTyping: Boolean(isTyping),
      });
    });

    // 6. Explicitly join a group room (with membership authorization check)
    socket.on("group:join", async ({ groupId } = {}) => {
      try {
        if (!groupId || !mongoose.isValidObjectId(groupId)) return;
        const isMember = await Group.exists({ _id: groupId, members: userId });
        if (isMember) {
          socket.join(`group:${groupId}`);
        }
      } catch (error) {
        console.error("group:join error:", error);
      }
    });

    // 7. Leave a group room
    socket.on("group:leave", ({ groupId } = {}) => {
      if (groupId) {
        socket.leave(`group:${groupId}`);
      }
    });

    // 8. Group Typing Indicator (broadcast to other members in room)
    socket.on("group:typing", async ({ groupId, isTyping } = {}) => {
      try {
        if (!groupId || !mongoose.isValidObjectId(groupId)) return;
        const isMember = await Group.exists({ _id: groupId, members: userId });
        if (!isMember) return;

        socket.to(`group:${groupId}`).emit("group:typing:update", {
          groupId: String(groupId),
          userId,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        console.error("group:typing error:", error);
      }
    });

    // 9. Handle Disconnect
    socket.on("disconnect", () => {
      removeOnlineUser(userId);
      console.log(`User ${userId} disconnected`);
    });
  });

  return io;
}

module.exports = {
  initSocket,
  setIO,
  getIO,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUserIds,
};
