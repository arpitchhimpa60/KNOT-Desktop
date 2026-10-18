const express = require("express");

const {
  sendMessage,
  getChatHistory,
} = require("../controllers/messageController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, sendMessage);

router.get("/:userId", authMiddleware, getChatHistory);

module.exports = router;