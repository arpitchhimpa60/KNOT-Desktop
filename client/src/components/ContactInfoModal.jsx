import { useState, useEffect } from "react";
import { getUserProfile, getAvatarUrl } from "../api";

function formatMemberDate(dateStr) {
  if (!dateStr) return "Recently";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Recently";
    return d.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

function ContactInfoModal({
  isOpen,
  onClose,
  user,
  token,
  isOnline = false,
  onStartChat,
}) {
  const [profileData, setProfileData] = useState(user);

  // Sync profile data when opening modal or user prop changes, and fetch fresh details from server
  useEffect(() => {
    if (!isOpen || !user?._id) return;

    setProfileData(user);

    let cancelled = false;

    async function loadFreshProfile() {
      if (!token) return;
      try {
        const fresh = await getUserProfile(token, user._id);
        if (!cancelled && fresh) {
          setProfileData(fresh);
        }
      } catch (err) {
        console.warn("Could not load full contact profile:", err);
      }
    }

    loadFreshProfile();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?._id, token]);

  if (!isOpen || !user) return null;

  const displayUser = profileData || user;
  const username = displayUser.username || "User";
  const email = displayUser.email || "";
  const bio = displayUser.bio || "Hey there! I am using KNOT.";
  const avatarUrl = getAvatarUrl(displayUser.profilePhoto);
  const initials = username.charAt(0).toUpperCase();
  const joinedDate = formatMemberDate(displayUser.createdAt);

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-card contact-info-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Contact Info</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="contact-info-body">
          {/* Hero Profile Photo & Name */}
          <div className="contact-hero-section">
            <div className="contact-avatar-wrapper">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="contact-avatar-img"
                />
              ) : (
                <div className="contact-avatar-placeholder">{initials}</div>
              )}
              {isOnline && (
                <span className="contact-online-badge" title="Online" />
              )}
            </div>

            <h2 className="contact-name">{username}</h2>
            <div className="contact-status-pill">
              <span
                className={`contact-status-dot ${isOnline ? "online" : ""}`}
              />
              <span>{isOnline ? "Active now" : "Offline"}</span>
            </div>
          </div>

          {/* Details Tiles */}
          <div className="contact-details-list">
            <div className="contact-detail-tile">
              <div className="contact-tile-icon">💬</div>
              <div className="contact-tile-content">
                <span className="contact-tile-label">About</span>
                <p className="contact-tile-value">{bio}</p>
              </div>
            </div>

            <div className="contact-detail-tile">
              <div className="contact-tile-icon">✉️</div>
              <div className="contact-tile-content">
                <span className="contact-tile-label">Email Address</span>
                <p className="contact-tile-value selectable">{email}</p>
              </div>
            </div>

            <div className="contact-detail-tile">
              <div className="contact-tile-icon">📅</div>
              <div className="contact-tile-content">
                <span className="contact-tile-label">Joined</span>
                <p className="contact-tile-value">Member since {joinedDate}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="contact-actions-row">
            {onStartChat && (
              <button
                type="button"
                className="contact-action-btn primary"
                onClick={() => {
                  onStartChat(displayUser);
                  onClose();
                }}
              >
                Send Message
              </button>
            )}
            <button
              type="button"
              className="contact-action-btn secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ContactInfoModal;
