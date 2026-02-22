import Link from "next/link"
import { login } from "../actions"

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            Mario Kart Analyzer
          </Link>
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-subtitle">Sign in to access the analyzer</p>
        </div>

        <form className="auth-form">
          <div className="auth-field">
            <label htmlFor="email" className="auth-label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="you@example.com"
              className="auth-input"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="Your password"
              className="auth-input"
              minLength={6}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" formAction={login} className="auth-btn-primary">
            Sign In
          </button>
        </form>

        <p className="auth-footer">
          {"Don't have an account? "}
          <Link href="/auth/sign-up" className="auth-link">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
