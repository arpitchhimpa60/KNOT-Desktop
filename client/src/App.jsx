
import { useState, useEffect } from "react";
import { io } from "socket.io-client";

import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { getCurrentUser,markMessageDelivered } from "./api";
import "./App.css";

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("knotToken")
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [socket, setSocket] = useState(null);

  // Verify the saved JWT and retrieve the current user.
  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!token) {
        setCurrentUser(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const user = await getCurrentUser(token);

        if (!cancelled) {
          setCurrentUser(user);
        }
      } catch (error) {
        console.error("Session verification failed:", error.message);

        if (!cancelled) {
          localStorage.removeItem("knotToken");
          setToken(null);
          setCurrentUser(null);
          setSelectedUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // Connect Socket.IO only after the session is verified.
  useEffect(() => {
    if (!token || !currentUser) {
      setOnlineUserIds([]);
      setSocket(null);
      return;
    }

    const newSocket = io("http://localhost:5001", {
      auth: { token },
    });

    setSocket(newSocket);

    newSocket.on("online-users", (userIds) => {
      setOnlineUserIds(userIds.map(String));
    });

    newSocket.on("presence-update", ({ userId, isOnline }) => {
      const id = String(userId);

      setOnlineUserIds((previous) => {
        if (isOnline) {
          return previous.includes(id) ? previous : [...previous, id];
        }

        return previous.filter((existingId) => existingId !== id);
      });
    });

    newSocket.on("new-message", handleDeliveryAcknowledgement);
    async function handleDeliveryAcknowledgement(message) {
      try {
        await markMessageDelivered(token, message._id);
      } catch (error) {
        console.error("Delivery acknowledgement failed:", error);
      }
    }
    return () => {
      newSocket.off("online-users");
      newSocket.off("presence-update");
      newSocket.off("new-message", handleDeliveryAcknowledgement);
      newSocket.disconnect();

      setSocket((currentSocket) =>
        currentSocket === newSocket ? null : currentSocket
      );
    };
  }, [token, currentUser]);

  function handleLogin(newToken) {
    localStorage.setItem("knotToken", newToken);
    setCurrentUser(null);
    setLoading(true);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem("knotToken");
    setToken(null);
    setCurrentUser(null);
    setSelectedUser(null);
    setOnlineUserIds([]);
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p>Connecting to KNOT...</p>
      </main>
    );
  }

  if (!token || !currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      <Sidebar
        selectedUser={selectedUser}
        onSelectUser={setSelectedUser}
        currentUser={currentUser}
        onLogout={handleLogout}
        token={token}
        onlineUserIds={onlineUserIds}
      />

      <ChatWindow
        selectedUser={selectedUser}
        currentUser={currentUser}
        token={token}
        socket={socket}
      />
    </div>
  );
}

export default App;
