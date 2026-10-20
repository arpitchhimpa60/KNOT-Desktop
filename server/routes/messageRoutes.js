
const express = require("express");

const {
  sendMessage,
  uploadAndSendMessage,
  getChatHistory,
  markMessageDelivered,
  markMessagesRead,
  editMessage,
  deleteMessage,
  downloadAttachment,
  viewAttachment,
} = require("../controllers/messageController");
const {
  getConversations,
  getRequests,
  acceptConversation,
  declineConversation,
} = require("../controllers/conversationController");

const authMiddleware = require("../middleware/authMiddleware");
const { handleFileUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

// Public/query-authenticated inline view (for img tags)
router.get("/:messageId/view", viewAttachment);

router.use(authMiddleware);

router.get("/conversations", getConversations);
router.get("/conversations/requests", getRequests);
router.patch("/conversations/:userId/accept", acceptConversation);
router.post("/conversations/:userId/decline", declineConversation);

router.post("/upload", handleFileUpload, uploadAndSendMessage);
router.get("/:messageId/attachment", downloadAttachment);

router.post("/", sendMessage);
router.patch("/read", markMessagesRead);
router.patch("/:messageId/delivered", markMessageDelivered);
router.patch("/:messageId", editMessage);
router.delete("/:messageId", deleteMessage);
router.get("/:userId", getChatHistory);

module.exports = router;
