
import { useEffect, useState } from "react";
import MessageInput from "./MessageInput";
import { getChatHistory, sendChatMessage } from "../api";

function ChatWindow({ selectedUser, currentUser, token, socket }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    };
  }, [selectedUser?._id, token]);

  // Listen for messages sent to the currently open conversation.
  useEffect(() => {
    if (!socket || !selectedUser?._id || !currentUser?._id) {
      return;
    }

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
        const alreadyExists = previous.some(
          (item) => String(item._id) === String(message._id)
        );

        return alreadyExists ? previous : [...previous, message];
      });
    }

    socket.on("new-message", handleNewMessage);

    return () => {
      socket.off("new-message", handleNewMessage);
    };
  }, [socket, selectedUser?._id, currentUser?._id]);

  async function handleSend(text) {
    if (!selectedUser?._id) {
      throw new Error("Select a user first.");
    }

    const savedMessage = await sendChatMessage(
      token,
      selectedUser._id,
      text
    );

    // The server emits new-message to the recipient, not the sender.
    setMessages((previous) => {
      const alreadyExists = previous.some(
        (item) => String(item._id) === String(savedMessage._id)
      );

      return alreadyExists ? previous : [...previous, savedMessage];
    });
  }

  if (!selectedUser) {
    return (
      <main className="chat-empty">
        <div className="empty-icon">✳</div>
        <h2>Your conversations belong here.</h2>
        <p>Select someone from the sidebar to open a chat.</p>
      </main>
    );
  }

  return (
    <main className="chat-window">
      <header className="chat-header">
        <div className="avatar large">
          {(selectedUser.username || "?").charAt(0).toUpperCase()}
        </div>

        <div>
          <h2>{selectedUser.username}</h2>
          <span className="chat-status">{selectedUser.email}</span>
        </div>
      </header>

      <section className="messages">
        <div className="date-label">CONVERSATION</div>

        {loading && (
          <p className="search-hint">Loading messages...</p>
        )}

        {error && <p className="search-error">{error}</p>}

        {!loading && !error && messages.length === 0 && (
          <p className="search-hint">No messages yet. Say hello!</p>
        )}

        {messages.map((message) => {
          const senderId = String(message.sender?._id ?? message.sender);
          const mine = senderId === String(currentUser?._id);

          return (
            <div
              key={message._id}
              className={`message-row ${mine ? "mine" : ""}`}
            >
              <div className="message-bubble">
                <p>{message.text}</p>
                <span>
                  {message.createdAt
                    ? new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      <MessageInput
        recipientId={selectedUser._id}
        onMessageSent={handleSend}
      />
    </main>
  );
}

export default ChatWindow;
