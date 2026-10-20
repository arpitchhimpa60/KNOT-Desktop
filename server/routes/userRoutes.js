const express = require("express");

const {
  searchUsers,
  getUserProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { handleFileUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authMiddleware);

router.get("/search", searchUsers);
router.get("/profile/:userId", getUserProfile);
router.put("/profile", updateProfile);
router.post("/avatar", handleFileUpload, uploadAvatar);
router.delete("/avatar", removeAvatar);

module.exports = router;