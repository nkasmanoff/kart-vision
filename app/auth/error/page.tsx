import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>
}) {
  const { message } = await searchParams

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" className="auth-logo">
            Mario Kart Analyzer
          </Link>
          <h1 className="auth-title">Something went wrong</h1>
          <p className="auth-subtitle">
            {message || "An unexpected error occurred during authentication."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link
            href="/auth/login"
            className="auth-btn-primary"
            style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="auth-btn-secondary"
            style={{ flex: 1, textAlign: "center", textDecoration: "none" }}
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  )
}
