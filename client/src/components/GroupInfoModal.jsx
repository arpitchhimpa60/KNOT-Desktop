import { useState, useEffect } from "react";
import {
  getGroupDetails,
  updateGroupDetails,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  searchUsers,
  getAvatarUrl,
} from "../api";

function GroupInfoModal({
  isOpen,
  onClose,
  group,
  currentUser,
  token,
  onGroupUpdated,
  onGroupLeft,
}) {
  const [activeGroup, setActiveGroup] = useState(group);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editing group metadata
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Adding members
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [addingMembers, setAddingMembers] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const myId = String(currentUser?._id);
  const creatorId = String(activeGroup?.creator?._id ?? activeGroup?.creator);
  const isAdmin = Boolean(
    activeGroup?.admins?.some((a) => String(a._id ?? a) === myId)
  );
  const isCreator = myId === creatorId;

  // Refresh group details when modal opens
  useEffect(() => {
    if (!isOpen || !group?._id) return;

    let cancelled = false;
    setLoading(true);
    setError("");
    setSuccessMsg("");
    setIsEditing(false);
    setShowAddMembers(false);
    setSelectedToAdd([]);

    async function loadDetails() {
      try {
        const fresh = await getGroupDetails(token, group._id);
        if (!cancelled) {
          setActiveGroup(fresh);
          setName(fresh.name || "");
          setDescription(fresh.description || "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load group details.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDetails();

    return () => {
      cancelled = true;
    };
  }, [isOpen, group?._id, token]);

  // Search users for adding members
  useEffect(() => {
    if (!showAddMembers) return;

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
          const currentMemberIds = new Set(
            (activeGroup?.members || []).map((m) => String(m._id ?? m))
          );
          const filtered = users.filter(
            (u) =>
              !currentMemberIds.has(String(u._id)) &&
              !selectedToAdd.some((sa) => String(sa._id) === String(u._id))
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, showAddMembers, token, activeGroup?.members, selectedToAdd]);

  if (!isOpen || !activeGroup) return null;

  async function handleSaveMetadata(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Group name cannot be empty.");
      return;
    }

    setSavingEdit(true);
    setError("");
    setSuccessMsg("");

    try {
      const updated = await updateGroupDetails(token, activeGroup._id, {
        name: trimmedName,
        description: description.trim(),
      });
      setActiveGroup(updated);
      setIsEditing(false);
      setSuccessMsg("Group details updated successfully.");
      onGroupUpdated(updated);
    } catch (err) {
      setError(err.message || "Could not update group details.");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAddMembersSubmit() {
    if (selectedToAdd.length === 0) return;

    setAddingMembers(true);
    setError("");
    setSuccessMsg("");

    try {
      const memberIds = selectedToAdd.map((u) => u._id);
      const res = await addGroupMembers(token, activeGroup._id, memberIds);
      setActiveGroup(res.group);
      setSelectedToAdd([]);
      setSearchQuery("");
      setShowAddMembers(false);
      setSuccessMsg(`Added ${res.addedCount} new member(s).`);
      onGroupUpdated(res.group);
    } catch (err) {
      setError(err.message || "Failed to add members.");
    } finally {
      setAddingMembers(false);
    }
  }

  async function handleRemoveMember(memberId, username) {
    if (actionLoading) return;
    const confirmRemoval = window.confirm(
      `Are you sure you want to remove ${username} from the group?`
    );
    if (!confirmRemoval) return;

    setActionLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      const res = await removeGroupMember(token, activeGroup._id, memberId);
      setActiveGroup(res.group);
      setSuccessMsg(`Removed ${username} from the group.`);
      onGroupUpdated(res.group);
    } catch (err) {
      setError(err.message || "Could not remove member.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeaveGroup() {
    if (actionLoading) return;
    const confirmLeave = window.confirm(
      "Are you sure you want to leave this group?"
    );
    if (!confirmLeave) return;

    setActionLoading(true);
    setError("");

    try {
      await leaveGroup(token, activeGroup._id);
      onGroupLeft(activeGroup._id);
      onClose();
    } catch (err) {
      setError(err.message || "Could not leave group.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeleteGroup() {
    if (actionLoading) return;
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this group? All messages and history will be permanently erased."
    );
    if (!confirmDelete) return;

    setActionLoading(true);
    setError("");

    try {
      await deleteGroup(token, activeGroup._id);
      onGroupLeft(activeGroup._id);
      onClose();
    } catch (err) {
      setError(err.message || "Could not delete group.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card group-info-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Group Details</h2>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="modal-error">{error}</p>}
        {successMsg && <p className="modal-success">{successMsg}</p>}

        {loading ? (
          <p className="search-hint">Loading group details...</p>
        ) : (
          <div className="group-info-body">
            {/* Header / Overview */}
            <div className="group-info-overview">
              <div className="avatar large group-avatar-display">
                {(activeGroup.name || "G").charAt(0).toUpperCase()}
              </div>

              {!isEditing ? (
                <div className="group-overview-text">
                  <h3>{activeGroup.name}</h3>
                  <p className="group-desc-text">
                    {activeGroup.description || "No description provided."}
                  </p>
                  {isAdmin && (
                    <button
                      type="button"
                      className="edit-details-link"
                      onClick={() => {
                        setIsEditing(true);
                        setError("");
                      }}
                    >
                      ✏ Edit Name & Description
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSaveMetadata} className="edit-metadata-form">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Group name"
                    maxLength={100}
                    required
                    disabled={savingEdit}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    maxLength={500}
                    rows={2}
                    disabled={savingEdit}
                  />
                  <div className="edit-metadata-actions">
                    <button
                      type="submit"
                      disabled={savingEdit || !name.trim()}
                      className="save-btn"
                    >
                      {savingEdit ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      disabled={savingEdit}
                      className="cancel-btn"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Members Section */}
            <div className="group-members-section">
              <div className="section-title-row">
                <h4>Members ({activeGroup.members?.length || 0})</h4>
                {isAdmin && !showAddMembers && (
                  <button
                    type="button"
                    className="add-member-toggle-btn"
                    onClick={() => {
                      setShowAddMembers(true);
                      setError("");
                    }}
                  >
                    + Add Member
                  </button>
                )}
              </div>

              {/* Add Member inline form */}
              {showAddMembers && (
                <div className="add-member-panel">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search people to add..."
                    autoFocus
                    disabled={addingMembers}
                  />

                  {selectedToAdd.length > 0 && (
                    <div className="selected-chips-container">
                      {selectedToAdd.map((user) => (
                        <span key={user._id} className="member-chip">
                          <span className="chip-name">{user.username}</span>
                          <button
                            type="button"
                            className="chip-remove-btn"
                            onClick={() =>
                              setSelectedToAdd((prev) =>
                                prev.filter((u) => String(u._id) !== String(user._id))
                              )
                            }
                            disabled={addingMembers}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {searchQuery.trim().length >= 2 && (
                    <div className="modal-user-search-results compact">
                      {searching ? (
                        <p className="search-hint">Searching...</p>
                      ) : searchResults.length === 0 ? (
                        <p className="search-hint">No matching users found.</p>
                      ) : (
                        searchResults.map((user) => (
                          <div
                            key={user._id}
                            className="modal-user-result-item"
                            onClick={() => {
                              setSelectedToAdd((prev) => [...prev, user]);
                              setSearchResults((prev) =>
                                prev.filter((u) => String(u._id) !== String(user._id))
                              );
                              setSearchQuery("");
                            }}
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

                  <div className="add-panel-actions">
                    <button
                      type="button"
                      className="modal-submit-btn compact"
                      onClick={handleAddMembersSubmit}
                      disabled={selectedToAdd.length === 0 || addingMembers}
                    >
                      {addingMembers ? "Adding..." : `Confirm Add (${selectedToAdd.length})`}
                    </button>
                    <button
                      type="button"
                      className="modal-cancel-btn compact"
                      onClick={() => {
                        setShowAddMembers(false);
                        setSelectedToAdd([]);
                        setSearchQuery("");
                      }}
                      disabled={addingMembers}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Members List */}
              <div className="group-members-list">
                {activeGroup.members?.map((member) => {
                  const mId = String(member._id ?? member);
                  const isMemCreator = mId === creatorId;
                  const isMemAdmin = activeGroup.admins?.some(
                    (a) => String(a._id ?? a) === mId
                  );
                  const canRemove =
                    isAdmin &&
                    mId !== myId &&
                    !isMemCreator &&
                    !(isMemAdmin && activeGroup.admins?.length === 1);

                  const memberAvatar = getAvatarUrl(member.profilePhoto);

                  return (
                    <div key={mId} className="group-member-row">
                      {memberAvatar ? (
                        <img
                          src={memberAvatar}
                          alt={member.username}
                          className="avatar small image-avatar"
                        />
                      ) : (
                        <div className="avatar small">
                          {(member.username || "?").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="user-info">
                        <div className="member-name-badges">
                          <strong className="member-username">{member.username}</strong>
                          {isMemCreator && <span className="badge creator">Creator</span>}
                          {!isMemCreator && isMemAdmin && (
                            <span className="badge admin">Admin</span>
                          )}
                          {mId === myId && <span className="badge you">You</span>}
                        </div>
                        <span className="member-email">{member.email}</span>
                      </div>

                      {canRemove && (
                        <button
                          type="button"
                          className="remove-member-btn"
                          onClick={() => handleRemoveMember(mId, member.username)}
                          disabled={actionLoading}
                          title={`Remove ${member.username}`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions: Leave and Delete */}
            <div className="group-danger-actions">
              <button
                type="button"
                className="leave-group-btn"
                onClick={handleLeaveGroup}
                disabled={actionLoading}
              >
                Leave Group
              </button>

              {(isCreator || isAdmin) && (
                <button
                  type="button"
                  className="delete-group-btn"
                  onClick={handleDeleteGroup}
                  disabled={actionLoading}
                >
                  Delete Group
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GroupInfoModal;
