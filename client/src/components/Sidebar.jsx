
import { useEffect, useState } from "react";
import { searchUsers } from "../api";

function Sidebar({
  selectedUser,
  onSelectUser,
  currentUser,
  onLogout,
  token,
  onlineUserIds = [],
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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <h1>KNOT</h1>
          <p>Your conversations, connected.</p>
        </div>

        <div
          className="profile-avatar"
          title={currentUser?.email || ""}
        >
          {(currentUser?.username || "?").charAt(0).toUpperCase()}
        </div>
      </div>

      <div className="account-info">
        <span>
          Signed in as <strong>{currentUser?.username || "User"}</strong>
        </span>

        <button type="button" onClick={onLogout}>
          Log out
        </button>
      </div>

      <input
        className="search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search people..."
        aria-label="Search people"
      />

      <div className="section-label">
        {query.trim().length >= 2 ? "SEARCH RESULTS" : "MESSAGES"}
      </div>

      <div className="user-list">
        {query.trim().length < 2 ? (
          <p className="search-hint">
            Type at least 2 characters to find people.
          </p>
        ) : loadingUsers ? (
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

            return (
              <button
                key={user._id}
                type="button"
                className={`user-item ${
                  String(selectedUser?._id) === String(user._id)
                    ? "selected"
                    : ""
                }`}
                onClick={() => onSelectUser(user)}
              >
                <div className="avatar">
                  {initials}
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

      <div className="sidebar-footer">
        <span className="status-dot" />
        KNOT is ready
      </div>
    </aside>
  );
}

export default Sidebar;
