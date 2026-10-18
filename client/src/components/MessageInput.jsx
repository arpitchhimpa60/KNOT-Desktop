
import { useState } from "react";

function MessageInput({ recipientId, onMessageSent }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

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
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
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
