const express = require("express");
const {
  createGroup,
  getGroups,
  getGroupById,
  addMembers,
  removeMember,
  leaveGroup,
  updateGroup,
  deleteGroup,
  promoteAdmin,
  demoteAdmin,
  sendGroupMessage,
  uploadAndSendGroupMessage,
  getGroupMessages,
  editGroupMessage,
  deleteGroupMessage,
  downloadGroupAttachment,
  viewGroupAttachment,
} = require("../controllers/groupController");

const authMiddleware = require("../middleware/authMiddleware");
const { handleFileUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

// Public/query-authenticated inline view (for img tags)
router.get("/:groupId/messages/:messageId/view", viewGroupAttachment);

router.use(authMiddleware);

// Create and retrieve groups
router.post("/", createGroup);
router.get("/", getGroups);
router.get("/:groupId", getGroupById);

// Membership management
router.post("/:groupId/members", addMembers);
router.delete("/:groupId/members/:userId", removeMember);
router.delete("/:groupId/leave", leaveGroup);

// Group administration
router.patch("/:groupId", updateGroup);
router.delete("/:groupId", deleteGroup);

// Admin role management
router.post("/:groupId/admins", promoteAdmin);
router.delete("/:groupId/admins/:userId", demoteAdmin);

// Group messages
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/messages", sendGroupMessage);
router.post("/:groupId/messages/upload", handleFileUpload, uploadAndSendGroupMessage);
router.get("/:groupId/messages/:messageId/attachment", downloadGroupAttachment);
router.patch("/:groupId/messages/:messageId", editGroupMessage);
router.delete("/:groupId/messages/:messageId", deleteGroupMessage);

module.exports = router;
