const mongoose = require("mongoose");
const User = require("../models/user");
const { getIO } = require("../socket");

/**
 * Broadcast user profile updates to all connected sockets
 */
function notifyProfileUpdated(user) {
  try {
    const io = getIO();
    if (io) {
      io.emit("user:profile-updated", {
        user,
      });
    }
  } catch (socketErr) {
    console.error("Socket emit on user profile update failed:", socketErr);
  }
}

const searchUsers = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query || query.length < 2) {
      return res.status(400).json({
        message: "Search query must contain at least 2 characters",
      });
    }

    // Escape special regex characters in the search input
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
      _id: { $ne: req.user.userId },
      $or: [
        { username: { $regex: escapedQuery, $options: "i" } },
        { email: { $regex: escapedQuery, $options: "i" } },
      ],
    })
      .select("_id username email profilePhoto bio createdAt")
      .limit(20);

    return res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Search users error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Get user profile error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { username, bio, profilePhoto } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (username && username.trim() !== user.username) {
      const trimmedName = username.trim();
      if (trimmedName.length < 2) {
        return res.status(400).json({
          message: "Username must be at least 2 characters",
        });
      }

      const existing = await User.findOne({
        username: { $regex: new RegExp(`^${trimmedName}$`, "i") },
        _id: { $ne: userId },
      });

      if (existing) {
        return res.status(409).json({
          message: "Username is already taken",
        });
      }

      user.username = trimmedName;
    }

    if (bio !== undefined) {
      user.bio = typeof bio === "string" ? bio.trim().slice(0, 250) : "";
    }

    if (profilePhoto !== undefined) {
      user.profilePhoto = typeof profilePhoto === "string" ? profilePhoto : "";
    }

    await user.save();

    // Convert saved document to object without password to avoid redundant DB query
    const sanitized = user.toObject();
    delete sanitized.password;

    notifyProfileUpdated(sanitized);

    return res.status(200).json({
      message: "Profile updated successfully",
      user: sanitized,
    });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No image file uploaded",
      });
    }

    const userId = req.user.userId;
    const photoUrl = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: photoUrl },
      { new: true }
    ).select("-password");

    notifyProfileUpdated(user);

    return res.status(200).json({
      message: "Profile photo uploaded successfully",
      profilePhoto: photoUrl,
      user,
    });
  } catch (error) {
    console.error("Upload avatar error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

const removeAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findByIdAndUpdate(
      userId,
      { profilePhoto: "" },
      { new: true }
    ).select("-password");

    notifyProfileUpdated(user);

    return res.status(200).json({
      message: "Profile photo removed",
      user,
    });
  } catch (error) {
    console.error("Remove avatar error:", error.message);
    return res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  searchUsers,
  getUserProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
};