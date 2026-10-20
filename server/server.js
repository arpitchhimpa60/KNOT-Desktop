const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const mongoose = require("mongoose");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const groupRoutes = require("./routes/groupRoutes");
const socketAuth = require("./middleware/socketAuth");
const Message = require("./models/Messages");
const Group = require("./models/Group");

const {
  setIO,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUserIds,
} = require("./socket");

const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/groups", groupRoutes);

app.get("/", (req, res) => {
  res.json({ message: "KNOT server is running" });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
  },
});

setIO(io);
io.use(socketAuth);


io.on("connection", (socket) => {
  const userId = String(socket.userId);

  socket.join(userId);
  async function deliverPendingMessages() {
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

deliverPendingMessages();
  addOnlineUser(userId);

  // Send the current online list to this newly connected client.
  socket.emit("online-users", getOnlineUserIds());

  console.log(`User ${userId} connected`);

  socket.on("typing", ({ recipientId, isTyping }) => {
  if (!recipientId || recipientId === userId) return;

  // Notify the intended recipient.
  io.to(String(recipientId)).emit("typing-update", {
    userId,
    isTyping: Boolean(isTyping),
  });
  });

  // Automatically join all authorized group rooms on connect / reconnect
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

  // Client requesting to explicitly join a group room
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

  // Client requesting to leave a group room
  socket.on("group:leave", ({ groupId } = {}) => {
    if (groupId) {
      socket.leave(`group:${groupId}`);
    }
  });

  // Group typing indicator
  socket.on("group:typing", async ({ groupId, isTyping } = {}) => {
    try {
      if (!groupId || !mongoose.isValidObjectId(groupId)) return;
      const isMember = await Group.exists({ _id: groupId, members: userId });
      if (!isMember) return;

      // Broadcast to other authorized group members in room, excluding sender
      socket.to(`group:${groupId}`).emit("group:typing:update", {
        groupId: String(groupId),
        userId,
        isTyping: Boolean(isTyping),
      });
    } catch (error) {
      console.error("group:typing error:", error);
    }
  });

  socket.on("disconnect", () => {
    removeOnlineUser(userId);
    console.log(`User ${userId} disconnected`);
  });
});


server.listen(PORT, "127.0.0.1", () => {
  console.log(`KNOT server running on port ${PORT}`);
});