
import { useState, useEffect, useRef } from "react";
import EmojiPicker from "./EmojiPicker";
import ImagePreviewModal from "./ImagePreviewModal";
import { formatFileSize } from "../utils/fileUtils";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function getReplyPreviewText(replyTo) {
  if (!replyTo) return "";
  if (replyTo.attachment?.originalName) {
    return replyTo.text
      ? `📎 ${replyTo.attachment.originalName} — ${replyTo.text}`
      : `📎 ${replyTo.attachment.originalName}`;
  }
  return replyTo.text || "Message";
}

function MessageInput({
  recipientId,
  onMessageSent,
  socket,
  replyTo,
  onCancelReply,
}) {
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [stagedImagePreviewUrl, setStagedImagePreviewUrl] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

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

  function handleTextChange(event) {
    const value = event.target.value;

    setText(value);
    setError("");

    if (!socket || !recipientId) return;

    socket.emit("typing", {
      recipientId: String(recipientId),
      isTyping: value.trim().length > 0,
    });
  }

  function handleOpenAttachmentPicker() {
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function handleFileInputChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError("File exceeds the 10 MB size limit.");
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

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if ((!trimmedText && !selectedFile) || !recipientId || sending) return;

    setSending(true);
    setError("");
    setShowEmojiPicker(false);

    try {
      await onMessageSent(
        trimmedText,
        replyTo?._id ?? null,
        selectedFile
      );
      setText("");
      setSelectedFile(null);

      if (socket) {
        socket.emit("typing", {
          recipientId: String(recipientId),
          isTyping: false,
        });
      }
    } catch (err) {
      setError(err.message || "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  const replySenderId = replyTo
    ? String(replyTo.sender?._id ?? replyTo.sender)
    : null;

  const replySenderName =
    replySenderId &&
    replySenderId === String(replyTo?.currentUserId)
      ? "You"
      : "Selected message";

  const hasContentToSend = Boolean(text.trim() || selectedFile);

  return (
    <div className="message-composer-wrapper">
      {replyTo && (
        <div className="reply-composer">
          <div className="reply-composer-content">
            <strong>Replying to {replySenderName}</strong>
            <p>{getReplyPreviewText(replyTo)}</p>
          </div>

          <button
            type="button"
            className="cancel-reply-button"
            onClick={onCancelReply}
            aria-label="Cancel reply"
            title="Cancel reply"
          >
            ✕
          </button>
        </div>
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
                onClick={() => setShowPreviewModal(true)}
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

      {showEmojiPicker && (
        <EmojiPicker
          onSelectEmoji={handleSelectEmoji}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}

      {error && <p className="search-error composer-error">{error}</p>}

      <form className="message-composer" onSubmit={handleSubmit}>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileInputChange}
          aria-label="File upload input"
        />

        <button
          type="button"
          className="composer-icon-button attachment-button"
          onClick={handleOpenAttachmentPicker}
          disabled={!recipientId || sending}
          title="Attach file (images, PDFs, documents, archives)"
          aria-label="Attach file"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <input
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          placeholder={
            selectedFile
              ? "Add a caption (optional)..."
              : "Write a message..."
          }
          aria-label="Write a message"
          disabled={!recipientId || sending}
        />

        <button
          type="button"
          className={`composer-icon-button emoji-toggle-button ${
            showEmojiPicker ? "active" : ""
          }`}
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          disabled={!recipientId || sending}
          title="Insert emoji"
          aria-label="Insert emoji"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 14s1.5 2 4 2 4-2 4-2" />
            <line x1="9" y1="9" x2="9.01" y2="9" />
            <line x1="15" y1="9" x2="15.01" y2="9" />
          </svg>
        </button>

        <button
          type="submit"
          className="composer-send-button"
          disabled={!recipientId || !hasContentToSend || sending}
          aria-label="Send message"
          title="Send message"
        >
          {sending ? (
            <span className="sending-spinner">...</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </form>

      {/* Full-Screen Image Preview Modal for staged image */}
      {showPreviewModal && stagedImagePreviewUrl && (
        <ImagePreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          src={stagedImagePreviewUrl}
          alt={selectedFile?.name || "Image Preview"}
          fileName={selectedFile?.name}
          fileSize={formatFileSize(selectedFile?.size)}
        />
      )}
    </div>
  );
}

export default MessageInput;
