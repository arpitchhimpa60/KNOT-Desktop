const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/user");
const Message = require("../models/Messages");
const { getIO } = require("../socket");
const { UPLOADS_DIR } = require("../middleware/uploadMiddleware");

/**
 * Helper: Notify recipient and sender via Socket.IO after a new message is saved.
 * Also detects first contact to emit conversation request notifications.
 */
async function notifyNewMessage(senderId, recipientId, message) {
  let io;
  try {
    io = getIO();
  } catch (ioErr) {
    console.error("Socket.IO not initialized for message notification:", ioErr);
    return;
  }

  // 1. Deliver the message to the recipient's personal room
  try {
    io.to(String(recipientId)).emit("new-message", message);
  } catch (emitErr) {
    console.error("Socket emit 'new-message' failed:", emitErr);
  }

  // 2. Update conversation lists in real-time and notify if first-contact request
  try {
    const priorCount = await Message.countDocuments({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
      _id: { $ne: message._id },
    });

    const isFirstContact = priorCount === 0;

    if (isFirstContact) {
      const senderUser = await User.findById(senderId).select("_id username email");
      io.to(String(recipientId)).emit("conversation:request", {
        message,
        sender: senderUser,
      });
    }

    io.to(String(recipientId)).emit("conversation:updated", {
      userId: String(senderId),
      lastMessage: message,
      isFirstContact,
    });

    io.to(String(senderId)).emit("conversation:updated", {
      userId: String(recipientId),
      lastMessage: message,
    });
  } catch (convErr) {
    console.error("Conversation socket notification failed:", convErr);
  }
}

// POST /api/messages — send a direct text message
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

    await notifyNewMessage(senderId, recipientId, message);

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

// GET /api/messages/:userId — retrieve message history between two users
const getChatHistory = async (req, res) => {
  try {
    const myId = req.user.userId;
    const otherUserId = req.params.userId;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    // Common filter matching messages between the two users in either direction
    const conversationFilter = {
      $or: [
        { sender: myId, recipient: otherUserId },
        { sender: otherUserId, recipient: myId },
      ],
    };

    const { targetMessageId } = req.query;
    let messages = null;

    if (targetMessageId && mongoose.isValidObjectId(targetMessageId)) {
      const target = await Message.findOne({
        _id: targetMessageId,
        ...conversationFilter,
      });

      if (target) {
        // Fetch up to 20 messages before the target message
        const beforeMessages = await Message.find({
          ...conversationFilter,
          createdAt: { $lt: target.createdAt },
        })
          .sort({ createdAt: -1 })
          .limit(20);

        // Fetch up to 80 messages from target forward
        const afterMessages = await Message.find({
          ...conversationFilter,
          createdAt: { $gte: target.createdAt },
        })
          .sort({ createdAt: 1 })
          .limit(80);

        messages = [...beforeMessages.reverse(), ...afterMessages];
      }
    }

    if (!messages) {
      messages = await Message.find(conversationFilter)
        .sort({ createdAt: 1 })
        .limit(100);
    }

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

// PATCH /api/messages/:messageId/delivered — mark a single message as delivered
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

    // If it was already delivered or read, do not downgrade status
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

// PATCH /api/messages/read — mark multiple messages as read
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
        status: { $ne: "read" },
      },
      {
        $set: { status: "read" },
      }
    );

    // Notify the sender so their double blue ticks update in real-time
    if (result.modifiedCount > 0) {
      const io = getIO();
      const sId = String(senderId);
      const rId = String(recipientId);

      io.to(sId).emit("messages-read", {
        messageIds: messageIds.map(String),
        readerId: rId,
      });

      io.to(sId).emit("conversation:updated", { userId: rId });
      io.to(rId).emit("conversation:updated", { userId: sId });
      io.to(rId).emit("conversation:read", { userId: sId });
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

// PATCH /api/messages/:messageId — edit an existing message sent by current user
const editMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;
    const { text } = req.body;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        message: "Message text cannot be empty",
      });
    }

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        sender: userId,
        deleted: false,
      },
      {
        $set: {
          text: text.trim(),
          isEdited: true,
        },
      },
      { new: true, runValidators: true }
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found or you cannot edit it",
      });
    }

    const io = getIO();
    const recipientStr = String(message.recipient);
    const senderStr = String(message.sender);

    io.to(recipientStr)
      .to(senderStr)
      .emit("message-edited", {
        messageId: String(message._id),
        text: message.text,
        isEdited: message.isEdited,
        updatedAt: message.updatedAt,
      });

    io.to(recipientStr).emit("conversation:updated", {
      userId: senderStr,
      lastMessage: message,
    });
    io.to(senderStr).emit("conversation:updated", {
      userId: recipientStr,
      lastMessage: message,
    });

    return res.status(200).json({
      message: "Message updated successfully",
      data: message,
    });
  } catch (error) {
    console.error("Edit message error:", error);
    return res.status(500).json({
      message: "Could not edit message",
    });
  }
};

// DELETE /api/messages/:messageId — soft-delete a message sent by current user
const deleteMessage = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid message ID",
      });
    }

    const message = await Message.findOneAndUpdate(
      {
        _id: messageId,
        sender: userId,
        deleted: false,
      },
      {
        $set: {
          text: "This message was deleted",
          deleted: true,
        },
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({
        message: "Message not found or you cannot delete it",
      });
    }

    const io = getIO();
    const recipientStr = String(message.recipient);
    const senderStr = String(message.sender);

    io.to(recipientStr)
      .to(senderStr)
      .emit("message-deleted", {
        messageId: String(message._id),
        text: message.text,
        deleted: message.deleted,
      });

    io.to(recipientStr).emit("conversation:updated", {
      userId: senderStr,
      lastMessage: message,
    });
    io.to(senderStr).emit("conversation:updated", {
      userId: recipientStr,
      lastMessage: message,
    });

    return res.status(200).json({
      message: "Message deleted successfully",
      data: message,
    });
  } catch (error) {
    console.error("Delete message error:", error);
    return res.status(500).json({
      message: "Could not delete message",
    });
  }
};

// POST /api/messages/upload — upload attachment and send direct message
const uploadAndSendMessage = async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, text, replyTo } = req.body;
    const file = req.file;

    if (!file && (!text || !text.trim())) {
      return res.status(400).json({
        message: "A message text or file attachment is required",
      });
    }

    if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({
        message: "Valid recipient ID is required",
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
    if (replyTo && mongoose.isValidObjectId(replyTo)) {
      originalMessage = await Message.findOne({
        _id: replyTo,
        $or: [
          { sender: senderId, recipient: recipientId },
          { sender: recipientId, recipient: senderId },
        ],
      });
    }

    const messageData = {
      sender: senderId,
      recipient: recipientId,
      text: (text || "").trim(),
      status: "sent",
    };

    if (originalMessage) {
      messageData.replyTo = originalMessage._id;
    }

    if (file) {
      messageData.attachment = {
        originalName: file.originalname,
        fileName: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    }

    const message = await Message.create(messageData);

    await notifyNewMessage(senderId, recipientId, message);

    return res.status(201).json({
      message: "Message with attachment sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Upload and send message error:", error);
    return res.status(500).json({
      message: "Could not send message with attachment",
    });
  }
};

// GET /api/messages/:messageId/attachment — authenticated file download
const downloadAttachment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message || !message.attachment || !message.attachment.fileName) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    // Security check: only conversation participants can download
    const isParticipant =
      String(message.sender) === String(userId) ||
      String(message.recipient) === String(userId);

    if (!isParticipant) {
      return res.status(403).json({
        message: "Access denied. You are not a participant in this conversation",
      });
    }

    // Path traversal safety
    const safeName = path.basename(message.attachment.fileName);
    const filePath = path.resolve(UPLOADS_DIR, safeName);

    if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    const downloadName = message.attachment.originalName || safeName;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(downloadName)}"`
    );
    res.setHeader(
      "Content-Type",
      message.attachment.mimeType || "application/octet-stream"
    );

    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Download attachment error:", error);
    return res.status(500).json({ message: "Could not download attachment" });
  }
};

// GET /api/messages/:messageId/view — authenticated inline stream (e.g. for img tags)
const viewAttachment = async (req, res) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const userId = decoded.userId;
    const { messageId } = req.params;

    if (!mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid message ID" });
    }

    const message = await Message.findById(messageId);
    if (!message || !message.attachment || !message.attachment.fileName) {
      return res.status(404).json({ message: "Attachment not found" });
    }

    const isParticipant =
      String(message.sender) === String(userId) ||
      String(message.recipient) === String(userId);

    if (!isParticipant) {
      return res.status(403).json({
        message: "Access denied. You are not a participant in this conversation",
      });
    }

    const safeName = path.basename(message.attachment.fileName);
    const filePath = path.resolve(UPLOADS_DIR, safeName);

    if (!filePath.startsWith(UPLOADS_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ message: "File not found on server" });
    }

    res.setHeader(
      "Content-Type",
      message.attachment.mimeType || "application/octet-stream"
    );
    res.setHeader("Content-Disposition", "inline");

    return fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("View attachment error:", error);
    return res.status(500).json({ message: "Could not view attachment" });
  }
};

module.exports = {
  sendMessage,
  uploadAndSendMessage,
  getChatHistory,
  markMessageDelivered,
  markMessagesRead,
  editMessage,
  deleteMessage,
  downloadAttachment,
  viewAttachment,
};
