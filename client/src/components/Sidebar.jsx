import { useEffect, useState } from "react";
import { searchUsers, getAvatarUrl } from "../api";
import { formatConversationTime } from "../utils/dateUtils";

function formatTime(timestamp) {
  return formatConversationTime(timestamp);
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
  theme = "dark",
  onToggleTheme,
}) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchError, setSearchError] = useState("");

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

  const isSearching = query.trim().length >= 2;

  // Check if current selected user is in the conversations or requests list
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
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <h1>KNOT</h1>
          <p>Your conversations, connected.</p>
        </div>

        <div
          className="profile-avatar clickable"
          onClick={onOpenProfile}
          title="Click to view & edit your profile"
        >
          {currentUser?.profilePhoto ? (
            <img
              src={getAvatarUrl(currentUser.profilePhoto)}
              alt={currentUser.username}
              className="profile-avatar-img"
            />
          ) : (
            (currentUser?.username || "?").charAt(0).toUpperCase()
          )}
        </div>
      </div>

      <div className="account-info">
        <span
          className="account-username-label"
          onClick={onOpenProfile}
          title="Edit your profile"
        >
          Signed in as <strong>{currentUser?.username || "User"}</strong>
        </span>

        <div className="account-actions">
          {onToggleTheme && (
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={onToggleTheme}
              title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode (IPC)`}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          )}
          <button
            type="button"
            className="profile-btn"
            onClick={onOpenProfile}
            title="Edit Profile"
          >
            Profile
          </button>
          <button type="button" onClick={onLogout} title="Log out">
            Log out
          </button>
        </div>
      </div>

      <input
        className="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people..."
        aria-label="Search people"
      />

      <div className="sidebar-scrollable-content">
        {/* If searching, display search results */}
        {isSearching ? (
          <>
            <div className="section-label">SEARCH RESULTS</div>
            <div className="user-list">
              {loadingUsers ? (
                <p className="search-hint">Searching...</p>
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
                            setQuery(""); // clear search on selection to return to recent list
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
                        <strong>{username}</strong>
                        <span>{isOnline ? "Online" : "Offline"}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* NEW CONVERSATION REQUESTS SECTION */}
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
                            <strong>{req.user?.username || "User"}</strong>
                            <span className="conversation-time">
                              {formatTime(req.latestActivity)}
                            </span>
                          </div>

                          <div className="conversation-subtitle-row">
                            <span className="conversation-preview-text request-preview">
                              {req.lastMessage?.text ||
                                (req.lastMessage?.attachment?.originalName
                                  ? `📎 ${req.lastMessage.attachment.originalName}`
                                  : "Sent you a message")}
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

            {/* RECENT CONVERSATIONS SECTION */}
            <div className="section-label-row">
              <span className="section-label">RECENT CONVERSATIONS</span>
            </div>

            <div className="conversations-list">
              {/* If a newly searched user is selected before exchanging any messages */}
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
                      <strong>{selectedUser.username}</strong>
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
              ) : conversations.length === 0 && !isSelectedUserUnsaved ? (
                <p className="search-hint">
                  No conversations yet. Search people above to start chatting.
                </p>
              ) : (
                conversations.map((conv) => {
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
                          <strong>{conv.user?.username || "User"}</strong>
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
                            {isMine && !isDeleted ? (
                              <span className="preview-sender">You: </span>
                            ) : null}
                            {hasAttachment && !isDeleted ? (
                              <span className="preview-attachment-indicator">
                                📎{" "}
                              </span>
                            ) : null}
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
                  const lastMsg = group.lastMessage;
                  const senderPrefix = lastMsg
                    ? String(lastMsg.sender?._id ?? lastMsg.sender) ===
                      String(currentUser?._id)
                      ? "You"
                      : lastMsg.sender?.username || "Someone"
                    : "";
                  const contentBody =
                    lastMsg?.text ||
                    (lastMsg?.attachment?.originalName
                      ? `📎 ${lastMsg.attachment.originalName}`
                      : "");
                  const lastMsgText = lastMsg
                    ? `${senderPrefix}: ${contentBody}`
                    : group.description || "No messages yet";

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
                          <strong>{group.name}</strong>
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
          </>
        )}
      </div>

      <div className="sidebar-footer">
        <span className="status-dot" />
        KNOT is ready
      </div>
    </aside>
  );
}

export default Sidebar;
