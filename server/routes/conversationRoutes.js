const express = require("express");
const {
  getConversations,
  getRequests,
  acceptConversation,
  declineConversation,
} = require("../controllers/conversationController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/", getConversations);
router.get("/requests", getRequests);
router.patch("/:userId/accept", acceptConversation);
router.post("/:userId/decline", declineConversation);

module.exports = router;
