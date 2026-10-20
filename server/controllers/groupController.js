const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Group = require("../models/Group");
const GroupMessage = require("../models/GroupMessage");
const User = require("../models/user");
const { getIO } = require("../socket");
const { UPLOADS_DIR } = require("../middleware/uploadMiddleware");

// POST /api/groups — create a group
const createGroup = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, description, memberIds } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Group name is required",
      });
    }

    const trimmedName = name.trim();
    if (trimmedName.length > 100) {
      return res.status(400).json({
        message: "Group name cannot exceed 100 characters",
      });
    }

    if (description && (typeof description !== "string" || description.trim().length > 500)) {
      return res.status(400).json({
        message: "Description cannot exceed 500 characters",
      });
    }

    // Always include creator as member and admin
    const memberIdSet = new Set([String(userId)]);

    if (Array.isArray(memberIds)) {
      for (const id of memberIds) {
        if (!mongoose.isValidObjectId(id)) {
          return res.status(400).json({
            message: `Invalid member ID: ${id}`,
          });
        }
        memberIdSet.add(String(id));
      }
    }

    // Verify all referenced members exist in database
    const candidateIds = Array.from(memberIdSet);
    const existingUsers = await User.find({ _id: { $in: candidateIds } }).select("_id username email");

    const validatedMemberIds = existingUsers.map((u) => u._id);

    const group = await Group.create({
      name: trimmedName,
      description: description ? description.trim() : "",
      creator: userId,
      members: validatedMemberIds,
      admins: [userId],
    });

    await group.populate([
      { path: "creator", select: "_id username email" },
      { path: "members", select: "_id username email" },
      { path: "admins", select: "_id username email" },
    ]);

    // Join all connected member sockets to the group room and notify them
    try {
      const io = getIO();
      const groupIdStr = String(group._id);
      for (const member of group.members) {
        const mIdStr = String(member._id);
        io.in(mIdStr).socketsJoin(`group:${groupIdStr}`);
        io.to(mIdStr).emit("group:created", { group });
      }
    } catch (socketErr) {
      console.error("Socket room join on createGroup failed:", socketErr);
    }

    return res.status(201).json({
      message: "Group created successfully",
      group,
    });
  } catch (error) {
    console.error("Create group error:", error);
    return res.status(500).json({
      message: "Could not create group",
    });
  }
};

// GET /api/groups — list groups for authenticated user
const getGroups = async (req, res) => {
  try {
    const userId = req.user.userId;

    const groups = await Group.find({ members: userId })
      .sort({ updatedAt: -1 })
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    // Attach last message for each group
    const groupsWithLastMessage = await Promise.all(
      groups.map(async (group) => {
        const lastMessage = await GroupMessage.findOne({ group: group._id })
          .sort({ createdAt: -1 })
          .populate("sender", "_id username email");

        return {
          ...group.toObject(),
          lastMessage: lastMessage || null,
        };
      })
    );

    return res.status(200).json({
      count: groupsWithLastMessage.length,
      groups: groupsWithLastMessage,
    });
  } catch (error) {
    console.error("Get groups error:", error);
    return res.status(500).json({
      message: "Could not retrieve groups",
    });
  }
};

// GET /api/groups/:groupId — retrieve group details and members
const getGroupById = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId)
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    // Ensure only members can view details
    const isMember = group.members.some((m) => String(m._id) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    return res.status(200).json({
      group,
    });
  } catch (error) {
    console.error("Get group by ID error:", error);
    return res.status(500).json({
      message: "Could not retrieve group details",
    });
  }
};

// POST /api/groups/:groupId/members — add one or more members
const addMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    // Only admin can add members
    const isAdmin = group.admins.some((a) => String(a) === String(userId));
    if (!isAdmin) {
      return res.status(403).json({
        message: "Only group administrators can add members",
      });
    }

    let memberIds = req.body.memberIds;
    if (!memberIds && req.body.memberId) {
      memberIds = [req.body.memberId];
    }

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        message: "Member IDs are required",
      });
    }

    for (const id of memberIds) {
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          message: `Invalid member ID: ${id}`,
        });
      }
    }

    // Verify users exist in database
    const usersToAdd = await User.find({ _id: { $in: memberIds } }).select("_id username email");
    if (usersToAdd.length === 0) {
      return res.status(404).json({
        message: "No valid users found to add",
      });
    }

    // Filter out users who are already members
    const existingMemberSet = new Set(group.members.map((m) => String(m)));
    const newMembers = usersToAdd.filter((u) => !existingMemberSet.has(String(u._id)));

    if (newMembers.length === 0) {
      const populated = await Group.findById(groupId)
        .populate("creator", "_id username email")
        .populate("admins", "_id username email")
        .populate("members", "_id username email");

      return res.status(200).json({
        message: "All specified users are already group members",
        group: populated,
        addedCount: 0,
      });
    }

    for (const u of newMembers) {
      group.members.push(u._id);
    }

    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    // Sockets: join new members to group room and broadcast update
    try {
      const io = getIO();
      const groupIdStr = String(groupId);
      for (const u of newMembers) {
        const uIdStr = String(u._id);
        io.in(uIdStr).socketsJoin(`group:${groupIdStr}`);
        io.to(uIdStr).emit("group:member:added", {
          groupId: groupIdStr,
          newMembers: newMembers.map((m) => ({ _id: m._id, username: m.username, email: m.email })),
          addedBy: userId,
          group: populatedGroup,
        });
      }

      io.to(`group:${groupIdStr}`).emit("group:member:added", {
        groupId: groupIdStr,
        newMembers: newMembers.map((m) => ({ _id: m._id, username: m.username, email: m.email })),
        addedBy: userId,
      });
    } catch (socketErr) {
      console.error("Socket emit on addMembers failed:", socketErr);
    }

    return res.status(200).json({
      message: "Members added successfully",
      group: populatedGroup,
      addedCount: newMembers.length,
      addedMembers: newMembers.map((m) => ({ _id: m._id, username: m.username, email: m.email })),
    });
  } catch (error) {
    console.error("Add members error:", error);
    return res.status(500).json({
      message: "Could not add members",
    });
  }
};

// DELETE /api/groups/:groupId/members/:userId — remove a member
const removeMember = async (req, res) => {
  try {
    const { groupId, userId: targetUserId } = req.params;
    const requesterId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid group ID or user ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    // Only admin can remove members
    const isAdmin = group.admins.some((a) => String(a) === String(requesterId));
    if (!isAdmin) {
      return res.status(403).json({
        message: "Only group administrators can remove members",
      });
    }

    // Verify target user is in group
    const isTargetMember = group.members.some((m) => String(m) === String(targetUserId));
    if (!isTargetMember) {
      return res.status(404).json({
        message: "User is not a member of this group",
      });
    }

    // Creator cannot be removed by other admins
    if (String(targetUserId) === String(group.creator) && String(requesterId) !== String(group.creator)) {
      return res.status(403).json({
        message: "Cannot remove the group creator",
      });
    }

    // User should use /leave to remove themselves
    if (String(targetUserId) === String(requesterId)) {
      return res.status(400).json({
        message: "Use the leave endpoint to leave the group",
      });
    }

    // Cannot remove the only admin
    const isTargetAdmin = group.admins.some((a) => String(a) === String(targetUserId));
    if (isTargetAdmin && group.admins.length === 1) {
      return res.status(400).json({
        message: "Cannot remove the only administrator of the group",
      });
    }

    group.members = group.members.filter((m) => String(m) !== String(targetUserId));
    group.admins = group.admins.filter((a) => String(a) !== String(targetUserId));

    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    // Sockets: remove target from room and broadcast update
    try {
      const io = getIO();
      const groupIdStr = String(groupId);
      io.in(String(targetUserId)).socketsLeave(`group:${groupIdStr}`);

      io.to(`group:${groupIdStr}`).emit("group:member:removed", {
        groupId: groupIdStr,
        removedUserId: String(targetUserId),
        removedBy: requesterId,
      });

      io.to(String(targetUserId)).emit("group:member:removed", {
        groupId: groupIdStr,
        removedUserId: String(targetUserId),
        removedBy: requesterId,
      });
    } catch (socketErr) {
      console.error("Socket emit on removeMember failed:", socketErr);
    }

    return res.status(200).json({
      message: "Member removed successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.error("Remove member error:", error);
    return res.status(500).json({
      message: "Could not remove member",
    });
  }
};

// DELETE /api/groups/:groupId/leave — allow the current user to leave a group
const leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(400).json({
        message: "You are not a member of this group",
      });
    }

    const isUserAdmin = group.admins.some((a) => String(a) === String(userId));

    // Handle sole administrator condition
    if (isUserAdmin && group.admins.length === 1) {
      if (group.members.length === 1) {
        // Last member leaving: delete the group and its messages
        await GroupMessage.deleteMany({ group: groupId });
        await Group.findByIdAndDelete(groupId);

        try {
          const io = getIO();
          io.in(String(userId)).socketsLeave(`group:${groupId}`);
          io.to(`group:${groupId}`).emit("group:deleted", {
            groupId: String(groupId),
            deletedBy: userId,
          });
        } catch (socketErr) {
          console.error("Socket emit on leave-delete failed:", socketErr);
        }

        return res.status(200).json({
          message: "Left and deleted group as the last member",
          groupId,
        });
      } else {
        // Other members exist, but user is the only admin
        return res.status(400).json({
          message: "Cannot leave group as the sole administrator. Please assign another administrator first or delete the group.",
        });
      }
    }

    group.members = group.members.filter((m) => String(m) !== String(userId));
    group.admins = group.admins.filter((a) => String(a) !== String(userId));

    // If creator leaves and other admins remain, transfer creator to the next admin
    if (String(group.creator) === String(userId) && group.admins.length > 0) {
      group.creator = group.admins[0];
    }

    await group.save();

    try {
      const io = getIO();
      const groupIdStr = String(groupId);
      io.in(String(userId)).socketsLeave(`group:${groupIdStr}`);

      io.to(`group:${groupIdStr}`).emit("group:member:removed", {
        groupId: groupIdStr,
        removedUserId: String(userId),
        left: true,
      });
    } catch (socketErr) {
      console.error("Socket emit on leaveGroup failed:", socketErr);
    }

    return res.status(200).json({
      message: "Left group successfully",
      groupId,
    });
  } catch (error) {
    console.error("Leave group error:", error);
    return res.status(500).json({
      message: "Could not leave group",
    });
  }
};

// PATCH /api/groups/:groupId — update group details (name / description)
const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { name, description } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    // Only admin can update group
    const isAdmin = group.admins.some((a) => String(a) === String(userId));
    if (!isAdmin) {
      return res.status(403).json({
        message: "Only group administrators can update group details",
      });
    }

    if (name === undefined && description === undefined) {
      return res.status(400).json({
        message: "At least one field (name or description) is required",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Group name cannot be empty",
        });
      }
      if (name.trim().length > 100) {
        return res.status(400).json({
          message: "Group name cannot exceed 100 characters",
        });
      }
      group.name = name.trim();
    }

    if (description !== undefined) {
      if (typeof description !== "string") {
        return res.status(400).json({
          message: "Invalid description format",
        });
      }
      if (description.trim().length > 500) {
        return res.status(400).json({
          message: "Description cannot exceed 500 characters",
        });
      }
      group.description = description.trim();
    }

    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    try {
      getIO().to(`group:${groupId}`).emit("group:updated", {
        groupId: String(groupId),
        group: populatedGroup,
      });
    } catch (socketErr) {
      console.error("Socket emit on updateGroup failed:", socketErr);
    }

    return res.status(200).json({
      message: "Group updated successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.error("Update group error:", error);
    return res.status(500).json({
      message: "Could not update group",
    });
  }
};

// DELETE /api/groups/:groupId — delete a group
const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    // Only creator or admin can delete
    const isAuthorized =
      String(group.creator) === String(userId) ||
      group.admins.some((a) => String(a) === String(userId));

    if (!isAuthorized) {
      return res.status(403).json({
        message: "Only group administrators or the creator can delete this group",
      });
    }

    // Delete all group messages to avoid orphans
    await GroupMessage.deleteMany({ group: groupId });
    await Group.findByIdAndDelete(groupId);

    try {
      const io = getIO();
      const groupIdStr = String(groupId);
      io.to(`group:${groupIdStr}`).emit("group:deleted", {
        groupId: groupIdStr,
        deletedBy: userId,
      });
      io.socketsLeave(`group:${groupIdStr}`);
    } catch (socketErr) {
      console.error("Socket emit on deleteGroup failed:", socketErr);
    }

    return res.status(200).json({
      message: "Group and its messages deleted successfully",
      groupId,
    });
  } catch (error) {
    console.error("Delete group error:", error);
    return res.status(500).json({
      message: "Could not delete group",
    });
  }
};

// POST /api/groups/:groupId/admins — promote a member to admin
const promoteAdmin = async (req, res) => {
  try {
    const { groupId } = req.params;
    const requesterId = req.user.userId;
    const { userId: targetUserId } = req.body;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid group ID or user ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isRequesterAdmin = group.admins.some((a) => String(a) === String(requesterId));
    if (!isRequesterAdmin) {
      return res.status(403).json({
        message: "Only group administrators can promote members to admin",
      });
    }

    const isTargetMember = group.members.some((m) => String(m) === String(targetUserId));
    if (!isTargetMember) {
      return res.status(400).json({
        message: "User must be a member of the group to be promoted",
      });
    }

    const isAlreadyAdmin = group.admins.some((a) => String(a) === String(targetUserId));
    if (!isAlreadyAdmin) {
      group.admins.push(targetUserId);
      await group.save();
    }

    const populatedGroup = await Group.findById(groupId)
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    try {
      getIO().to(`group:${groupId}`).emit("group:updated", {
        groupId: String(groupId),
        group: populatedGroup,
      });
    } catch (socketErr) {
      console.error("Socket emit on promoteAdmin failed:", socketErr);
    }

    return res.status(200).json({
      message: "Member promoted to administrator successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.error("Promote admin error:", error);
    return res.status(500).json({
      message: "Could not promote member to administrator",
    });
  }
};

// DELETE /api/groups/:groupId/admins/:userId — demote an admin to member
const demoteAdmin = async (req, res) => {
  try {
    const { groupId, userId: targetUserId } = req.params;
    const requesterId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(targetUserId)) {
      return res.status(400).json({
        message: "Invalid group ID or user ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isRequesterAdmin = group.admins.some((a) => String(a) === String(requesterId));
    if (!isRequesterAdmin) {
      return res.status(403).json({
        message: "Only group administrators can demote administrators",
      });
    }

    if (String(targetUserId) === String(group.creator)) {
      return res.status(400).json({
        message: "Cannot demote the group creator",
      });
    }

    if (group.admins.length === 1 && String(group.admins[0]) === String(targetUserId)) {
      return res.status(400).json({
        message: "Cannot demote the sole administrator of the group",
      });
    }

    group.admins = group.admins.filter((a) => String(a) !== String(targetUserId));
    await group.save();

    const populatedGroup = await Group.findById(groupId)
      .populate("creator", "_id username email")
      .populate("admins", "_id username email")
      .populate("members", "_id username email");

    try {
      getIO().to(`group:${groupId}`).emit("group:updated", {
        groupId: String(groupId),
        group: populatedGroup,
      });
    } catch (socketErr) {
      console.error("Socket emit on demoteAdmin failed:", socketErr);
    }

    return res.status(200).json({
      message: "Administrator demoted successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.error("Demote admin error:", error);
    return res.status(500).json({
      message: "Could not demote administrator",
    });
  }
};

// POST /api/groups/:groupId/messages — send a group message
const sendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { text, replyTo } = req.body;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        message: "Message text is required",
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 5000) {
      return res.status(400).json({
        message: "Message text cannot exceed 5000 characters",
      });
    }

    let originalMessage = null;
    if (replyTo) {
      if (!mongoose.isValidObjectId(replyTo)) {
        return res.status(400).json({
          message: "Invalid reply message ID",
        });
      }

      originalMessage = await GroupMessage.findOne({
        _id: replyTo,
        group: groupId,
      });

      if (!originalMessage) {
        return res.status(404).json({
          message: "Original message not found in this group",
        });
      }
    }

    const message = await GroupMessage.create({
      group: groupId,
      sender: userId,
      text: trimmedText,
      replyTo: originalMessage ? originalMessage._id : null,
    });

    // Touch group updatedAt so recent conversations rank higher
    await Group.findByIdAndUpdate(groupId, { updatedAt: new Date() });

    await message.populate([
      { path: "sender", select: "_id username email" },
      {
        path: "replyTo",
        select: "_id text sender deleted isEdited",
        populate: { path: "sender", select: "_id username email" },
      },
    ]);

    try {
      getIO().to(`group:${groupId}`).emit("group:message:new", message);
    } catch (socketErr) {
      console.error("Socket emit on sendGroupMessage failed:", socketErr);
    }

    return res.status(201).json({
      message: "Message sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Send group message error:", error);
    return res.status(500).json({
      message: "Could not send message",
    });
  }
};

// GET /api/groups/:groupId/messages — retrieve paginated group message history
const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const before = req.query.before;
    const targetMessageId = req.query.targetMessageId;

    if (targetMessageId && mongoose.isValidObjectId(targetMessageId)) {
      const targetMsg = await GroupMessage.findOne({
        _id: targetMessageId,
        group: groupId,
      });

      if (targetMsg) {
        const beforeMessages = await GroupMessage.find({
          group: groupId,
          createdAt: { $lt: targetMsg.createdAt },
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .populate("sender", "_id username email")
          .populate({
            path: "replyTo",
            select: "_id text sender deleted isEdited",
            populate: { path: "sender", select: "_id username email" },
          });

        const afterMessages = await GroupMessage.find({
          group: groupId,
          createdAt: { $gte: targetMsg.createdAt },
        })
          .sort({ createdAt: 1 })
          .limit(50)
          .populate("sender", "_id username email")
          .populate({
            path: "replyTo",
            select: "_id text sender deleted isEdited",
            populate: { path: "sender", select: "_id username email" },
          });

        const messages = [...beforeMessages.reverse(), ...afterMessages];

        return res.status(200).json({
          count: messages.length,
          total: messages.length,
          page: 1,
          totalPages: 1,
          hasMore: false,
          messages,
        });
      }
    }

    const filter = { group: groupId };

    if (before) {
      if (mongoose.isValidObjectId(before)) {
        const beforeMsg = await GroupMessage.findById(before);
        if (beforeMsg) {
          filter.createdAt = { $lt: beforeMsg.createdAt };
        }
      } else if (!isNaN(Date.parse(before))) {
        filter.createdAt = { $lt: new Date(before) };
      }
    }

    const totalMessages = await GroupMessage.countDocuments({ group: groupId });
    const skip = (page - 1) * limit;

    const rawMessages = await GroupMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "_id username email")
      .populate({
        path: "replyTo",
        select: "_id text sender deleted isEdited",
        populate: { path: "sender", select: "_id username email" },
      });

    // Chronological ordering for display
    const messages = rawMessages.reverse();

    return res.status(200).json({
      count: messages.length,
      total: totalMessages,
      page,
      totalPages: Math.ceil(totalMessages / limit),
      hasMore: skip + rawMessages.length < totalMessages,
      messages,
    });
  } catch (error) {
    console.error("Get group messages error:", error);
    return res.status(500).json({
      message: "Could not load group messages",
    });
  }
};

// PATCH /api/groups/:groupId/messages/:messageId — edit group message
const editGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.userId;
    const { text } = req.body;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid group ID or message ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    const message = await GroupMessage.findOne({
      _id: messageId,
      group: groupId,
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    if (String(message.sender) !== String(userId)) {
      return res.status(403).json({
        message: "You can only edit your own messages",
      });
    }

    if (message.deleted) {
      return res.status(400).json({
        message: "Cannot edit a deleted message",
      });
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        message: "Message text cannot be empty",
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 5000) {
      return res.status(400).json({
        message: "Message text cannot exceed 5000 characters",
      });
    }

    message.text = trimmedText;
    message.isEdited = true;
    await message.save();

    await message.populate([
      { path: "sender", select: "_id username email" },
      {
        path: "replyTo",
        select: "_id text sender deleted isEdited",
        populate: { path: "sender", select: "_id username email" },
      },
    ]);

    try {
      getIO().to(`group:${groupId}`).emit("group:message:edited", {
        messageId: String(message._id),
        groupId: String(groupId),
        text: message.text,
        isEdited: message.isEdited,
        updatedAt: message.updatedAt,
      });
    } catch (socketErr) {
      console.error("Socket emit on editGroupMessage failed:", socketErr);
    }

    return res.status(200).json({
      message: "Message updated successfully",
      data: message,
    });
  } catch (error) {
    console.error("Edit group message error:", error);
    return res.status(500).json({
      message: "Could not edit group message",
    });
  }
};

// DELETE /api/groups/:groupId/messages/:messageId — delete group message (soft delete)
const deleteGroupMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const userId = req.user.userId;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({
        message: "Invalid group ID or message ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    const message = await GroupMessage.findOne({
      _id: messageId,
      group: groupId,
    });

    if (!message) {
      return res.status(404).json({
        message: "Message not found",
      });
    }

    // Only original sender or group admin can delete
    const isSender = String(message.sender) === String(userId);
    const isAdmin = group.admins.some((a) => String(a) === String(userId));

    if (!isSender && !isAdmin) {
      return res.status(403).json({
        message: "You are not authorized to delete this message",
      });
    }

    message.text = "This message was deleted";
    message.deleted = true;
    await message.save();

    await message.populate([
      { path: "sender", select: "_id username email" },
      {
        path: "replyTo",
        select: "_id text sender deleted isEdited",
        populate: { path: "sender", select: "_id username email" },
      },
    ]);

    try {
      getIO().to(`group:${groupId}`).emit("group:message:deleted", {
        messageId: String(message._id),
        groupId: String(groupId),
        text: message.text,
        deleted: message.deleted,
      });
    } catch (socketErr) {
      console.error("Socket emit on deleteGroupMessage failed:", socketErr);
    }

    return res.status(200).json({
      message: "Message deleted successfully",
      data: message,
    });
  } catch (error) {
    console.error("Delete group message error:", error);
    return res.status(500).json({
      message: "Could not delete group message",
    });
  }
};

// POST /api/groups/:groupId/messages/upload — upload attachment to group
const uploadAndSendGroupMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user.userId;
    const { text, replyTo } = req.body;
    const file = req.file;

    if (!file && (!text || !text.trim())) {
      return res.status(400).json({
        message: "Message text or file attachment is required",
      });
    }

    if (!mongoose.isValidObjectId(groupId)) {
      return res.status(400).json({
        message: "Invalid group ID",
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    let originalMessage = null;
    if (replyTo && mongoose.isValidObjectId(replyTo)) {
      originalMessage = await GroupMessage.findOne({
        _id: replyTo,
        group: groupId,
      });
    }

    const messageData = {
      group: groupId,
      sender: userId,
      text: (text || "").trim(),
      replyTo: originalMessage ? originalMessage._id : null,
    };

    if (file) {
      messageData.attachment = {
        originalName: file.originalname,
        fileName: file.filename,
        fileSize: file.size,
        mimeType: file.mimetype,
      };
    }

    const message = await GroupMessage.create(messageData);

    await Group.findByIdAndUpdate(groupId, { updatedAt: new Date() });

    await message.populate([
      { path: "sender", select: "_id username email" },
      {
        path: "replyTo",
        select: "_id text sender deleted isEdited attachment",
        populate: { path: "sender", select: "_id username email" },
      },
    ]);

    try {
      getIO().to(`group:${groupId}`).emit("group:message:new", message);
      getIO().to(`group:${groupId}`).emit("group:updated", {
        groupId: String(groupId),
        group: { lastMessage: message, updatedAt: new Date() },
      });
    } catch (socketErr) {
      console.error("Socket emit on uploadAndSendGroupMessage failed:", socketErr);
    }

    return res.status(201).json({
      message: "Group message with attachment sent successfully",
      data: message,
    });
  } catch (error) {
    console.error("Upload and send group message error:", error);
    return res.status(500).json({
      message: "Could not send group message with attachment",
    });
  }
};

// GET /api/groups/:groupId/messages/:messageId/attachment — download group attachment
const downloadGroupAttachment = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { groupId, messageId } = req.params;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid group or message ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    const message = await GroupMessage.findOne({ _id: messageId, group: groupId });
    if (!message || !message.attachment || !message.attachment.fileName) {
      return res.status(404).json({ message: "Attachment not found" });
    }

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
    console.error("Download group attachment error:", error);
    return res.status(500).json({ message: "Could not download attachment" });
  }
};

// GET /api/groups/:groupId/messages/:messageId/view — inline view (e.g. image preview)
const viewGroupAttachment = async (req, res) => {
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
    const { groupId, messageId } = req.params;

    if (!mongoose.isValidObjectId(groupId) || !mongoose.isValidObjectId(messageId)) {
      return res.status(400).json({ message: "Invalid group or message ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    const isMember = group.members.some((m) => String(m) === String(userId));
    if (!isMember) {
      return res.status(403).json({
        message: "Access denied. You are not a member of this group",
      });
    }

    const message = await GroupMessage.findOne({ _id: messageId, group: groupId });
    if (!message || !message.attachment || !message.attachment.fileName) {
      return res.status(404).json({ message: "Attachment not found" });
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
    console.error("View group attachment error:", error);
    return res.status(500).json({ message: "Could not view attachment" });
  }
};

module.exports = {
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
};
