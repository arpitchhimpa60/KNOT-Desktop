import { useEffect, useState, useRef } from "react";
import { searchUsers, getAvatarUrl } from "../api";
import { formatConversationTime as formatTime } from "../utils/dateUtils";

function getRequestPreviewText(req) {
  return (
    req.lastMessage?.text ||
    (req.lastMessage?.attachment?.originalName
      ? `📎 ${req.lastMessage.attachment.originalName}`
      : "Sent you a message")
  );
}

function getGroupPreviewText(group, currentUserId) {
  const lastMsg = group.lastMessage;
  if (!lastMsg) {
    return group.description || "No messages yet";
  }

  const senderId = String(lastMsg.sender?._id ?? lastMsg.sender);
  const isMine = senderId === String(currentUserId);
  const senderPrefix = isMine ? "You" : lastMsg.sender?.username || "Someone";
  const contentBody =
    lastMsg.text ||
    (lastMsg.attachment?.originalName
      ? `📎 ${lastMsg.attachment.originalName}`
      : "");

  return `${senderPrefix}: ${contentBody}`;
}

function KnotSmallLogo() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M32 6 C32 6 39 16 39 28 C39 36 35 41 32 43 C29 41 25 36 25 28 C25 16 32 6 32 6 Z"
        fill="#2FA84F"
      />
      <path
        d="M30 38 C28 32 20 22 10 21 C8 21 7 23 9 26 C13 32 21 38 29 40 C30 40 30 39 30 38 Z"
        fill="#176B38"
      />
      <path
        d="M34 38 C36 32 44 22 54 21 C56 21 57 23 55 26 C51 32 43 38 35 40 C34 40 34 39 34 38 Z"
        fill="#38c160"
      />
      <path
        d="M32 42 L32 50"
        stroke="#176B38"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      className="search-icon-svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function ChatNavIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
    >
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 10H6v-2h12v2zm0-3H6V7h12v2z" />
    </svg>
  );
}

function ContactsNavIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SettingsNavIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function Sidebar({
  selectedUser,
  onSelectUser,
  selectedGroup,
  onSelectGroup,
  groups = [],
  loadingGroups = false,
  groupsError = "",
  onOpenCreateGroup,
  conversations = [],
  conversationRequests = [],
  loadingConversations = false,
  currentUser,
  onLogout,
  onOpenProfile,
  token,
  onlineUserIds = [],
  theme = "light",
  onToggleTheme,
}) {
  const [activeTab, setActiveTab] = useState("chats"); // "chats" | "contacts"
  const [activeFilter, setActiveFilter] = useState("all"); // "all" | "unread"
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      const searchTerm = query.trim();

      if (searchTerm.length < 2) {
        setUsers([]);
        setSearchError("");
        setLoadingUsers(false);
        return;
      }

      setLoadingUsers(true);
      setSearchError("");

      try {
        const results = await searchUsers(token, searchTerm);

        if (!cancelled) {
          setUsers(results);
        }
      } catch (err) {
        if (!cancelled) {
          setUsers([]);
          setSearchError(err.message || "Failed to search users.");
        }
      } finally {
        if (!cancelled) {
          setLoadingUsers(false);
        }
      }
    }

    loadUsers();

    return () => {
      cancelled = true;
    };
  }, [query, token]);

  // Keyboard shortcut Cmd/Ctrl + K to focus search
  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isSearching = query.trim().length >= 2;

  // Filter conversations based on "All" or "Unread" tab
  const displayedConversations =
    activeFilter === "unread"
      ? conversations.filter((c) => (c.unreadCount || 0) > 0)
      : conversations;

  const isSelectedUserInConversations = conversations.some(
    (c) => String(c.user?._id) === String(selectedUser?._id)
  );
  const isSelectedUserInRequests = conversationRequests.some(
    (r) => String(r.user?._id) === String(selectedUser?._id)
  );
  const isSelectedUserUnsaved =
    selectedUser &&
    !isSelectedUserInConversations &&
    !isSelectedUserInRequests;

  return (
    <aside className="sidebar-container">
      {/* 4.A. Left Navigation Rail */}
      <nav className="nav-rail" aria-label="Main Navigation">
        <div className="nav-rail-top">
          <button
            type="button"
            className={`nav-rail-item ${activeTab === "chats" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("chats");
              setQuery("");
            }}
            title="Chats"
            aria-label="Chats"
          >
            <div className="nav-rail-icon-wrapper">
              <ChatNavIcon />
            </div>
          </button>

          <button
            type="button"
            className={`nav-rail-item ${activeTab === "contacts" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("contacts");
              if (searchInputRef.current) {
                searchInputRef.current.focus();
              }
            }}
            title="Contacts"
            aria-label="Contacts"
          >
            <div className="nav-rail-icon-wrapper">
              <ContactsNavIcon />
            </div>
          </button>

          <button
            type="button"
            className="nav-rail-item"
            onClick={onOpenProfile}
            title="Settings & Profile"
            aria-label="Settings"
          >
            <div className="nav-rail-icon-wrapper">
              <SettingsNavIcon />
            </div>
          </button>

          {onToggleTheme && (
            <button
              type="button"
              className="nav-rail-item theme-rail-btn"
              onClick={onToggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
              aria-label="Toggle theme"
            >
              <div className="nav-rail-icon-wrapper">
                {theme === "dark" ? "☀️" : "🌙"}
              </div>
            </button>
          )}
        </div>

        <div className="nav-rail-bottom">
          <div
            className="nav-rail-avatar clickable"
            onClick={onOpenProfile}
            title={`${currentUser?.username || "You"} · Click to view profile`}
          >
            {currentUser?.profilePhoto ? (
              <img
                src={getAvatarUrl(currentUser.profilePhoto)}
                alt={currentUser.username}
                className="nav-rail-avatar-img"
              />
            ) : (
              (currentUser?.username || "?").charAt(0).toUpperCase()
            )}
            <span className="online-dot nav-online-dot" />
          </div>
        </div>
      </nav>

      {/* 4.B. Conversation Sidebar */}
      <div className="sidebar-main">
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand-wrapper">
            <KnotSmallLogo />
            <h1 className="sidebar-brand-title">KNOT</h1>
          </div>
          <button
            type="button"
            className="sidebar-profile-action-btn"
            onClick={onOpenProfile}
            title="Edit Profile"
          >
            Profile
          </button>
        </div>

        {/* Search Bar with ⌘ K shortcut badge */}
        <div className="sidebar-search-container">
          <div className="search-input-wrapper">
            <SearchIcon />
            <input
              ref={searchInputRef}
              className="search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search conversations..."
              aria-label="Search conversations"
            />
            {!isSearching && (
              <span className="search-shortcut-badge" title="Shortcut: Cmd+K">
                ⌘ K
              </span>
            )}
            {query && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setQuery("")}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills: Messages (All / Unread) */}
        {!isSearching && (
          <div className="conversation-filter-section">
            <h2 className="messages-section-title">Messages</h2>
            <div className="filter-pill-group">
              <button
                type="button"
                className={`filter-pill ${activeFilter === "all" ? "active" : ""}`}
                onClick={() => setActiveFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-pill ${activeFilter === "unread" ? "active" : ""}`}
                onClick={() => setActiveFilter("unread")}
              >
                Unread
              </button>
            </div>
          </div>
        )}

        <div className="sidebar-scrollable-content">
          {/* SEARCH RESULTS VIEW */}
          {isSearching ? (
            <div className="search-results-section">
              <div className="section-label">SEARCH RESULTS</div>
              <div className="user-list">
                {loadingUsers ? (
                  <p className="search-hint">Searching people...</p>
                ) : searchError ? (
                  <p className="search-error">{searchError}</p>
                ) : users.length === 0 ? (
                  <p className="search-hint">No users found.</p>
                ) : (
                  users.map((user) => {
                    const username = user.username || "User";
                    const initials = username.charAt(0).toUpperCase();
                    const isOnline = onlineUserIds.includes(String(user._id));
                    const userAvatar = getAvatarUrl(user.profilePhoto);

                    return (
                      <button
                        key={user._id}
                        type="button"
                        className={`user-item ${
                          String(selectedUser?._id) === String(user._id)
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => {
                          onSelectUser(user);
                          setQuery("");
                        }}
                      >
                        <div className="avatar">
                          {userAvatar ? (
                            <img
                              src={userAvatar}
                              alt={username}
                              className="avatar-img"
                            />
                          ) : (
                            initials
                          )}
                          {isOnline && <span className="online-dot" />}
                        </div>

                        <div className="user-info">
                          <strong className="user-name">{username}</strong>
                          <span className="user-status-text">
                            {isOnline ? "Online" : "Offline"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <>
              {/* NEW CONVERSATION REQUESTS */}
              {conversationRequests.length > 0 && (
                <div className="conversation-requests-container">
                  <div className="section-label-row">
                    <span className="section-label requests-header-label">
                      NEW REQUESTS
                    </span>
                    <span className="requests-count-badge">
                      {conversationRequests.length} NEW
                    </span>
                  </div>

                  <div className="requests-list">
                    {conversationRequests.map((req) => {
                      const isSelected =
                        String(selectedUser?._id) === String(req.user?._id);
                      const isOnline = onlineUserIds.includes(
                        String(req.user?._id)
                      );
                      const initials = (req.user?.username || "?")
                        .charAt(0)
                        .toUpperCase();
                      const reqAvatar = getAvatarUrl(req.user?.profilePhoto);

                      return (
                        <button
                          key={req._id || req.user?._id}
                          type="button"
                          className={`user-item request-item ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => onSelectUser(req.user)}
                        >
                          <div className="avatar request-avatar">
                            {reqAvatar ? (
                              <img
                                src={reqAvatar}
                                alt={req.user?.username}
                                className="avatar-img"
                              />
                            ) : (
                              initials
                            )}
                            {isOnline && <span className="online-dot" />}
                          </div>

                          <div className="user-info">
                            <div className="conversation-title-row">
                              <strong className="user-name">
                                {req.user?.username || "User"}
                              </strong>
                              <span className="conversation-time">
                                {formatTime(req.latestActivity)}
                              </span>
                            </div>

                            <div className="conversation-subtitle-row">
                              <span className="conversation-preview-text request-preview">
                                {getRequestPreviewText(req)}
                              </span>
                              {req.unreadCount > 0 && (
                                <span className="unread-count-pill request-pill">
                                  {req.unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* RECENT CONVERSATIONS */}
              <div className="conversations-list">
                {isSelectedUserUnsaved && (
                  <button
                    type="button"
                    className="user-item selected new-unsaved-item"
                    onClick={() => onSelectUser(selectedUser)}
                  >
                    <div className="avatar">
                      {(selectedUser.username || "?").charAt(0).toUpperCase()}
                      {onlineUserIds.includes(String(selectedUser._id)) && (
                        <span className="online-dot" />
                      )}
                    </div>
                    <div className="user-info">
                      <div className="conversation-title-row">
                        <strong className="user-name">
                          {selectedUser.username}
                        </strong>
                        <span className="conversation-time">Draft</span>
                      </div>
                      <span className="conversation-preview-text unsent-hint">
                        Send a message to start conversation
                      </span>
                    </div>
                  </button>
                )}

                {loadingConversations ? (
                  <p className="search-hint">Loading conversations...</p>
                ) : displayedConversations.length === 0 && !isSelectedUserUnsaved ? (
                  <p className="search-hint">
                    {activeFilter === "unread"
                      ? "No unread conversations."
                      : "No conversations yet. Search people above to start chatting."}
                  </p>
                ) : (
                  displayedConversations.map((conv) => {
                    const isSelected =
                      String(selectedUser?._id) === String(conv.user?._id);
                    const isOnline = onlineUserIds.includes(
                      String(conv.user?._id)
                    );
                    const initials = (conv.user?.username || "?")
                      .charAt(0)
                      .toUpperCase();

                    const isMine =
                      String(conv.lastMessage?.sender) ===
                      String(currentUser?._id);
                    const status = conv.lastMessage?.status || "sent";
                    const isDeleted = Boolean(conv.lastMessage?.deleted);
                    const hasAttachment = Boolean(
                      conv.lastMessage?.attachment?.originalName
                    );
                    const attachmentName =
                      conv.lastMessage?.attachment?.originalName;
                    const convAvatar = getAvatarUrl(conv.user?.profilePhoto);

                    return (
                      <button
                        key={conv._id || conv.user?._id}
                        type="button"
                        className={`user-item conversation-item ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => onSelectUser(conv.user)}
                      >
                        <div className="avatar">
                          {convAvatar ? (
                            <img
                              src={convAvatar}
                              alt={conv.user?.username}
                              className="avatar-img"
                            />
                          ) : (
                            initials
                          )}
                          {isOnline && <span className="online-dot" />}
                        </div>

                        <div className="user-info">
                          <div className="conversation-title-row">
                            <strong className="user-name">
                              {conv.user?.username || "User"}
                            </strong>
                            <span className="conversation-time">
                              {formatTime(conv.latestActivity)}
                            </span>
                          </div>

                          <div className="conversation-subtitle-row">
                            <span
                              className={`conversation-preview-text ${
                                isDeleted ? "deleted" : ""
                              }`}
                            >
                              {isMine && !isDeleted && (
                                <span
                                  className={`preview-status ${
                                    status === "read" ? "read" : ""
                                  }`}
                                  title={status}
                                  aria-label={status}
                                >
                                  {status === "sent" ? "✓" : "✓✓"}
                                </span>
                              )}
                              {isMine && !isDeleted && (
                                <span className="preview-sender">You: </span>
                              )}
                              {hasAttachment && !isDeleted && (
                                <span className="preview-attachment-indicator">
                                  📎{" "}
                                </span>
                              )}
                              <span className="preview-message-body">
                                {isDeleted
                                  ? "This message was deleted"
                                  : conv.lastMessage?.text ||
                                    attachmentName ||
                                    "No messages"}
                              </span>
                            </span>

                            {conv.unreadCount > 0 && (
                              <span className="unread-count-pill">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* GROUPS SECTION */}
              <div className="groups-section">
                <div className="section-label-row">
                  <span className="section-label">GROUPS</span>
                  <button
                    type="button"
                    className="create-group-btn"
                    onClick={onOpenCreateGroup}
                    title="Create a new group"
                  >
                    + New Group
                  </button>
                </div>

                <div className="groups-list">
                  {loadingGroups ? (
                    <p className="search-hint">Loading groups...</p>
                  ) : groupsError ? (
                    <p className="search-error">{groupsError}</p>
                  ) : groups.length === 0 ? (
                    <div className="empty-groups-notice">
                      <p className="search-hint">No groups yet.</p>
                      <button
                        type="button"
                        className="inline-create-group-btn"
                        onClick={onOpenCreateGroup}
                      >
                        Create your first group
                      </button>
                    </div>
                  ) : (
                    groups.map((group) => {
                      const isSelected =
                        String(selectedGroup?._id) === String(group._id);
                      const lastMsgText = getGroupPreviewText(
                        group,
                        currentUser?._id
                      );

                      return (
                        <button
                          key={group._id}
                          type="button"
                          className={`user-item group-item ${
                            isSelected ? "selected" : ""
                          }`}
                          onClick={() => onSelectGroup(group)}
                        >
                          <div className="avatar group-avatar">
                            {(group.name || "G").charAt(0).toUpperCase()}
                          </div>

                          <div className="user-info">
                            <div className="group-title-row">
                              <strong className="user-name">{group.name}</strong>
                              <span className="member-count-badge">
                                {group.members?.length || 1}
                              </span>
                            </div>
                            <span className="group-last-message-preview">
                              {lastMsgText}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <span className="status-dot" />
          <span>KNOT Nature Desktop</span>
          <button
            type="button"
            className="sidebar-logout-btn"
            onClick={onLogout}
            title="Log out"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
