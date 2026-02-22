import Link from "next/link"

export default function SignUpSuccessPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            Mario Kart Analyzer
          </Link>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">
            {"We've sent a confirmation link to your email address. Click the link to verify your account, then you can sign in."}
          </p>
        </div>

        <Link href="/auth/login" className="auth-btn-primary" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  )
}
