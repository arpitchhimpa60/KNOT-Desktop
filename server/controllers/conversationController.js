const mongoose = require("mongoose");
const Message = require("../models/Messages");
const User = require("../models/user");
const { getIO } = require("../socket");

/**
 * Aggregates all direct conversations and conversation requests for a given user.
 *
 * Pipeline Breakdown:
 * 1. $match: Filter all messages where the current user is either the sender or recipient.
 * 2. $sort: Sort messages by newest first.
 * 3. $project: Identify the conversation partner ("otherUserId") and classify message flags.
 * 4. $group: Group by "otherUserId" to pick the latest message, count unread messages, and track sent counts.
 * 5. $lookup: Join with the "users" collection to retrieve the partner's profile information.
 * 6. $unwind: Flatten the joined user array.
 * 7. $project: Format the final shape and determine whether this conversation is an unaccepted "request".
 * 8. $sort: Order the final list by most recent activity.
 */
async function fetchUserConversations(userIdString) {
  const userId = new mongoose.Types.ObjectId(userIdString);

  const pipeline = [
    // 1. Messages involving current user
    {
      $match: {
        $or: [{ sender: userId }, { recipient: userId }],
      },
    },
    // 2. Sort newest first so $first picks the most recent message
    {
      $sort: { createdAt: -1 },
    },
    // 3. Project flags and identify conversation partner
    {
      $project: {
        otherUserId: {
          $cond: [{ $eq: ["$sender", userId] }, "$recipient", "$sender"],
        },
        isSender: { $eq: ["$sender", userId] },
        isRecipient: { $eq: ["$recipient", userId] },
        isUnread: {
          $cond: [
            {
              $and: [
                { $eq: ["$recipient", userId] },
                { $ne: ["$status", "read"] },
              ],
            },
            1,
            0,
          ],
        },
        isReadIncoming: {
          $cond: [
            {
              $and: [
                { $eq: ["$recipient", userId] },
                { $eq: ["$status", "read"] },
              ],
            },
            1,
            0,
          ],
        },
        text: 1,
        status: 1,
        sender: 1,
        recipient: 1,
        createdAt: 1,
        isEdited: 1,
        deleted: 1,
        attachment: 1,
      },
    },
    // 4. Group by conversation partner
    {
      $group: {
        _id: "$otherUserId",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: { $sum: "$isUnread" },
        readIncomingCount: { $sum: "$isReadIncoming" },
        mySentCount: {
          $sum: { $cond: ["$isSender", 1, 0] },
        },
        otherSentCount: {
          $sum: { $cond: ["$isRecipient", 1, 0] },
        },
        latestActivity: { $max: "$createdAt" },
      },
    },
    // 5. Look up conversation partner's user details
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "userInfo",
      },
    },
    // 6. Unwind array of 1 user object
    {
      $unwind: "$userInfo",
    },
    // 7. Format output and evaluate first-contact request status
    {
      $project: {
        _id: 1,
        user: {
          _id: "$userInfo._id",
          username: "$userInfo.username",
          email: "$userInfo.email",
          profilePhoto: "$userInfo.profilePhoto",
          bio: "$userInfo.bio",
        },
        lastMessage: {
          _id: "$lastMessage._id",
          text: "$lastMessage.text",
          sender: "$lastMessage.sender",
          recipient: "$lastMessage.recipient",
          status: "$lastMessage.status",
          createdAt: "$lastMessage.createdAt",
          isEdited: "$lastMessage.isEdited",
          deleted: "$lastMessage.deleted",
          attachment: "$lastMessage.attachment",
        },
        unreadCount: 1,
        mySentCount: 1,
        otherSentCount: 1,
        readIncomingCount: 1,
        isRequest: {
          $and: [
            { $eq: ["$mySentCount", 0] },
            { $eq: ["$readIncomingCount", 0] },
            { $gt: ["$otherSentCount", 0] },
          ],
        },
        latestActivity: 1,
      },
    },
    // 8. Order conversations by recent activity
    {
      $sort: { latestActivity: -1 },
    },
  ];

  const results = await Message.aggregate(pipeline);

  const requests = results.filter((item) => item.isRequest);
  const conversations = results.filter((item) => !item.isRequest);

  return { conversations, requests };
}

// GET /api/conversations or /api/messages/conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { conversations, requests } = await fetchUserConversations(userId);

    return res.status(200).json({
      count: conversations.length,
      requestCount: requests.length,
      conversations,
      requests,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    return res.status(500).json({
      message: "Could not load conversations",
    });
  }
};

// GET /api/conversations/requests or /api/messages/conversations/requests
const getRequests = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requests } = await fetchUserConversations(userId);

    return res.status(200).json({
      count: requests.length,
      requests,
    });
  } catch (error) {
    console.error("Get requests error:", error);
    return res.status(500).json({
      message: "Could not load conversation requests",
    });
  }
};

// PATCH /api/conversations/:userId/accept — accept a first-contact conversation request
const acceptConversation = async (req, res) => {
  try {
    const myId = req.user.userId;
    const otherUserId = req.params.userId;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    // Find all unread messages sent by otherUser to current user
    const unreadMessages = await Message.find({
      sender: otherUserId,
      recipient: myId,
      status: { $in: ["sent", "delivered"] },
    }).select("_id");

    const messageIds = unreadMessages.map((m) => m._id);

    if (messageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { $set: { status: "read" } }
      );

      try {
        const io = getIO();
        const otherStr = String(otherUserId);
        const myStr = String(myId);

        io.to(otherStr).emit("messages-read", {
          messageIds: messageIds.map(String),
          readerId: myStr,
        });

        io.to(otherStr).emit("conversation:updated", { userId: myStr });
        io.to(myStr).emit("conversation:updated", { userId: otherStr });
      } catch (socketErr) {
        console.error("Socket emit on acceptConversation failed:", socketErr);
      }
    }

    return res.status(200).json({
      message: "Conversation accepted successfully",
      userId: otherUserId,
    });
  } catch (error) {
    console.error("Accept conversation error:", error);
    return res.status(500).json({
      message: "Could not accept conversation",
    });
  }
};

// POST /api/conversations/:userId/decline — dismiss a first-contact conversation request
const declineConversation = async (req, res) => {
  try {
    const myId = req.user.userId;
    const otherUserId = req.params.userId;

    if (!mongoose.isValidObjectId(otherUserId)) {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    // Mark unread messages as read so the conversation leaves the request queue
    await Message.updateMany(
      {
        sender: otherUserId,
        recipient: myId,
        status: { $in: ["sent", "delivered"] },
      },
      {
        $set: { status: "read" },
      }
    );

    try {
      const io = getIO();
      io.to(String(myId)).emit("conversation:updated", {
        userId: String(otherUserId),
      });
    } catch (socketErr) {
      console.error("Socket emit on declineConversation failed:", socketErr);
    }

    return res.status(200).json({
      message: "Conversation request dismissed",
      userId: otherUserId,
    });
  } catch (error) {
    console.error("Decline conversation error:", error);
    return res.status(500).json({
      message: "Could not dismiss conversation request",
    });
  }
};

module.exports = {
  fetchUserConversations,
  getConversations,
  getRequests,
  acceptConversation,
  declineConversation,
};
