
const mongoose = require("mongoose");
const User = require("../models/user");
const Message = require("../models/Messages");
const { getIO } = require("../socket");

// POST /api/messages

const sendMessage = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, text, replyTo } = req.body;

    if (!recipientId || !text?.trim()) {
      return res.status(400).json({
        message: "Recipient and message text are required",
      });
    }

    if (!mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({
        message: "Invalid recipient ID",
      });
    }

    if (String(senderId) === String(recipientId)) {
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

    let originalMessage = null;

    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({
          message: "Invalid reply message ID",
        });
      }

      originalMessage = await Message.findOne({
        _id: replyTo,
        $or: [
          { sender: senderId, recipient: recipientId },
          { sender: recipientId, recipient: senderId },
        ],
      });

      if (!originalMessage) {
        return res.status(404).json({
          message: "Original message not found in this conversation",
        });
      }
    }

    const messageData = {
      sender: senderId,
      recipient: recipientId,
      text: text.trim(),
      status: "sent",
    };

    if (originalMessage) {
      messageData.replyTo = originalMessage._id;
    }

    const message = await Message.create(messageData);

    const io = getIO();

    io.to(String(recipientId)).emit("new-message", message);

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Send message error:", error);

    return res.status(500).json({
      message: "Could not send message",
    });
  }
};


// GET /api/messages/:userId
const getChatHistory = async (req, res) => {
  try {
    const myId = req.user.userId;
    const otherUserId = req.params.userId;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: myId, recipient: otherUserId },
        { sender: otherUserId, recipient: myId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100);

    return res.status(200).json({
      count: messages.length,
      messages,
    });
  } catch (error) {
    console.error("Get chat history error:", error);

    return res.status(500).json({
      message: "Could not load messages",
    });
  }
};

// PATCH /api/messages/:messageId/delivered
const markMessageDelivered = async (req, res) => {
  try {
    const recipientId = req.user.userId;
    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        recipient: recipientId,
        status: "sent",
      },
      {
        $set: { status: "delivered" },
      },
      { new: true }
    );

    // If it was already delivered/read, do not downgrade its status.
    if (!message) {
      const existingMessage = await Message.findOne({
        _id: messageId,
        recipient: recipientId,
      });

      if (!existingMessage) {
        return res.status(404).json({
          message: "Message not found",
        });
      }

      return res.status(200).json({
        message: "Message already acknowledged",
        data: existingMessage,
      });
    }

    getIO().to(String(message.sender)).emit("message-status", {
      messageId: String(message._id),
      status: message.status,
    });

    return res.status(200).json({
      message: "Message marked as delivered",
      data: message,
    });
  } catch (error) {
    console.error("Mark delivered error:", error);

    return res.status(500).json({
      message: "Could not update message status",
    });
  }
};

// PATCH /api/messages/read
const markMessagesRead = async (req, res) => {
  try {
    const recipientId = req.user.userId;
    const { senderId, messageIds } = req.body;

    if (
      !mongoose.isValidObjectId(senderId) ||
      !Array.isArray(messageIds) ||
      messageIds.length === 0 ||
      !messageIds.every((id) => mongoose.isValidObjectId(id))
    ) {
      return res.status(400).json({
        message: "A valid sender ID and message IDs are required",
      });
    }

    const result = await Message.updateMany(
      {
        _id: { $in: messageIds },
        sender: senderId,
        recipient: recipientId,
        status: { $in: ["sent", "delivered"] },
      },
      {
        $set: { status: "read" },
      }
    );

    // Notify the sender so their message bubbles update.
    if (result.modifiedCount > 0) {
      getIO().to(String(senderId)).emit("messages-read", {
        messageIds: messageIds.map(String),
        readerId: String(recipientId),
      });
    }

    return res.status(200).json({
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Mark read error:", error);

    return res.status(500).json({
      message: "Could not mark messages as read",
    });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  markMessageDelivered,
  markMessagesRead,
};
