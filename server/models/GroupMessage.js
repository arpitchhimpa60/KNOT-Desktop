const mongoose = require("mongoose");

const groupMessageSchema = new mongoose.Schema(
  {
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Group reference is required"],
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender reference is required"],
    },
    text: {
      type: String,
      trim: true,
      default: "",
      maxlength: [5000, "Message text cannot exceed 5000 characters"],
    },
    attachment: {
      originalName: { type: String, default: null },
      fileName: { type: String, default: null },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: null },
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying group history sorted by creation time
groupMessageSchema.index({ group: 1, createdAt: -1 });

const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);

module.exports = GroupMessage;
