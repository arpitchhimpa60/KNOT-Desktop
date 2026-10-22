const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const conversationRoutes = require("./routes/conversationRoutes");
const groupRoutes = require("./routes/groupRoutes");
const { initSocket } = require("./socket");

const app = express();

// Standard middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Connect to MongoDB
connectDB();

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/groups", groupRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "KNOT server is running" });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.IO real-time server
initSocket(server);

server.listen(PORT, "127.0.0.1", () => {
  console.log(`KNOT server running on port ${PORT}`);
});