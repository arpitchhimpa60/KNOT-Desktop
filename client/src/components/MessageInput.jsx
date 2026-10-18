
import { useState } from "react";

function MessageInput({ recipientId, onMessageSent, socket }) {
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

    if (!trimmedText || !recipientId || sending) {
      return;
    }

    setSending(true);
    setError("");

    try {
      await onMessageSent(trimmedText);

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

  return (
    <div>
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
