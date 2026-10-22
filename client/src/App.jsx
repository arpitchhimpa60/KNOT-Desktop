
import { useState, useEffect, useCallback, useRef } from "react";
import { io } from "socket.io-client";

import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import GroupChatWindow from "./components/GroupChatWindow";
import CreateGroupModal from "./components/CreateGroupModal";
import ProfileModal from "./components/ProfileModal";
import ContactInfoModal from "./components/ContactInfoModal";
import {
  getCurrentUser,
  markMessageDelivered,
  fetchGroups,
  fetchConversations,
} from "./api";
import "./App.css";

function App() {
  const [token, setToken] = useState(() =>
    localStorage.getItem("knotToken")
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);

  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);

  // Profile & Contact Info modal state
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [contactInfoUser, setContactInfoUser] = useState(null);
  const [isContactInfoOpen, setIsContactInfoOpen] = useState(false);

  // Recent conversations & requests state
  const [conversations, setConversations] = useState([]);
  const [conversationRequests, setConversationRequests] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [activeToastNotification, setActiveToastNotification] = useState(null);
  const initialToastChecked = useRef(false);

  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [socket, setSocket] = useState(null);

  // Electron window/app information
  const [isMaximized, setIsMaximized] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [platform, setPlatform] = useState("");

  // Dark / Light Theme state (persisted and synced via IPC) - default light for nature theme
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("knotTheme") || "light";
  });

  // Apply data-theme attribute on document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("knotTheme", theme);
  }, [theme]);

  // Initialize Electron-specific features & theme when running in Electron.
  useEffect(() => {
    const desktop = window.knotDesktop;
    if (!desktop) return;

    let unsubscribeMax;
    let unsubscribeTheme;

    desktop.isMaximized()
      .then(setIsMaximized)
      .catch((error) => {
        console.error("Could not read window state:", error);
      });

    desktop.getVersion()
      .then(setAppVersion)
      .catch((error) => {
        console.error("Could not read app version:", error);
      });

    desktop.getPlatform()
      .then(setPlatform)
      .catch((error) => {
        console.error("Could not read platform:", error);
      });

    unsubscribeMax = desktop.onMaximizedChange(setIsMaximized);

    // Initial theme sync from Electron nativeTheme
    if (desktop.getTheme) {
      desktop.getTheme()
        .then((themeInfo) => {
          if (themeInfo) {
            const initialMode = themeInfo.shouldUseDarkColors ? "dark" : "light";
            setTheme(initialMode);
            document.documentElement.setAttribute("data-theme", initialMode);
            localStorage.setItem("knotTheme", initialMode);
          }
        })
        .catch((error) => {
          console.error("Could not read theme via IPC:", error);
        });
    }

    // Subscribe to IPC theme change broadcasts
    if (desktop.onThemeChange) {
      unsubscribeTheme = desktop.onThemeChange((themeInfo) => {
        if (themeInfo) {
          const nextMode = themeInfo.shouldUseDarkColors ? "dark" : "light";
          setTheme(nextMode);
          document.documentElement.setAttribute("data-theme", nextMode);
          localStorage.setItem("knotTheme", nextMode);
        }
      });
    }

    return () => {
      if (unsubscribeMax) unsubscribeMax();
      if (unsubscribeTheme) unsubscribeTheme();
    };
  }, []);

  const refreshGroups = useCallback(async () => {
    if (!token) return;

    setLoadingGroups(true);
    setGroupsError("");

    try {
      const list = await fetchGroups(token);
      setGroups(list);
    } catch (err) {
      setGroupsError(err.message || "Failed to load groups.");
    } finally {
      setLoadingGroups(false);
    }
  }, [token]);

  const refreshConversations = useCallback(async () => {
    if (!token) return;

    setLoadingConversations(true);

    try {
      const data = await fetchConversations(token);
      setConversations(data.conversations || []);
      setConversationRequests(data.requests || []);

      // If user logs in and has pending requests, show toast notification once
      if (
        !initialToastChecked.current &&
        data.requests &&
        data.requests.length > 0
      ) {
        initialToastChecked.current = true;
        const topReq = data.requests[0];
        setActiveToastNotification({
          id: topReq.user?._id || Date.now(),
          user: topReq.user,
          message: topReq.lastMessage?.text || "Sent you a message request",
          timestamp: topReq.latestActivity || topReq.lastMessage?.createdAt,
        });
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConversations(false);
    }
  }, [token]);

  // Auto-dismiss toast notification after 10 seconds
  useEffect(() => {
    if (!activeToastNotification) return;

    const timer = setTimeout(() => {
      setActiveToastNotification(null);
    }, 10000);

    return () => clearTimeout(timer);
  }, [activeToastNotification]);

  // Verify saved JWT and retrieve the current user.
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
          setSelectedGroup(null);
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

  // Load groups and conversations after authentication.
  useEffect(() => {
    if (token && currentUser) {
      refreshGroups();
      refreshConversations();
    } else {
      setGroups([]);
      setConversations([]);
      setConversationRequests([]);
      setActiveToastNotification(null);
      initialToastChecked.current = false;
    }
  }, [token, currentUser, refreshGroups, refreshConversations]);

  // Connect Socket.IO after the session is verified.
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
          return previous.includes(id)
            ? previous
            : [...previous, id];
        }

        return previous.filter((existingId) => existingId !== id);
      });
    });

    async function handleDeliveryAcknowledgement(message) {
      try {
        await markMessageDelivered(token, message._id);
      } catch (error) {
        console.error("Delivery acknowledgement failed:", error);
      }
    }

    function handleConversationRequest(payload) {
      refreshConversations();
      if (payload?.sender && payload?.message) {
        setActiveToastNotification({
          id: payload.sender._id || Date.now(),
          user: payload.sender,
          message: payload.message.text || "Sent you a message request",
          timestamp: payload.message.createdAt || new Date(),
        });
      }
    }

    function handleConversationUpdated() {
      refreshConversations();
    }

    function handleConversationRead(payload) {
      if (payload?.userId) {
        setConversations((previous) =>
          previous.map((c) =>
            String(c.user?._id) === String(payload.userId)
              ? { ...c, unreadCount: 0 }
              : c
          )
        );
      }
      refreshConversations();
    }

    function handleNewMessage(message) {
      handleDeliveryAcknowledgement(message);
      refreshConversations();
    }

    function handleMessageStatus({ messageId, status }) {
      setConversations((previous) =>
        previous.map((c) => {
          if (c.lastMessage && String(c.lastMessage._id) === String(messageId)) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                status,
              },
            };
          }
          return c;
        })
      );
    }

    function handleMessagesRead({ messageIds }) {
      const readSet = new Set((messageIds || []).map(String));
      setConversations((previous) =>
        previous.map((c) => {
          if (c.lastMessage && readSet.has(String(c.lastMessage._id))) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                status: "read",
              },
            };
          }
          return c;
        })
      );
    }

    newSocket.on("new-message", handleNewMessage);
    newSocket.on("message-status", handleMessageStatus);
    newSocket.on("messages-read", handleMessagesRead);
    newSocket.on("conversation:request", handleConversationRequest);
    newSocket.on("conversation:updated", handleConversationUpdated);
    newSocket.on("conversation:read", handleConversationRead);

    function handleGroupListCreated({ group }) {
      if (!group) return;

      setGroups((previous) => {
        const exists = previous.some(
          (g) => String(g._id) === String(group._id)
        );

        return exists ? previous : [group, ...previous];
      });
    }

    function handleGroupListUpdated({ groupId, group }) {
      setGroups((previous) =>
        previous.map((g) =>
          String(g._id) === String(groupId)
            ? { ...g, ...group }
            : g
        )
      );
    }

    function handleGroupListDeleted({ groupId }) {
      setGroups((previous) =>
        previous.filter((g) => String(g._id) !== String(groupId))
      );

      setSelectedGroup((current) =>
        String(current?._id) === String(groupId) ? null : current
      );
    }

    function handleGroupListMemberRemoved({
      groupId,
      removedUserId,
    }) {
      if (String(removedUserId) !== String(currentUser._id)) {
        return;
      }

      setGroups((previous) =>
        previous.filter((g) => String(g._id) !== String(groupId))
      );

      setSelectedGroup((current) =>
        String(current?._id) === String(groupId) ? null : current
      );
    }

    function handleGroupListMessage(message) {
      const groupId = String(
        message.group?._id ?? message.group
      );

      setGroups((previous) =>
        previous.map((g) =>
          String(g._id) === groupId
            ? { ...g, lastMessage: message }
            : g
        )
      );
    }

    function handleUserProfileUpdated(payload) {
      const user = payload?.user;
      if (!user) return;

      setCurrentUser((current) => {
        if (current && String(current._id) === String(user._id)) {
          return { ...current, ...user };
        }
        return current;
      });

      setSelectedUser((current) => {
        if (current && String(current._id) === String(user._id)) {
          return { ...current, ...user };
        }
        return current;
      });

      setContactInfoUser((current) => {
        if (current && String(current._id) === String(user._id)) {
          return { ...current, ...user };
        }
        return current;
      });

      refreshConversations();
    }

    newSocket.on("group:created", handleGroupListCreated);
    newSocket.on("group:updated", handleGroupListUpdated);
    newSocket.on("group:deleted", handleGroupListDeleted);
    newSocket.on(
      "group:member:removed",
      handleGroupListMemberRemoved
    );
    newSocket.on("group:message:new", handleGroupListMessage);
    newSocket.on("user:profile-updated", handleUserProfileUpdated);

    return () => {
      newSocket.off("online-users");
      newSocket.off("presence-update");
      newSocket.off("new-message", handleNewMessage);
      newSocket.off("message-status", handleMessageStatus);
      newSocket.off("messages-read", handleMessagesRead);
      newSocket.off("conversation:request", handleConversationRequest);
      newSocket.off("conversation:updated", handleConversationUpdated);
      newSocket.off("conversation:read", handleConversationRead);
      newSocket.off("group:created", handleGroupListCreated);
      newSocket.off("group:updated", handleGroupListUpdated);
      newSocket.off("group:deleted", handleGroupListDeleted);
      newSocket.off(
        "group:member:removed",
        handleGroupListMemberRemoved
      );
      newSocket.off("group:message:new", handleGroupListMessage);
      newSocket.off("user:profile-updated", handleUserProfileUpdated);

      newSocket.disconnect();

      setSocket((currentSocket) =>
        currentSocket === newSocket ? null : currentSocket
      );
    };
  }, [token, currentUser, refreshConversations]);

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
    setSelectedGroup(null);
    setGroups([]);
    setConversations([]);
    setConversationRequests([]);
    setOnlineUserIds([]);
    setActiveToastNotification(null);
    initialToastChecked.current = false;
    setIsProfileOpen(false);
    setIsContactInfoOpen(false);
    setContactInfoUser(null);
  }

  function handleOpenContactInfo(user) {
    if (!user) return;
    setContactInfoUser(user);
    setIsContactInfoOpen(true);
  }

  function handleProfileUpdated(updatedUser) {
    if (!updatedUser) return;
    setCurrentUser((prev) => ({ ...prev, ...updatedUser }));
    refreshConversations();
  }

  function handleSelectUser(user) {
    setSelectedUser(user);
    setSelectedGroup(null);

    if (String(activeToastNotification?.user?._id) === String(user?._id)) {
      setActiveToastNotification(null);
    }
  }

  function handleSelectGroup(group) {
    setSelectedGroup(group);
    setSelectedUser(null);
  }

  function handleGroupCreated(newGroup) {
    setGroups((previous) => {
      const exists = previous.some(
        (g) => String(g._id) === String(newGroup._id)
      );

      return exists ? previous : [newGroup, ...previous];
    });

    setSelectedGroup(newGroup);
    setSelectedUser(null);
  }

  function handleGroupUpdated(updatedGroup) {
    setSelectedGroup((current) =>
      String(current?._id) === String(updatedGroup._id)
        ? updatedGroup
        : current
    );

    setGroups((previous) =>
      previous.map((g) =>
        String(g._id) === String(updatedGroup._id)
          ? { ...g, ...updatedGroup }
          : g
      )
    );
  }

  function handleGroupLeft(groupId) {
    setSelectedGroup((current) =>
      String(current?._id) === String(groupId) ? null : current
    );

    setGroups((previous) =>
      previous.filter((g) => String(g._id) !== String(groupId))
    );
  }

  async function handleMinimize() {
    try {
      await window.knotDesktop?.minimize();
    } catch (error) {
      console.error("Could not minimize KNOT:", error);
    }
  }

  async function handleToggleMaximize() {
    try {
      const result = await window.knotDesktop?.toggleMaximize();

      if (typeof result === "boolean") {
        setIsMaximized(result);
      }
    } catch (error) {
      console.error("Could not maximize KNOT:", error);
    }
  }

  async function handleQuit() {
    try {
      await window.knotDesktop?.confirmQuit();
    } catch (error) {
      console.error("Could not quit KNOT:", error);
    }
  }

  async function handleToggleTheme() {
    if (window.knotDesktop?.toggleTheme) {
      try {
        const result = await window.knotDesktop.toggleTheme();
        const nextTheme = result.shouldUseDarkColors ? "dark" : "light";
        setTheme(nextTheme);
        document.documentElement.setAttribute("data-theme", nextTheme);
        localStorage.setItem("knotTheme", nextTheme);
        return;
      } catch (error) {
        console.error("Could not toggle theme via IPC:", error);
      }
    }

    // Fallback for non-Electron environment
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("knotTheme", nextTheme);
  }

  if (loading) {
    return (
      <main className="auth-page">
        <p>Connecting to KNOT...</p>
      </main>
    );
  }

  if (!token || !currentUser) {
    return (
      <div className="app-shell">
        <header className="knot-window-bar">
          <div className="knot-window-left">
            <div className="mac-traffic-dots">
              <button type="button" className="mac-dot mac-dot-close" onClick={handleQuit} title="Quit KNOT" aria-label="Quit" />
              <button type="button" className="mac-dot mac-dot-minimize" onClick={handleMinimize} title="Minimize" aria-label="Minimize" />
              <button type="button" className="mac-dot mac-dot-maximize" onClick={handleToggleMaximize} title="Maximize" aria-label="Maximize" />
            </div>
            <div className="knot-window-brand">
              <img src="/knot-logo.svg" alt="" className="knot-bar-leaf-icon" width="16" height="16" />
              <span className="knot-window-title">KNOT</span>
            </div>
          </div>

          <div className="knot-window-controls">
            <button
              type="button"
              className="knot-theme-toggle-btn"
              onClick={handleToggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode (IPC)`}
              aria-label="Toggle dark/light theme"
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </button>
          </div>
        </header>

        <Login onLogin={handleLogin} />
      </div>
    );
  }

  const isSelectedUserRequest = conversationRequests.some(
    (r) => String(r.user?._id) === String(selectedUser?._id)
  );

  return (
    <div className="app-shell">
      <header className="knot-window-bar">
        <div className="knot-window-left">
          <div className="mac-traffic-dots">
            <button type="button" className="mac-dot mac-dot-close" onClick={handleQuit} title="Quit KNOT" aria-label="Quit" />
            <button type="button" className="mac-dot mac-dot-minimize" onClick={handleMinimize} title="Minimize" aria-label="Minimize" />
            <button type="button" className="mac-dot mac-dot-maximize" onClick={handleToggleMaximize} title="Maximize" aria-label="Maximize" />
          </div>
          <div className="knot-window-brand">
            <img src="/knot-logo.svg" alt="" className="knot-bar-leaf-icon" width="16" height="16" />
            <span className="knot-window-title">KNOT</span>
          </div>
        </div>

        <div className="knot-window-controls">
          <button
            type="button"
            className="knot-theme-toggle-btn"
            onClick={handleToggleTheme}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode (IPC)`}
            aria-label="Toggle dark/light theme"
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        </div>
      </header>

      <div className="knot-app-content">
        <Sidebar
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          selectedGroup={selectedGroup}
          onSelectGroup={handleSelectGroup}
          groups={groups}
          loadingGroups={loadingGroups}
          groupsError={groupsError}
          onOpenCreateGroup={() => setIsCreateGroupOpen(true)}
          conversations={conversations}
          conversationRequests={conversationRequests}
          loadingConversations={loadingConversations}
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenProfile={() => setIsProfileOpen(true)}
          token={token}
          onlineUserIds={onlineUserIds}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {selectedGroup ? (
          <GroupChatWindow
            selectedGroup={selectedGroup}
            currentUser={currentUser}
            token={token}
            socket={socket}
            onGroupUpdated={handleGroupUpdated}
            onGroupLeft={handleGroupLeft}
          />
        ) : (
          <ChatWindow
            selectedUser={selectedUser}
            currentUser={currentUser}
            token={token}
            socket={socket}
            isRequest={isSelectedUserRequest}
            onConversationUpdated={refreshConversations}
            onlineUserIds={onlineUserIds}
            onOpenContactInfo={handleOpenContactInfo}
          />
        )}

        <CreateGroupModal
          isOpen={isCreateGroupOpen}
          onClose={() => setIsCreateGroupOpen(false)}
          onGroupCreated={handleGroupCreated}
          token={token}
          currentUser={currentUser}
        />

        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          currentUser={currentUser}
          token={token}
          onProfileUpdated={handleProfileUpdated}
        />

        <ContactInfoModal
          isOpen={isContactInfoOpen}
          onClose={() => {
            setIsContactInfoOpen(false);
            setContactInfoUser(null);
          }}
          user={contactInfoUser}
          token={token}
          isOnline={
            contactInfoUser
              ? onlineUserIds.includes(String(contactInfoUser._id))
              : false
          }
          onStartChat={(user) => {
            handleSelectUser(user);
          }}
        />
      </div>

      {activeToastNotification && (
        <aside
          className="toast-notification-container"
          aria-live="polite"
        >
          <div className="toast-notification">
            <div className="toast-avatar">
              {(activeToastNotification.user?.username || "?")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div className="toast-content">
              <div className="toast-header-line">
                <span className="toast-tag">New Conversation Request</span>
                <span className="toast-timestamp">
                  {activeToastNotification.timestamp
                    ? new Date(
                        activeToastNotification.timestamp
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
              <strong className="toast-sender-name">
                {activeToastNotification.user?.username || "User"}
              </strong>
              <p className="toast-preview-text">
                "{activeToastNotification.message}"
              </p>
            </div>
            <div className="toast-actions">
              <button
                type="button"
                className="toast-action-btn open"
                onClick={() => {
                  handleSelectUser(activeToastNotification.user);
                  setActiveToastNotification(null);
                }}
              >
                View
              </button>
              <button
                type="button"
                className="toast-action-btn close"
                aria-label="Dismiss notification"
                onClick={() => setActiveToastNotification(null)}
              >
                ×
              </button>
            </div>
          </div>
        </aside>
      )}

      {appVersion && platform && (
        <span className="knot-app-version">
          KNOT {appVersion} · {platform}
        </span>
      )}
    </div>
  );
}

export default App;
