
const express = require("express");

const {
  sendMessage,
  getChatHistory,
  markMessageDelivered,
  markMessagesRead,
} = require("../controllers/messageController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.post("/", sendMessage);
router.patch("/read", markMessagesRead);
router.patch("/:messageId/delivered", markMessageDelivered);
router.get("/:userId", getChatHistory);

module.exports = router;
