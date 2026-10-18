
import { useState } from "react";

function MessageInput({
  recipientId,
  onMessageSent,
  socket,
  replyTo,
  onCancelReply,
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedText = text.trim();

    if (!trimmedText || !recipientId || sending) return;

    setSending(true);
    setError("");

    try {
      await onMessageSent(trimmedText, replyTo?._id ?? null);
      setText("");

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

  return (
    <div>
      {replyTo && (
        <div className="reply-composer">
          <div className="reply-composer-content">
            <strong>Replying to {replySenderName}</strong>
            <p>{replyTo.text}</p>
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

      {error && <p className="search-error">{error}</p>}

      <form className="message-composer" onSubmit={handleSubmit}>
        <input
          value={text}
          onChange={handleTextChange}
          placeholder="Write a message..."
          aria-label="Write a message"
          disabled={!recipientId || sending}
        />

        <button
          type="submit"
          disabled={!recipientId || !text.trim() || sending}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
