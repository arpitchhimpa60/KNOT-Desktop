const User = require("../models/user");

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
      .select("_id username email")
      .limit(20);

    res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Search users error:", error.message);

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = { searchUsers };