const http = require("http");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Server } = require("socket.io");

dotenv.config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");
const socketAuth = require("./middleware/socketAuth");
const {
  setIO,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUserIds,
} = require("./socket");

const app = express();

app.use(cors());
app.use(express.json());

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.get("/", (req, res) => {
  res.json({ message: "KNOT server is running" });
});

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

setIO(io);
io.use(socketAuth);


io.on("connection", (socket) => {
  const userId = String(socket.userId);

  socket.join(userId);
  addOnlineUser(userId);

  // Send the current online list to this newly connected client.
  socket.emit("online-users", getOnlineUserIds());

  console.log(`User ${userId} connected`);

  socket.on("disconnect", () => {
    removeOnlineUser(userId);
    console.log(`User ${userId} disconnected`);
  });
});


server.listen(PORT, () => {
  console.log(`KNOT server running on port ${PORT}`);
});