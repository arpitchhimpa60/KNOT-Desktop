
const mongoose = require("mongoose");
const User = require("../models/user");
const { getIO } = require("../socket");
const cloudinary = require("../config/cloudinary");

/**
 * Broadcast user profile updates to all connected sockets.
 */
function notifyProfileUpdated(user) {
  try {
    const io = getIO();

    if (io && user) {
      io.emit("user:profile-updated", { user });
    }
  } catch (socketErr) {
    console.error("Socket emit on user profile update failed:", socketErr);
  }
}

/**
 * Upload an avatar to Cloudinary as a public image.
 * Message and group attachments use a separate private-upload flow.
 */
function uploadAvatarToCloudinary(file) {
  return new Promise((resolve, reject) => {
    if (!file?.buffer) {
      return reject(new Error("No image buffer provided"));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "knot/avatars",
        resource_type: "image",
        type: "upload",
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url) {
          return reject(new Error("Cloudinary returned no image URL"));
        }

        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(file.buffer);
  });
}

const searchUsers = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query || query.length < 2) {
      return res.status(400).json({
        message: "Search query must contain at least 2 characters",
      });
    }

    // Escape special regex characters in the search input.
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

    return res.status(200).json({ user });
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

    // Preserve existing behavior. Restricting this field to server-managed
    // avatar uploads should be handled alongside the frontend profile flow.
    if (profilePhoto !== undefined) {
      user.profilePhoto =
        typeof profilePhoto === "string" ? profilePhoto : "";
    }

    await user.save();

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

    // Do not allow documents or other non-image files as avatars.
    if (!req.file.mimetype?.startsWith("image/")) {
      return res.status(400).json({
        message: "Only image files can be used as profile photos",
      });
    }

    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const uploadedImage = await uploadAvatarToCloudinary(req.file);

    // Store the permanent HTTPS URL, not a Render-local /uploads path.
    user.profilePhoto = uploadedImage.secureUrl;
    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;

    notifyProfileUpdated(sanitized);

    return res.status(200).json({
      message: "Profile photo uploaded successfully",
      profilePhoto: uploadedImage.secureUrl,
      user: sanitized,
    });
  } catch (error) {
    console.error("Upload avatar error:", error.message);

    return res.status(500).json({
      message: "Unable to upload profile photo",
    });
  }
};

const removeAvatar = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    user.profilePhoto = "";
    await user.save();

    const sanitized = user.toObject();
    delete sanitized.password;

    notifyProfileUpdated(sanitized);

    return res.status(200).json({
      message: "Profile photo removed",
      user: sanitized,
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
