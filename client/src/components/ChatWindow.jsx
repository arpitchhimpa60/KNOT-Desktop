
import { useEffect, useState } from "react";
import MessageInput from "./MessageInput";
import {
  getChatHistory,
  sendChatMessage,
  markMessagesRead,
} from "../api";

function ChatWindow({ selectedUser, currentUser, token, socket }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typingUserId, setTypingUserId] = useState(null);

  // Load chat history when the selected user changes.
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

  // Listen for messages in the currently open conversation.
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

  // Update message statuses received from the server.
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
      const readIds = new Set(messageIds.map(String));

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

  // Mark incoming messages as read when their conversation is open.
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
  ]);

  // Listen for typing events from the selected user.
  useEffect(() => {
    setTypingUserId(null);

    if (!socket || !selectedUser?._id) {
      return;
    }

    function handleTypingUpdate({ userId, isTyping }) {
      const typingId = String(userId);

      if (typingId !== String(selectedUser._id)) return;

      setTypingUserId(isTyping ? typingId : null);
    }

    socket.on("typing-update", handleTypingUpdate);

    return () => {
      socket.off("typing-update", handleTypingUpdate);
    };
  }, [socket, selectedUser?._id]);

  // Send a message through the REST API.
  async function handleSend(text) {
    if (!selectedUser?._id) {
      throw new Error("Select a user first.");
    }

    const savedMessage = await sendChatMessage(
      token,
      selectedUser._id,
      text
    );

    setMessages((previous) => {
      const alreadyExists = previous.some(
        (item) => String(item._id) === String(savedMessage._id)
      );

      return alreadyExists
        ? previous
        : [...previous, savedMessage];
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
          <p className="search-hint">
            No messages yet. Say hello!
          </p>
        )}

        {messages.map((message) => {
          const senderId = String(
            message.sender?._id ?? message.sender
          );
          const mine = senderId === String(currentUser?._id);
          const status = message.status || "sent";

          return (
            <div
              key={message._id}
              className={`message-row ${mine ? "mine" : ""}`}
            >
              <div className="message-bubble">
                <p>{message.text}</p>

                <div className="message-meta">
                  <span>
                    {message.createdAt
                      ? new Date(message.createdAt).toLocaleTimeString(
                          [],
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : ""}
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
                </div>
              </div>
            </div>
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
      />
    </main>
  );
}

export default ChatWindow;
