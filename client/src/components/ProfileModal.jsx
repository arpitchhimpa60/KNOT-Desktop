import { useState, useEffect, useRef } from "react";
import { updateProfile, uploadAvatar, removeAvatar, getAvatarUrl } from "../api";

const PRESET_BIOS = [
  "Hey there! I am using KNOT.",
  "Available",
  "Busy",
  "At work",
  "In a meeting",
  "Battery about to die 🪫",
];

function ProfileModal({
  isOpen,
  onClose,
  currentUser,
  token,
  onProfileUpdated,
}) {
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [currentPhoto, setCurrentPhoto] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    setUsername(currentUser.username || "");
    setBio(currentUser.bio || "Hey there! I am using KNOT.");
    setCurrentPhoto(currentUser.profilePhoto || "");
    setSelectedFile(null);
    setPreviewUrl(null);
    setError("");
    setSuccessMsg("");
    setSaving(false);
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate size (under 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be smaller than 10 MB.");
      return;
    }

    // Validate image mime type
    if (!file.type.startsWith("image/")) {
      setError("Please choose a valid image file.");
      return;
    }

    setError("");
    setSelectedFile(file);

    // Create instant local preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleRemovePhoto() {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCurrentPhoto("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 2) {
      setError("Username must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");

    try {
      let updatedUser = currentUser;

      // 1. If user removed their photo
      if (!selectedFile && !currentPhoto && currentUser.profilePhoto) {
        const res = await removeAvatar(token);
        updatedUser = res.user || updatedUser;
      }

      // 2. If user picked a new photo file
      if (selectedFile) {
        const res = await uploadAvatar(token, selectedFile);
        updatedUser = res.user || updatedUser;
      }

      // 3. Update username and bio
      const profileRes = await updateProfile(token, {
        username: trimmedUsername,
        bio: bio.trim(),
      });

      updatedUser = profileRes || updatedUser;

      setSuccessMsg("Profile updated successfully!");
      if (onProfileUpdated) {
        onProfileUpdated(updatedUser);
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError(err.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  const effectiveAvatar =
    previewUrl ||
    (currentPhoto ? getAvatarUrl(currentPhoto) : null);
  const initials = (username || "?").charAt(0).toUpperCase();

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card profile-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Your Profile</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="profile-modal-body">
          {error && <p className="modal-error">{error}</p>}
          {successMsg && <p className="modal-success">{successMsg}</p>}

          {/* Profile Picture Upload Section */}
          <div className="profile-dp-section">
            <div
              className="profile-dp-wrapper"
              onClick={() => fileInputRef.current?.click()}
              title="Click to change profile photo"
            >
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt={username}
                  className="profile-dp-img"
                />
              ) : (
                <div className="profile-dp-placeholder">{initials}</div>
              )}

              <div className="profile-dp-overlay">
                <span className="camera-icon">📷</span>
                <span className="change-text">Change</span>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            <div className="profile-dp-actions">
              <button
                type="button"
                className="dp-action-btn upload"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Photo
              </button>

              {(effectiveAvatar || currentPhoto) && (
                <button
                  type="button"
                  className="dp-action-btn remove"
                  onClick={handleRemovePhoto}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* User Details Fields */}
          <div className="profile-form-group">
            <label htmlFor="profile-username-input">
              Your Name / Username
            </label>
            <div className="input-with-counter">
              <input
                id="profile-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={30}
                required
                disabled={saving}
                placeholder="Enter your name"
              />
              <span className="char-count">{username.length}/30</span>
            </div>
            <p className="field-hint">
              This name will be visible to your KNOT contacts.
            </p>
          </div>

          <div className="profile-form-group">
            <label htmlFor="profile-bio-input">About / Status</label>
            <div className="input-with-counter">
              <textarea
                id="profile-bio-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={250}
                rows={2}
                disabled={saving}
                placeholder="What's on your mind?"
              />
              <span className="char-count">{bio.length}/250</span>
            </div>

            {/* Quick Status Presets */}
            <div className="preset-bio-chips">
              {PRESET_BIOS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-chip ${bio === preset ? "active" : ""}`}
                  onClick={() => setBio(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="profile-form-group">
            <label>Email Address</label>
            <input
              type="text"
              value={currentUser.email || ""}
              readOnly
              disabled
              className="readonly-email-input"
            />
            <p className="field-hint">Email address cannot be changed.</p>
          </div>

          <div className="profile-modal-footer">
            <button
              type="button"
              className="profile-modal-btn cancel"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="profile-modal-btn save"
              disabled={saving || !username.trim()}
            >
              {saving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProfileModal;
