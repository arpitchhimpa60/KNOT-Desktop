import { useState } from "react";
import { loginUser, signupUser } from "../api";

function UserIcon() {
  return (
    <svg
      className="auth-input-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      className="auth-input-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="auth-input-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ isVisible }) {
  if (isVisible) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function KnotLeafLogo() {
  return (
    <svg
      className="auth-logo-svg"
      width="48"
      height="48"
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
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CardLeafCornerLeft() {
  return (
    <svg
      className="card-leaf-corner-svg top-left"
      viewBox="0 0 160 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cardBranchGradL" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#68d391" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#2FA84F" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#176B38" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="cardLeafSoftL" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a3ebb6" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#48bb78" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Main curving stems */}
      <path
        d="M0 10 Q 50 30 110 95"
        stroke="#1c4532"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
        fill="none"
      />
      <path
        d="M40 30 Q 90 20 135 45"
        stroke="#1c4532"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.6"
        fill="none"
      />
      {/* Leaf 1 (top hanging) */}
      <path
        d="M20 18 C 45 5 80 15 95 38 C 75 52 40 45 20 18 Z"
        fill="url(#cardBranchGradL)"
      />
      <path
        d="M20 18 Q 65 30 95 38"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.35"
        fill="none"
      />
      {/* Leaf 2 (outer branch) */}
      <path
        d="M65 24 C 95 10 135 25 145 50 C 125 60 85 50 65 24 Z"
        fill="url(#cardLeafSoftL)"
      />
      <path
        d="M65 24 Q 110 35 145 50"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.3"
        fill="none"
      />
      {/* Leaf 3 (lower hanging) */}
      <path
        d="M45 40 C 65 65 95 105 118 115 C 115 88 85 55 45 40 Z"
        fill="url(#cardBranchGradL)"
      />
      <path
        d="M45 40 Q 85 80 118 115"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.35"
        fill="none"
      />
      {/* Leaf 4 (small accent) */}
      <path
        d="M90 75 C 115 85 140 105 148 122 C 132 125 110 110 90 75 Z"
        fill="url(#cardBranchGradL)"
        opacity="0.85"
      />
      {/* Tiny floating leaf */}
      <path
        d="M125 20 C 135 15 145 22 148 18 C 144 12 133 10 125 20 Z"
        fill="#2FA84F"
        opacity="0.75"
      />
    </svg>
  );
}

function CardLeafCornerRight() {
  return (
    <svg
      className="card-leaf-corner-svg top-right"
      viewBox="0 0 160 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cardBranchGradR" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#68d391" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#2FA84F" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#176B38" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="cardLeafSoftR" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#a3ebb6" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#48bb78" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {/* Main curving stems */}
      <path
        d="M160 10 Q 110 30 50 95"
        stroke="#1c4532"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeOpacity="0.7"
        fill="none"
      />
      <path
        d="M120 30 Q 70 20 25 45"
        stroke="#1c4532"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.6"
        fill="none"
      />
      {/* Leaf 1 (top hanging) */}
      <path
        d="M140 18 C 115 5 80 15 65 38 C 85 52 120 45 140 18 Z"
        fill="url(#cardBranchGradR)"
      />
      <path
        d="M140 18 Q 95 30 65 38"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.35"
        fill="none"
      />
      {/* Leaf 2 (outer branch) */}
      <path
        d="M95 24 C 65 10 25 25 15 50 C 35 60 75 50 95 24 Z"
        fill="url(#cardLeafSoftR)"
      />
      <path
        d="M95 24 Q 50 35 15 50"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.3"
        fill="none"
      />
      {/* Leaf 3 (lower hanging) */}
      <path
        d="M115 40 C 95 65 65 105 42 115 C 45 88 75 55 115 40 Z"
        fill="url(#cardBranchGradR)"
      />
      <path
        d="M115 40 Q 75 80 42 115"
        stroke="#ffffff"
        strokeWidth="1"
        strokeOpacity="0.35"
        fill="none"
      />
      {/* Leaf 4 (small accent) */}
      <path
        d="M70 75 C 45 85 20 105 12 122 C 28 125 50 110 70 75 Z"
        fill="url(#cardBranchGradR)"
        opacity="0.85"
      />
      {/* Tiny floating leaf */}
      <path
        d="M35 20 C 25 15 15 22 12 18 C 16 12 27 10 35 20 Z"
        fill="#2FA84F"
        opacity="0.75"
      />
    </svg>
  );
}

function Login({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const data = isSignup
        ? await signupUser(username.trim(), email.trim(), password)
        : await loginUser(email.trim(), password);

      if (!data.token) {
        throw new Error("The server did not return a token.");
      }

      onLogin(data.token);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function toggleForm() {
    setIsSignup((previous) => !previous);
    setError("");
    setSuccess("");
  }

  return (
    <main className="auth-page">
      {/* Nature leaf background decorations */}
      <div className="auth-nature-bg" aria-hidden="true">
        <div className="nature-leaf-corner top-left" />
        <div className="nature-leaf-corner bottom-left" />
        <div className="nature-leaf-corner top-right" />
        <div className="nature-leaf-corner bottom-right" />
      </div>

      <div className="auth-card-container">
        {/* Card corner leaf framing as seen in reference image 1 */}
        <CardLeafCornerLeft />
        <CardLeafCornerRight />

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="auth-header">
            <div className="auth-logo-badge">
              <KnotLeafLogo />
            </div>
            <h1 className="auth-brand">KNOT</h1>
            <p className="auth-subtitle">Your conversations, connected.</p>
          </div>

          <div className="auth-form-fields">
            {isSignup && (
              <div className="auth-field-group">
                <label htmlFor="auth-username-input" className="auth-label">
                  Username
                </label>
                <div className="auth-input-wrapper">
                  <UserIcon />
                  <input
                    id="auth-username-input"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Choose a username"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>
            )}

            <div className="auth-field-group">
              <label htmlFor="auth-email-input" className="auth-label">
                {isSignup ? "Email" : "Email or Phone"}
              </label>
              <div className="auth-input-wrapper">
                {isSignup ? <MailIcon /> : <UserIcon />}
                <input
                  id="auth-email-input"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={isSignup ? "you@example.com" : "Email or Phone"}
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div className="auth-field-group">
              <label htmlFor="auth-password-input" className="auth-label">
                Password
              </label>
              <div className="auth-input-wrapper">
                <LockIcon />
                <input
                  id="auth-password-input"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon isVisible={showPassword} />
                </button>
              </div>
            </div>
          </div>

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="auth-loading-text">Please wait...</span>
            ) : isSignup ? (
              "Create account"
            ) : (
              "Login"
            )}
          </button>

          <p className="auth-switch">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              className="auth-link"
              onClick={toggleForm}
            >
              {isSignup ? "Log in" : "Create account"}
            </button>
          </p>
        </form>
      </div>
    </main>
  );
}

export default Login;
