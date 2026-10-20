
import { useState, useEffect, useRef } from "react";
import EmojiPicker from "./EmojiPicker";
import ImagePreviewModal from "./ImagePreviewModal";

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
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

    if (file.size > 10 * 1024 * 1024) {
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
            <p>
              {replyTo.text
                ? (replyTo.attachment?.originalName
                    ? `📎 ${replyTo.attachment.originalName} — ${replyTo.text}`
                    : replyTo.text)
                : (replyTo.attachment?.originalName
                    ? `📎 ${replyTo.attachment.originalName}`
                    : "Message")}
            </p>
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

        <div className="composer-action-buttons">
          <button
            type="button"
            className="composer-icon-button attachment-button"
            onClick={handleOpenAttachmentPicker}
            disabled={!recipientId || sending}
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
            disabled={!recipientId || sending}
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
              : "Write a message..."
          }
          aria-label="Write a message"
          disabled={!recipientId || sending}
        />

        <button
          type="submit"
          className="composer-send-button"
          disabled={!recipientId || !hasContentToSend || sending}
          aria-label="Send message"
        >
          {sending ? (
            <span className="sending-spinner">...</span>
          ) : (
            <span className="send-text">Send</span>
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
