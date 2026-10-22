import { useState, useEffect } from "react";
import { searchUsers, createGroup } from "../api";

function CreateGroupModal({ isOpen, onClose, onGroupCreated, token, currentUser }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setSearchQuery("");
      setSearchResults([]);
      setSelectedMembers([]);
      setError("");
    }
  }, [isOpen]);

  // Debounced search for users
  useEffect(() => {
    if (!isOpen) return;

    const query = searchQuery.trim();
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      try {
        const users = await searchUsers(token, query);
        if (!cancelled) {
          // Filter out current user (who is automatically creator/admin)
          // and users already in selectedMembers
          const filtered = users.filter(
            (u) =>
              String(u._id) !== String(currentUser?._id) &&
              !selectedMembers.some((sm) => String(sm._id) === String(u._id))
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Search error in modal:", err);
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen, token, currentUser, selectedMembers]);

  if (!isOpen) return null;

  function handleSelectMember(user) {
    setSelectedMembers((prev) => [...prev, user]);
    setSearchResults((prev) => prev.filter((u) => String(u._id) !== String(user._id)));
    setSearchQuery("");
  }

  function handleRemoveMember(userId) {
    setSelectedMembers((prev) => prev.filter((u) => String(u._id) !== String(userId)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Group name is required.");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Group name cannot exceed 100 characters.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const memberIds = selectedMembers.map((m) => m._id);
      const newGroup = await createGroup(token, {
        name: trimmedName,
        description: description.trim(),
        memberIds,
      });

      onGroupCreated(newGroup);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create group.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card create-group-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Group</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <form onSubmit={handleSubmit} className="create-group-form">
          <div className="modal-body create-group-body">
            <div className="form-group">
              <label htmlFor="group-name-input" className="modal-form-label">
                Group Name <span className="required-star">*</span>
              </label>
              <input
                id="group-name-input"
                type="text"
                className="modal-form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Design Team, Project Alpha"
                maxLength={100}
                required
                autoFocus
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="group-desc-input" className="modal-form-label">
                Description <span className="optional-tag">(optional)</span>
              </label>
              <input
                id="group-desc-input"
                type="text"
                className="modal-form-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this group about?"
                maxLength={500}
                disabled={submitting}
              />
            </div>

            <div className="form-group members-selection-section">
              <label htmlFor="group-search-input" className="modal-form-label">
                Add Members <span className="optional-tag">(you are automatically added)</span>
              </label>

              <input
                id="group-search-input"
                type="text"
                className="modal-form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search people by username or email..."
                disabled={submitting}
              />

              {/* Selected Members Chips */}
              {selectedMembers.length > 0 && (
                <div className="selected-chips-container">
                  {selectedMembers.map((member) => (
                    <span key={member._id} className="member-chip">
                      <span className="chip-name">{member.username}</span>
                      <button
                        type="button"
                        className="chip-remove-btn"
                        onClick={() => handleRemoveMember(member._id)}
                        disabled={submitting}
                        title={`Remove ${member.username}`}
                        aria-label={`Remove ${member.username}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search Dropdown / List */}
              {searchQuery.trim().length >= 2 && (
                <div className="modal-user-search-results">
                  {searching ? (
                    <p className="search-hint">Searching...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="search-hint">No matching users found.</p>
                  ) : (
                    searchResults.map((user) => (
                      <div
                        key={user._id}
                        className="modal-user-result-item"
                        onClick={() => handleSelectMember(user)}
                      >
                        <div className="avatar small">
                          {(user.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <strong>{user.username}</strong>
                          <span>{user.email}</span>
                        </div>
                        <button type="button" className="add-member-btn">
                          + Add
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="modal-cancel-btn"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-submit-btn"
              disabled={!name.trim() || submitting}
            >
              {submitting ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
