
import { useState } from "react";
import { loginUser, signupUser } from "../api";

function Login({ onLogin }) {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-brand">KNOT</div>
        <p className="auth-subtitle">
          Your conversations, connected.
        </p>

        <h2>{isSignup ? "Create your account" : "Welcome back"}</h2>
        <p className="auth-description">
          {isSignup
            ? "Join KNOT and start connecting."
            : "Log in to continue your conversations."}
        </p>

        {isSignup && (
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Choose a username"
              autoComplete="username"
              required
            />
          </label>
        )}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
          />
        </label>

        {error && <p className="auth-error">{error}</p>}

        {success && (
          <p className="auth-success">{success}</p>
        )}

        <button
          className="auth-submit"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : isSignup
              ? "Create account"
              : "Log in"}
        </button>

        <p className="auth-switch">
          {isSignup
            ? "Already have an account?"
            : "New to KNOT?"}{" "}
          <button
            type="button"
            className="auth-link"
            onClick={toggleForm}
          >
            {isSignup ? "Log in" : "Create account"}
          </button>
        </p>
      </form>
    </main>
  );
}

export default Login;
