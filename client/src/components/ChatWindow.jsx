
import { useEffect, useState, useRef, Fragment } from "react";
import MessageInput from "./MessageInput";
import ImagePreviewModal from "./ImagePreviewModal";
import { isSameCalendarDay, formatDateSeparator, formatMessageTime } from "../utils/dateUtils";
import {
  getChatHistory,
  sendChatMessage,
  uploadChatMessage,
  downloadMessageAttachment,
  getAttachmentViewUrl,
  markMessagesRead,
  editChatMessage,
  deleteChatMessage,
  acceptConversation,
  getAvatarUrl,
} from "../api";

import FileAttachmentCard from "./FileAttachmentCard";
import { formatFileSize, isImageMimeOrExt } from "../utils/fileUtils";

function getReplyPreviewText(originalMessage) {
  if (!originalMessage) {
    return "Message preview unavailable";
  }
  if (originalMessage.deleted) {
    return "This message was deleted";
  }
  if (originalMessage.attachment?.originalName) {
    return originalMessage.text
      ? `📎 ${originalMessage.attachment.originalName} — ${originalMessage.text}`
      : `📎 ${originalMessage.attachment.originalName}`;
  }
  return originalMessage.text || "Message";
}

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

function ChatWindow({
  selectedUser,
  currentUser,
  token,
  socket,
  isRequest = false,
  onConversationUpdated,
  onlineUserIds = [],
  onOpenContactInfo,
}) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const highlightTimerRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText, setEditText] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [acceptingRequest, setAcceptingRequest] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  function handleOpenImagePreview(message) {
    const src = getAttachmentViewUrl(token, message._id);
    setPreviewImage({
      src,
      alt: message.attachment.originalName || "Attached image",
      fileName: message.attachment.originalName || "image",
      fileSize: formatFileSize(message.attachment.fileSize),
      messageId: message._id,
    });
  }

  async function handleDownload(messageId, originalName) {
    if (downloadingId) return;
    setDownloadingId(messageId);
    try {
      await downloadMessageAttachment(token, messageId, originalName);
    } catch (err) {
      console.error("Failed to download attachment:", err);
      setActionError(err.message || "Could not download file.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Load conversation history.
  useEffect(() => {
    let cancelled = false;

    async function loadMessages() {
      if (!selectedUser?._id) {
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

      try {
        const history = await getChatHistory(token, selectedUser._id);

        if (!cancelled) {
          setMessages(history);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load conversation");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      setHighlightedMessageId(null);
    };
  }, [selectedUser?._id, token]);

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
      const updatedHistory = await getChatHistory(token, selectedUser._id, {
        targetMessageId: strReplyId,
      });

      if (Array.isArray(updatedHistory) && updatedHistory.length > 0) {
        setMessages((prev) => {
          const map = new Map();
          for (const m of prev) map.set(String(m._id), m);
          for (const m of updatedHistory) map.set(String(m._id), m);
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
      console.error("Failed to load original message:", err);
      setActionError("Original message is no longer available.");
      setTimeout(() => setActionError(""), 3000);
    }
  }

  // Listen for new messages in the open conversation.
  useEffect(() => {
    if (!socket || !selectedUser?._id || !currentUser?._id) return;

    function handleNewMessage(message) {
      const senderId = String(message.sender?._id ?? message.sender);
      const recipientId = String(
        message.recipient?._id ?? message.recipient
      );

      const otherUserId = String(selectedUser._id);
      const myId = String(currentUser._id);

      const belongsToOpenChat =
        (senderId === otherUserId && recipientId === myId) ||
        (senderId === myId && recipientId === otherUserId);

      if (!belongsToOpenChat) return;

      setMessages((previous) => {
        const exists = previous.some(
          (item) => String(item._id) === String(message._id)
        );

        return exists ? previous : [...previous, message];
      });
    }

    socket.on("new-message", handleNewMessage);

    return () => {
      socket.off("new-message", handleNewMessage);
    };
  }, [socket, selectedUser?._id, currentUser?._id]);

  // Listen for delivery and read status updates.
  useEffect(() => {
    if (!socket) return;

    function handleMessageStatus({ messageId, status }) {
      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, status }
            : message
        )
      );
    }

    function handleMessagesRead({ messageIds }) {
      const readIds = new Set((messageIds || []).map(String));

      setMessages((previous) =>
        previous.map((message) =>
          readIds.has(String(message._id))
            ? { ...message, status: "read" }
            : message
        )
      );
    }

    socket.on("message-status", handleMessageStatus);
    socket.on("messages-read", handleMessagesRead);

    return () => {
      socket.off("message-status", handleMessageStatus);
      socket.off("messages-read", handleMessagesRead);
    };
  }, [socket]);

  // Mark incoming messages as read in the open conversation.
  useEffect(() => {
    if (
      !socket ||
      !selectedUser?._id ||
      !currentUser?._id ||
      loading
    ) {
      return;
    }

    let cancelled = false;

    async function acknowledgeReadMessages() {
      const incoming = messages.filter((message) => {
        const recipientId = String(
          message.recipient?._id ?? message.recipient
        );
        const senderId = String(message.sender?._id ?? message.sender);

        return (
          recipientId === String(currentUser._id) &&
          senderId === String(selectedUser._id) &&
          message.status !== "read"
        );
      });

      if (incoming.length === 0) return;

      try {
        await markMessagesRead(
          token,
          selectedUser._id,
          incoming.map((message) => message._id)
        );

        if (cancelled) return;

        const incomingIds = new Set(
          incoming.map((message) => String(message._id))
        );

        setMessages((previous) =>
          previous.map((message) =>
            incomingIds.has(String(message._id))
              ? { ...message, status: "read" }
              : message
          )
        );

        if (onConversationUpdated) {
          onConversationUpdated();
        }
      } catch (err) {
        console.error("Read acknowledgement failed:", err);
      }
    }

    acknowledgeReadMessages();

    return () => {
      cancelled = true;
    };
  }, [
    socket,
    selectedUser?._id,
    currentUser?._id,
    token,
    loading,
    messages,
    onConversationUpdated,
  ]);

  // Listen for typing events.
  useEffect(() => {
    setTypingUserId(null);

    if (!socket || !selectedUser?._id) return;

    function handleTypingUpdate({ userId, isTyping }) {
      if (String(userId) !== String(selectedUser._id)) return;

      setTypingUserId(isTyping ? String(userId) : null);
    }

    socket.on("typing-update", handleTypingUpdate);

    return () => {
      socket.off("typing-update", handleTypingUpdate);
    };
  }, [socket, selectedUser?._id]);

  // Listen for edits and deletions from either user.
  useEffect(() => {
    if (!socket) return;

    function handleMessageEdited(update) {
      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(update.messageId)
            ? {
                ...message,
                text: update.text,
                isEdited: true,
                updatedAt: update.updatedAt,
              }
            : message
        )
      );
    }

    function handleMessageDeleted(update) {
      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(update.messageId)
            ? {
                ...message,
                text: update.text || "This message was deleted",
                deleted: true,
              }
            : message
        )
      );
    }

    socket.on("message-edited", handleMessageEdited);
    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.off("message-edited", handleMessageEdited);
      socket.off("message-deleted", handleMessageDeleted);
    };
  }, [socket]);

  // Send a message, optionally replying to another message, optionally with an attachment.
  async function handleSend(text, replyToId, selectedFile) {
    if (!selectedUser?._id) {
      throw new Error("Select a user first.");
    }

    let savedMessage;

    if (selectedFile) {
      savedMessage = await uploadChatMessage(
        token,
        selectedUser._id,
        selectedFile.blob,
        selectedFile.name,
        text,
        replyToId || null
      );
    } else {
      savedMessage = await sendChatMessage(
        token,
        selectedUser._id,
        text,
        replyToId || null
      );
    }

    setMessages((previous) => {
      const exists = previous.some(
        (item) => String(item._id) === String(savedMessage._id)
      );

      return exists ? previous : [...previous, savedMessage];
    });

    setReplyingTo(null);

    if (onConversationUpdated) {
      onConversationUpdated();
    }
  }

  // Begin editing one of your messages.
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

  // Save the edited message.
  async function handleEditMessage(messageId) {
    const trimmedText = editText.trim();

    if (!trimmedText || actionLoading) return;

    setActionLoading(true);
    setActionError("");

    try {
      const updatedMessage = await editChatMessage(
        token,
        messageId,
        trimmedText
      );

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, ...updatedMessage }
            : message
        )
      );

      cancelEditing();
    } catch (err) {
      setActionError(err.message || "Could not edit message.");
    } finally {
      setActionLoading(false);
    }
  }

  // Delete one of your messages.
  async function handleDeleteMessage(messageId) {
    if (actionLoading) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this message?"
    );

    if (!confirmed) return;

    setActionLoading(true);
    setActionError("");

    try {
      const deletedMessage = await deleteChatMessage(token, messageId);

      setMessages((previous) =>
        previous.map((message) =>
          String(message._id) === String(messageId)
            ? { ...message, ...deletedMessage }
            : message
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

  async function handleAcceptRequest() {
    if (!selectedUser?._id || acceptingRequest) return;
    setAcceptingRequest(true);
    try {
      await acceptConversation(token, selectedUser._id);
      if (onConversationUpdated) {
        onConversationUpdated();
      }
    } catch (err) {
      console.error("Accepting request failed:", err);
    } finally {
      setAcceptingRequest(false);
    }
  }

  const isOnline = Boolean(
    selectedUser?._id && onlineUserIds.includes(String(selectedUser._id))
  );

  function handleOpenContact() {
    if (onOpenContactInfo && selectedUser) {
      onOpenContactInfo(selectedUser);
    }
  }

  if (!selectedUser) {
    return (
      <main className="chat-empty">
        <div className="empty-icon-wrapper">
          <img src="/knot-logo.svg" alt="KNOT" className="empty-leaf-logo" width="56" height="56" />
        </div>
        <h1 className="empty-brand">KNOT</h1>
        <h2>Select a conversation to get started</h2>
        <p>Choose a contact or group from the sidebar, or search to start a new chat.</p>
      </main>
    );
  }

  const userAvatar = getAvatarUrl(selectedUser.profilePhoto);

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div
          className="avatar large chat-header-avatar clickable"
          onClick={handleOpenContact}
          title="Click to view contact info"
        >
          {userAvatar ? (
            <img
              src={userAvatar}
              alt={selectedUser.username}
              className="avatar-img"
            />
          ) : (
            (selectedUser.username || "?").charAt(0).toUpperCase()
          )}
          {isOnline && <span className="online-dot" />}
        </div>

        <div
          className="chat-header-info clickable"
          onClick={handleOpenContact}
          title="Click to view contact info"
        >
          <h2>{selectedUser.username}</h2>
          <span className={`chat-status ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "● Online" : (selectedUser.email || "Offline")}
          </span>
        </div>

        <div className="chat-header-actions">
          <button
            type="button"
            className="contact-info-toggle-btn"
            onClick={handleOpenContact}
            title="View contact details"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span className="contact-info-btn-text">Contact Info</span>
          </button>
        </div>
      </header>

      {isRequest && (
        <div className="chat-request-banner">
          <div className="chat-request-info">
            <span className="chat-request-tag">New Conversation Request</span>
            <span className="chat-request-text">
              <strong>{selectedUser.username}</strong> wants to connect with you. Reply or accept to start chatting.
            </span>
          </div>
          <button
            type="button"
            className="chat-request-accept-btn"
            onClick={handleAcceptRequest}
            disabled={acceptingRequest}
          >
            {acceptingRequest ? "Accepting..." : "Accept Request"}
          </button>
        </div>
      )}

      <section className="messages" ref={messagesContainerRef}>
        {loading && (
          <p className="search-hint">Loading messages...</p>
        )}

        {error && <p className="search-error">{error}</p>}
        {actionError && <p className="search-error">{actionError}</p>}

        {!loading && !error && messages.length === 0 && (
          <p className="search-hint">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((message, index) => {
          const senderId = String(
            message.sender?._id ?? message.sender
          );
          const mine = senderId === String(currentUser?._id);
          const status = message.status || "sent";
          const isEditing =
            String(editingMessageId) === String(message._id);
          const isDeleted = Boolean(message.deleted);

          const replyId = message.replyTo?._id ?? message.replyTo;
          const originalMessage = replyId
            ? messages.find(
                (item) => String(item._id) === String(replyId)
              )
            : null;

          const originalSenderId = originalMessage
            ? String(
                originalMessage.sender?._id ?? originalMessage.sender
              )
            : null;

          const originalSenderName =
            originalSenderId === String(currentUser?._id)
              ? "You"
              : selectedUser.username;

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
          const isAttachmentOnly = isFileAttachment && !message.text;

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
                  className={`message-bubble ${
                    isFileAttachment ? "has-attachment" : ""
                  } ${
                    isAttachmentOnly ? "attachment-only" : ""
                  } ${
                    highlightedMessageId === String(message._id)
                      ? "reply-highlighted"
                      : ""
                  }`}
                >
                  {replyId && (
                    <div
                      className="reply-quote"
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.stopPropagation();
                        handleScrollToOriginalMessage(replyId);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleScrollToOriginalMessage(replyId);
                        }
                      }}
                      title="Click to jump to original message"
                      aria-label="Click to jump to original message"
                    >
                      <strong>
                        {originalMessage
                          ? originalSenderName
                          : "Original message"}
                      </strong>
                      <p>{getReplyPreviewText(originalMessage)}</p>
                    </div>
                  )}

                  {isEditing ? (
                    <form
                      className="edit-message-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleEditMessage(message._id);
                      }}
                    >
                      <textarea
                        value={editText}
                        onChange={(event) => setEditText(event.target.value)}
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
                      {hasAttachment &&
                        (isImage ? (
                          <div
                            className="message-attachment-image-wrap"
                            onClick={() => handleOpenImagePreview(message)}
                            title="Click to preview image"
                          >
                            <img
                              src={getAttachmentViewUrl(token, message._id)}
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
                                status === "read" ? "read" : ""
                              }`}
                              title={status}
                              aria-label={status}
                            >
                              {status === "sent" ? "✓" : "✓✓"}
                            </span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>

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

                    {mine && (
                      <>
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
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            </Fragment>
          );
        })}

        {typingUserId === String(selectedUser._id) && (
          <p className="typing-indicator">
            {selectedUser.username} is typing...
          </p>
        )}
      </section>

      <MessageInput
        recipientId={selectedUser._id}
        onMessageSent={handleSend}
        socket={socket}
        replyTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
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
          previewImage
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

export default ChatWindow;
