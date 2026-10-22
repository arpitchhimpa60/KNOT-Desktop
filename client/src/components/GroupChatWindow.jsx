import { useEffect, useState, useRef, Fragment } from "react";
import GroupInfoModal from "./GroupInfoModal";
import EmojiPicker from "./EmojiPicker";
import ImagePreviewModal from "./ImagePreviewModal";
import { isSameCalendarDay, formatDateSeparator, formatMessageTime } from "../utils/dateUtils";
import {
  getGroupMessages,
  sendGroupMessage,
  uploadGroupChatMessage,
  downloadGroupMessageAttachment,
  getAttachmentViewUrl,
  editGroupMessage,
  deleteGroupMessage,
} from "../api";

import FileAttachmentCard from "./FileAttachmentCard";
import { formatFileSize, isImageMimeOrExt } from "../utils/fileUtils";

function scrollToMessageElement(element, container) {
  if (!element || !container) return;
  const containerRect = container.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  const currentScroll = container.scrollTop;
  const relativeOffset = elementRect.top - containerRect.top;
  const targetScroll =
    currentScroll + relativeOffset - container.clientHeight / 2 + elementRect.height / 2;

  container.scrollTo({
    top: Math.max(0, targetScroll),
    behavior: "smooth",
  });
}

function GroupChatWindow({
  selectedGroup,
  currentUser,
  token,
  socket,
  onGroupUpdated,
  onGroupLeft,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);

  // Group metadata modal
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Typing state: Set of typing user IDs/names
  const [typingUsers, setTypingUsers] = useState(new Map());

  // Attachment states
  const [selectedFile, setSelectedFile] = useState(null);
  const [stagedImagePreviewUrl, setStagedImagePreviewUrl] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const highlightTimerRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Generate object URL for staging image preview
  useEffect(() => {
    if (
      selectedFile?.blob &&
      (selectedFile.blob.type?.startsWith("image/") ||
        /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(selectedFile.name))
    ) {
      const url = URL.createObjectURL(selectedFile.blob);
      setStagedImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setStagedImagePreviewUrl(null);
    }
  }, [selectedFile]);

  function handleOpenImagePreview(message) {
    const src = getAttachmentViewUrl(
      token,
      message._id,
      true,
      selectedGroup._id
    );
    setPreviewImage({
      src,
      alt: message.attachment.originalName || "Attached image",
      fileName: message.attachment.originalName || "image",
      fileSize: formatFileSize(message.attachment.fileSize),
      messageId: message._id,
    });
  }

  // Composer & reply state
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);

  // Edit / delete state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  function handleSelectEmoji(emoji) {
    if (inputRef.current) {
      const input = inputRef.current;
      const start = input.selectionStart ?? text.length;
      const end = input.selectionEnd ?? text.length;
      const nextText = text.slice(0, start) + emoji + text.slice(end);
      setText(nextText);

      setTimeout(() => {
        input.focus();
        const nextCursor = start + emoji.length;
        input.setSelectionRange(nextCursor, nextCursor);
      }, 0);
    } else {
      setText((prev) => prev + emoji);
    }
  }

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const currentUserId = String(currentUser?._id);
  const groupId = String(selectedGroup?._id);

  const isAdmin = Boolean(
    selectedGroup?.admins?.some((a) => String(a._id ?? a) === currentUserId)
  );

  // Auto-scroll to bottom
  function scrollToBottom(smooth = true) {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  // 1. Load initial message history when selectedGroup changes
  useEffect(() => {
    let cancelled = false;

    async function loadInitialMessages() {
      if (!selectedGroup?._id) {
        setMessages([]);
        setError("");
        setLoading(false);
        return;
      }

      setMessages([]);
      setReplyingTo(null);
      setEditingMessageId(null);
      setEditText("");
      setActionError("");
      setError("");
      setLoading(true);
      setPage(1);

      try {
        const res = await getGroupMessages(token, selectedGroup._id, 1, 50);

        if (!cancelled) {
          setMessages(res.messages || []);
          setHasMore(Boolean(res.hasMore));
          setPage(res.page || 1);
          setTimeout(() => scrollToBottom(false), 50);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load group conversation.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadInitialMessages();

    return () => {
      cancelled = true;
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      setHighlightedMessageId(null);
    };
  }, [selectedGroup?._id, token]);

  function triggerHighlight(messageId) {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightedMessageId(String(messageId));
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedMessageId(null);
      highlightTimerRef.current = null;
    }, 1800);
  }

  function attemptScrollAndHighlight(messageId) {
    let attempts = 0;
    const maxAttempts = 6;

    function tryFind() {
      attempts++;
      const el = document.getElementById(`msg-${messageId}`);
      if (el && messagesContainerRef.current) {
        scrollToMessageElement(el, messagesContainerRef.current);
        triggerHighlight(messageId);
      } else if (attempts < maxAttempts) {
        setTimeout(tryFind, 50);
      } else {
        setActionError("Original message is no longer available.");
        setTimeout(() => setActionError(""), 3000);
      }
    }

    tryFind();
  }

  async function handleScrollToOriginalMessage(replyId) {
    if (!replyId) return;
    const strReplyId = String(replyId);

    // 1. If already rendered in current messages, scroll and highlight
    const existingIndex = messages.findIndex(
      (m) => String(m._id) === strReplyId
    );

    if (existingIndex !== -1) {
      attemptScrollAndHighlight(strReplyId);
      return;
    }

    // 2. If not rendered, fetch history window around target message
    try {
      setActionError("");
      const res = await getGroupMessages(token, selectedGroup._id, 1, 50, {
        targetMessageId: strReplyId,
      });

      const loadedMessages = res.messages || [];
      if (loadedMessages.length > 0) {
        setMessages((prev) => {
          const map = new Map();
          for (const m of prev) map.set(String(m._id), m);
          for (const m of loadedMessages) map.set(String(m._id), m);
          return Array.from(map.values()).sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );
        });

        attemptScrollAndHighlight(strReplyId);
      } else {
        setActionError("Original message is no longer available.");
        setTimeout(() => setActionError(""), 3000);
      }
    } catch (err) {
      console.error("Failed to load original group message:", err);
      setActionError("Original message is no longer available.");
      setTimeout(() => setActionError(""), 3000);
    }
  }

  // Load older messages for pagination
  async function handleLoadOlder() {
    if (loadingOlder || !hasMore || !selectedGroup?._id) return;

    setLoadingOlder(true);
    setActionError("");

    try {
      const nextPage = page + 1;
      const res = await getGroupMessages(token, selectedGroup._id, nextPage, 50);

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => String(m._id)));
        const newOlder = (res.messages || []).filter(
          (m) => !existingIds.has(String(m._id))
        );
        return [...newOlder, ...prev];
      });

      setPage(res.page || nextPage);
      setHasMore(Boolean(res.hasMore));
    } catch (err) {
      setActionError(err.message || "Failed to load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }

  // 2. Socket.IO room management and real-time listeners
  useEffect(() => {
    if (!socket || !selectedGroup?._id) return;

    const currentGId = String(selectedGroup._id);

    // Request server to ensure socket is in room
    socket.emit("group:join", { groupId: currentGId });

    function handleNewMessage(message) {
      const msgGroupId = String(message.group?._id ?? message.group);
      if (msgGroupId !== currentGId) return;

      setMessages((prev) => {
        const exists = prev.some((m) => String(m._id) === String(message._id));
        if (exists) return prev;
        return [...prev, message];
      });

      scrollToBottom();
    }

    function handleMessageEdited(update) {
      if (String(update.groupId) !== currentGId) return;

      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(update.messageId)
            ? {
                ...m,
                text: update.text,
                isEdited: true,
                updatedAt: update.updatedAt,
              }
            : m
        )
      );
    }

    function handleMessageDeleted(update) {
      if (String(update.groupId) !== currentGId) return;

      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(update.messageId)
            ? {
                ...m,
                text: update.text || "This message was deleted",
                deleted: true,
              }
            : m
        )
      );
    }

    function handleTypingUpdate({ groupId: typingGId, userId: typingUId, isTyping }) {
      if (String(typingGId) !== currentGId) return;
      if (String(typingUId) === currentUserId) return;

      // Find user's name from group members
      const member = selectedGroup.members?.find(
        (m) => String(m._id ?? m) === String(typingUId)
      );
      const name = member?.username || "Someone";

      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(String(typingUId), name);
        } else {
          next.delete(String(typingUId));
        }
        return next;
      });
    }

    function handleGroupUpdated({ groupId: updatedGId, group: updatedGroup }) {
      if (String(updatedGId) !== currentGId) return;
      onGroupUpdated(updatedGroup);
    }

    function handleMemberAdded({ groupId: addedGId, group: updatedGroup }) {
      if (String(addedGId) !== currentGId) return;
      if (updatedGroup) {
        onGroupUpdated(updatedGroup);
      }
    }

    function handleMemberRemoved({ groupId: removedGId, removedUserId, left }) {
      if (String(removedGId) !== currentGId) return;

      if (String(removedUserId) === currentUserId) {
        if (!left) {
          alert("You have been removed from this group.");
        }
        onGroupLeft(currentGId);
      }
    }

    function handleGroupDeleted({ groupId: deletedGId }) {
      if (String(deletedGId) !== currentGId) return;
      alert("This group was deleted by an administrator.");
      onGroupLeft(currentGId);
    }

    socket.on("group:message:new", handleNewMessage);
    socket.on("group:message:edited", handleMessageEdited);
    socket.on("group:message:deleted", handleMessageDeleted);
    socket.on("group:typing:update", handleTypingUpdate);
    socket.on("group:updated", handleGroupUpdated);
    socket.on("group:member:added", handleMemberAdded);
    socket.on("group:member:removed", handleMemberRemoved);
    socket.on("group:deleted", handleGroupDeleted);

    return () => {
      socket.emit("group:leave", { groupId: currentGId });
      socket.off("group:message:new", handleNewMessage);
      socket.off("group:message:edited", handleMessageEdited);
      socket.off("group:message:deleted", handleMessageDeleted);
      socket.off("group:typing:update", handleTypingUpdate);
      socket.off("group:updated", handleGroupUpdated);
      socket.off("group:member:added", handleMemberAdded);
      socket.off("group:member:removed", handleMemberRemoved);
      socket.off("group:deleted", handleGroupDeleted);
    };
  }, [socket, selectedGroup?._id, currentUserId, selectedGroup?.members, onGroupUpdated, onGroupLeft]);

  // Handle composer text change with typing indicator emit
  function handleTextChange(e) {
    const value = e.target.value;
    setText(value);
    setActionError("");

    if (!socket || !selectedGroup?._id) return;

    // Emit group typing start
    socket.emit("group:typing", {
      groupId: selectedGroup._id,
      isTyping: value.trim().length > 0,
    });

    // Auto clear typing after pause
    clearTimeout(typingTimeoutRef.current);
    if (value.trim().length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("group:typing", {
          groupId: selectedGroup._id,
          isTyping: false,
        });
      }, 3000);
    }
  }

  function handleOpenAttachmentPicker() {
    setActionError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleFileInputChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setActionError("File exceeds the 10 MB size limit.");
      event.target.value = "";
      return;
    }

    setSelectedFile({
      name: file.name,
      size: file.size,
      blob: file,
    });
    event.target.value = "";
  }

  async function handleDownload(messageId, originalName) {
    if (downloadingId || !selectedGroup?._id) return;
    setDownloadingId(messageId);
    try {
      await downloadGroupMessageAttachment(
        token,
        selectedGroup._id,
        messageId,
        originalName
      );
    } catch (err) {
      console.error("Failed to download group attachment:", err);
      setActionError(err.message || "Could not download attachment.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Send group message
  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if ((!trimmed && !selectedFile) || sending || !selectedGroup?._id) return;

    setSending(true);
    setActionError("");
    setShowEmojiPicker(false);

    try {
      let saved;
      if (selectedFile) {
        saved = await uploadGroupChatMessage(
          token,
          selectedGroup._id,
          selectedFile.blob,
          selectedFile.name,
          trimmed,
          replyingTo?._id ?? null
        );
      } else {
        saved = await sendGroupMessage(
          token,
          selectedGroup._id,
          trimmed,
          replyingTo?._id ?? null
        );
      }

      setMessages((prev) => {
        const exists = prev.some((m) => String(m._id) === String(saved._id));
        return exists ? prev : [...prev, saved];
      });

      setText("");
      setSelectedFile(null);
      setReplyingTo(null);

      if (socket) {
        socket.emit("group:typing", {
          groupId: selectedGroup._id,
          isTyping: false,
        });
      }

      scrollToBottom();
    } catch (err) {
      setActionError(err.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  // Edit group message
  function startEditing(message) {
    setEditingMessageId(String(message._id));
    setEditText(message.text);
    setActionError("");
  }

  function cancelEditing() {
    setEditingMessageId(null);
    setEditText("");
    setActionError("");
  }

  async function handleEditMessage(messageId) {
    const trimmed = editText.trim();
    if (!trimmed || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      const updated = await editGroupMessage(
        token,
        selectedGroup._id,
        messageId,
        trimmed
      );

      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId) ? { ...m, ...updated } : m
        )
      );

      cancelEditing();
    } catch (err) {
      setActionError(err.message || "Could not edit message.");
    } finally {
      setActionLoading(false);
    }
  }

  // Delete group message
  async function handleDeleteMessage(messageId) {
    if (actionLoading) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this message?"
    );
    if (!confirmed) return;

    setActionLoading(true);
    setActionError("");

    try {
      const deleted = await deleteGroupMessage(
        token,
        selectedGroup._id,
        messageId
      );

      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId) ? { ...m, ...deleted } : m
        )
      );

      if (String(editingMessageId) === String(messageId)) {
        cancelEditing();
      }
      if (String(replyingTo?._id) === String(messageId)) {
        setReplyingTo(null);
      }
    } catch (err) {
      setActionError(err.message || "Could not delete message.");
    } finally {
      setActionLoading(false);
    }
  }

  if (!selectedGroup) {
    return (
      <main className="chat-empty">
        <div className="empty-icon-wrapper">
          <img src="/knot-logo.svg" alt="KNOT" className="empty-leaf-logo" width="56" height="56" />
        </div>
        <h1 className="empty-brand">KNOT</h1>
        <h2>Select a group to get started</h2>
        <p>Choose a group from the sidebar to start chatting.</p>
      </main>
    );
  }

  // Typing indicator text
  const typingNames = Array.from(typingUsers.values());
  const typingText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length > 1
      ? `${typingNames.join(", ")} are typing...`
      : null;

  return (
    <main className="chat-window">
      {/* Group Header */}
      <header className="chat-header group-chat-header">
        <div
          className="avatar large group-avatar-display clickable"
          onClick={() => setIsInfoOpen(true)}
          title="Click to view group details"
        >
          {(selectedGroup.name || "G").charAt(0).toUpperCase()}
        </div>

        <div
          className="chat-header-info clickable"
          onClick={() => setIsInfoOpen(true)}
          title="Click to view group details"
        >
          <h2>{selectedGroup.name}</h2>
          <span className="chat-status online">
            ● {selectedGroup.members?.length || 1} member
            {(selectedGroup.members?.length || 1) !== 1 ? "s" : ""}
            {selectedGroup.description ? ` • ${selectedGroup.description}` : ""}
          </span>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"
            className="contact-info-toggle-btn"
            onClick={() => setIsInfoOpen(true)}
            title="View group details"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="contact-info-btn-text">Group Info</span>
          </button>
        </div>
      </header>

      {/* Messages Section */}
      <section className="messages" ref={messagesContainerRef}>
        <div className="date-label">GROUP CONVERSATION</div>

        {hasMore && (
          <div className="pagination-wrapper">
            <button
              type="button"
              className="load-older-btn"
              onClick={handleLoadOlder}
              disabled={loadingOlder}
            >
              {loadingOlder ? "Loading older..." : "↑ Load older messages"}
            </button>
          </div>
        )}

        {loading && <p className="search-hint">Loading group messages...</p>}
        {error && <p className="search-error">{error}</p>}
        {actionError && <p className="search-error">{actionError}</p>}

        {!loading && !error && messages.length === 0 && (
          <p className="search-hint">
            No messages in this group yet. Send the first message!
          </p>
        )}

        {messages.map((message, index) => {
          const senderId = String(message.sender?._id ?? message.sender);
          const mine = senderId === currentUserId;
          const senderName =
            message.sender?.username || (mine ? "You" : "Member");

          const isEditing = String(editingMessageId) === String(message._id);
          const isDeleted = Boolean(message.deleted);

          // Reply reference
          const replyId = message.replyTo?._id ?? message.replyTo;
          const originalMessage = replyId
            ? messages.find((item) => String(item._id) === String(replyId)) ||
              (typeof message.replyTo === "object" ? message.replyTo : null)
            : null;

          const originalSenderId = originalMessage
            ? String(originalMessage.sender?._id ?? originalMessage.sender)
            : null;

          const originalSenderName =
            originalSenderId === currentUserId
              ? "You"
              : originalMessage?.sender?.username || "Member";

          // Can delete if message is mine OR current user is an admin of this group
          const canDelete = (mine || isAdmin) && !isDeleted;
          const canEdit = mine && !isDeleted;

          // Date Separator calculation
          const timestamp = message.createdAt || message.timestamp;
          const currentDate = timestamp ? new Date(timestamp) : null;
          const isValidDate = currentDate && !isNaN(currentDate.getTime());

          const prevMessage = index > 0 ? messages[index - 1] : null;
          const prevTimestamp = prevMessage ? (prevMessage.createdAt || prevMessage.timestamp) : null;
          const prevDate = prevTimestamp ? new Date(prevTimestamp) : null;
          const isPrevValid = prevDate && !isNaN(prevDate.getTime());

          const showDateSeparator =
            isValidDate && (!isPrevValid || !isSameCalendarDay(currentDate, prevDate));

          const dateSeparatorLabel = showDateSeparator
            ? formatDateSeparator(currentDate)
            : null;

          // Attachment status
          const hasAttachment = Boolean(
            message.attachment && message.attachment.fileName && !isDeleted
          );
          const isImage =
            hasAttachment &&
            isImageMimeOrExt(
              message.attachment.mimeType,
              message.attachment.originalName
            );
          const isFileAttachment = hasAttachment && !isImage;
          const prevSenderId = prevMessage
            ? String(prevMessage.sender?._id ?? prevMessage.sender)
            : null;
          const isConsecutive = !showDateSeparator && prevSenderId === senderId;

          return (
            <Fragment key={message._id}>
              {showDateSeparator && (
                <div className="date-label">{dateSeparatorLabel}</div>
              )}

              <div
                id={`msg-${message._id}`}
                className={`message-row ${mine ? "mine" : ""} ${
                  isConsecutive ? "consecutive-message" : "new-sender-message"
                }`}
              >
              <div className="message-bubble-wrapper">
                <div
                  className={`message-bubble group-message-bubble ${
                    isFileAttachment ? "has-attachment" : ""
                  } ${
                    isAttachmentOnly ? "attachment-only" : ""
                  } ${
                    highlightedMessageId === String(message._id)
                      ? "reply-highlighted"
                      : ""
                  }`}
                >
                  {/* Sender Attribution for other members in group */}
                  {!mine && !isConsecutive && (
                    <strong className="group-sender-name">{senderName}</strong>
                  )}

                  {/* Reply Quote preview */}
                  {replyId && (
                    <div
                      className="reply-quote"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScrollToOriginalMessage(replyId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleScrollToOriginalMessage(replyId);
                        }
                      }}
                      title="Click to jump to original message"
                      aria-label="Click to jump to original message"
                    >
                      <strong>
                        {originalMessage ? originalSenderName : "Original message"}
                      </strong>
                      <p>
                        {originalMessage
                          ? (originalMessage.deleted
                              ? "This message was deleted"
                              : originalMessage.attachment?.originalName
                                ? (originalMessage.text
                                    ? `📎 ${originalMessage.attachment.originalName} — ${originalMessage.text}`
                                    : `📎 ${originalMessage.attachment.originalName}`)
                                : originalMessage.text || "Message")
                          : "Message preview unavailable"}
                      </p>
                    </div>
                  )}

                  {/* Content or Edit Form */}
                  {isEditing ? (
                    <form
                      className="edit-message-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleEditMessage(message._id);
                      }}
                    >
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        rows={3}
                        maxLength={5000}
                        aria-label="Edit message"
                        disabled={actionLoading}
                      />
                      <div className="edit-form-actions">
                        <button
                          type="submit"
                          className="edit-btn-save"
                          disabled={!editText.trim() || actionLoading}
                        >
                          {actionLoading ? "Saving..." : "Save"}
                        </button>
                        <button
                          type="button"
                          className="edit-btn-cancel"
                          onClick={cancelEditing}
                          disabled={actionLoading}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {message.attachment &&
                        message.attachment.fileName &&
                        !isDeleted &&
                        (isImageMimeOrExt(
                          message.attachment.mimeType,
                          message.attachment.originalName
                        ) ? (
                          <div
                            className="message-attachment-image-wrap"
                            onClick={() => handleOpenImagePreview(message)}
                            title="Click to preview image"
                          >
                            <img
                              src={getAttachmentViewUrl(
                                token,
                                message._id,
                                true,
                                selectedGroup._id
                              )}
                              alt={
                                message.attachment.originalName ||
                                "Attached image"
                              }
                              className="message-image-preview"
                              loading="lazy"
                            />
                            <div className="message-image-overlay">
                              <span className="message-image-preview-badge">
                                🔍 Preview
                              </span>
                              <button
                                type="button"
                                className="message-image-download-action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(
                                    message._id,
                                    message.attachment.originalName
                                  );
                                }}
                                title="Download image"
                                aria-label="Download image"
                              >
                                ⬇
                              </button>
                            </div>
                          </div>
                        ) : (
                          <FileAttachmentCard
                            attachment={message.attachment}
                            messageId={message._id}
                            isDownloading={downloadingId === message._id}
                            onDownload={handleDownload}
                          />
                        ))}

                      <div className="message-content">
                        {isDeleted ? (
                          <span className="deleted-label">This message was deleted</span>
                        ) : (
                          <>
                            {message.text && (
                              <span className="message-text">
                                {message.text}
                              </span>
                            )}
                            {message.isEdited && (
                              <span className="edited-label">(edited)</span>
                            )}
                          </>
                        )}

                        <span className="message-meta">
                          <span className="message-time">
                            {formatMessageTime(message.createdAt || message.timestamp)}
                          </span>
                          {mine && (
                            <span
                              className={`message-status ${
                                (message.status || "sent") === "read"
                                  ? "read"
                                  : ""
                              }`}
                              title={message.status || "sent"}
                              aria-label={message.status || "sent"}
                            >
                              {(message.status || "sent") === "sent"
                                ? "✓"
                                : "✓✓"}
                            </span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Floating hover actions */}
                {!isEditing && !isDeleted && (
                  <div className="message-hover-actions">
                    <button
                      type="button"
                      className="msg-action-btn reply-button"
                      onClick={() => setReplyingTo(message)}
                      title="Reply"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                      <span>Reply</span>
                    </button>

                    {canEdit && (
                      <button
                        type="button"
                        className="msg-action-btn edit-button"
                        onClick={() => startEditing(message)}
                        disabled={actionLoading}
                        title="Edit"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        className="msg-action-btn delete-message-button delete"
                        onClick={() => handleDeleteMessage(message._id)}
                        disabled={actionLoading}
                        title="Delete"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          );
        })}

        {/* Group typing indicator */}
        {typingText && <p className="typing-indicator">{typingText}</p>}

        <div ref={messagesEndRef} />
      </section>

      {/* Message Composer & Reply Banner */}
      <div>
        {replyingTo && (
          <div className="reply-composer">
            <div className="reply-composer-content">
              <strong>
                Replying to{" "}
                {String(replyingTo.sender?._id ?? replyingTo.sender) ===
                currentUserId
                  ? "yourself"
                  : replyingTo.sender?.username || "message"}
              </strong>
              <p>
                {replyingTo.text
                  ? (replyingTo.attachment?.originalName
                      ? `📎 ${replyingTo.attachment.originalName} — ${replyingTo.text}`
                      : replyingTo.text)
                  : (replyingTo.attachment?.originalName
                      ? `📎 ${replyingTo.attachment.originalName}`
                      : "Message")}
              </p>
            </div>
            <button
              type="button"
              className="cancel-reply-button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              title="Cancel reply"
            >
              ✕
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <EmojiPicker
            onSelectEmoji={handleSelectEmoji}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}

        {selectedFile && (
          <div className="selected-file-preview">
            <div className="file-preview-info">
              {stagedImagePreviewUrl ? (
                <img
                  src={stagedImagePreviewUrl}
                  alt={selectedFile.name}
                  className="file-preview-thumb"
                  title="Click to preview image"
                  onClick={() =>
                    setPreviewImage({
                      src: stagedImagePreviewUrl,
                      alt: selectedFile.name,
                      fileName: selectedFile.name,
                      fileSize: formatFileSize(selectedFile.size),
                      messageId: null,
                    })
                  }
                />
              ) : (
                <span className="file-preview-icon">📎</span>
              )}
              <span
                className="file-preview-name"
                title={selectedFile.name}
              >
                {selectedFile.name}
              </span>
              <span className="file-preview-size">
                ({formatFileSize(selectedFile.size)})
              </span>
            </div>

            <button
              type="button"
              className="remove-file-button"
              onClick={() => setSelectedFile(null)}
              aria-label="Remove selected file"
              title="Remove attachment"
            >
              ✕
            </button>
          </div>
        )}

        <form className="message-composer" onSubmit={handleSend}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileInputChange}
            aria-label="Group file upload input"
          />

          <div className="composer-action-buttons">
            <button
              type="button"
              className="composer-icon-button attachment-button"
              onClick={handleOpenAttachmentPicker}
              disabled={sending}
              title="Attach file (images, PDFs, documents, archives)"
              aria-label="Attach file"
            >
              📎
            </button>

            <button
              type="button"
              className={`composer-icon-button emoji-toggle-button ${
                showEmojiPicker ? "active" : ""
              }`}
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              disabled={sending}
              title="Insert emoji"
              aria-label="Insert emoji"
            >
              😊
            </button>
          </div>

          <input
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            placeholder={
              selectedFile
                ? "Add a caption (optional)..."
                : `Message ${selectedGroup.name}...`
            }
            aria-label="Write a group message"
            disabled={sending}
          />
          <button
            type="submit"
            className="composer-send-button"
            disabled={(!text.trim() && !selectedFile) || sending}
            aria-label="Send message"
          >
            {sending ? "..." : "Send"}
          </button>
        </form>
      </div>

      {/* Group Info Modal */}
      <GroupInfoModal
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
        group={selectedGroup}
        currentUser={currentUser}
        token={token}
        onGroupUpdated={onGroupUpdated}
        onGroupLeft={onGroupLeft}
      />

      {/* Full-Screen Image Preview Modal */}
      <ImagePreviewModal
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        src={previewImage?.src}
        alt={previewImage?.alt}
        fileName={previewImage?.fileName}
        fileSize={previewImage?.fileSize}
        onDownload={
          previewImage?.messageId
            ? () =>
                handleDownload(
                  previewImage.messageId,
                  previewImage.fileName
                )
            : null
        }
        downloading={downloadingId === previewImage?.messageId}
      />
    </main>
  );
}

export default GroupChatWindow;
