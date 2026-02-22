import Link from "next/link"
import { signup } from "../actions"

export default function SignUpPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            Mario Kart Analyzer
          </Link>
          <h1 className="auth-title">Create account</h1>
          <p className="auth-subtitle">
            Sign up to start analyzing your races
          </p>
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
              placeholder="Min 6 characters"
              className="auth-input"
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" formAction={signup} className="auth-btn-primary">
            Create Account
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link href="/auth/login" className="auth-link">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
