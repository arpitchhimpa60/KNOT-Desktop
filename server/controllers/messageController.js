const User = require("../models/user");
const Message = require("../models/Messages");
const { getIO } = require("../socket");

const sendMessage = async (req, res) => {
  try {
    const { recipientId, text } = req.body;
    const senderId = req.user.userId;

    if (!recipientId || !text?.trim()) {
      return res.status(400).json({
        message: "Recipient and message text are required",
      });
    }

    if (senderId === recipientId) {
      return res.status(400).json({
        message: "You cannot send a message to yourself",
      });
    }

    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return res.status(404).json({
        message: "Recipient not found",
      });
    }

    const message = await Message.create({
      sender: senderId,
      recipient: recipientId,
      text: text.trim(),
    });

    const io = getIO();
    io.to(recipientId).emit("new-message", message);
    
    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Send message error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid recipient ID",
      });
    }

    return res.status(500).json({
      message: "Server error",
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.userId;

    if (currentUserId === userId) {
      return res.status(400).json({
        message: "Cannot retrieve a chat with yourself",
      });
    }

    const otherUser = await User.findById(userId);

    if (!otherUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: userId },
        { sender: userId, recipient: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100);

    res.status(200).json({
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Get chat history error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    res.status(500).json({
      message: "Server error",
    });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
};