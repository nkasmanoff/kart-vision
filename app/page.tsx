import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import "./landing.css"

export default async function LandingPage() {
  let user = null
  let sessions: { id: string; video_name: string; created_at: string }[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
    if (user) {
      const { data: sessionsData } = await supabase
        .from("analysis_sessions")
        .select("id, video_name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      sessions = (sessionsData ?? []).map((r) => ({
        id: r.id,
        video_name: r.video_name || "Untitled",
        created_at: r.created_at,
      }))
    }
  } catch {
    // Supabase not configured yet - show landing page anyway
  }

  return (
    <div className="landing">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="landing-nav-logo">
          Mario Kart Analyzer
        </Link>
        <div className="landing-nav-links">
          <Link href="/how-it-works" className="landing-nav-link">
            How It Works
          </Link>
          {user ? (
            <Link href="/analyzer" className="landing-nav-cta">
              Open Analyzer
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="landing-nav-link">
                Log In
              </Link>
              <Link href="/auth/sign-up" className="landing-nav-cta">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      <main>
        {user ? (
          <section className="landing-sessions">
            <h1 className="landing-sessions-title">Your Sessions</h1>
            <p className="landing-sessions-desc">
              Pick a session to continue or start a new analysis.
            </p>
            <div className="landing-sessions-grid">
              <Link
                href="/analyzer"
                className="landing-session-card landing-session-card--new"
                aria-label="Add new session"
              >
                <span className="landing-session-card-icon" aria-hidden="true">
                  +
                </span>
                <span className="landing-session-card-label">Add new</span>
              </Link>
              {sessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/analyzer?session=${s.id}`}
                  className="landing-session-card"
                >
                  <span className="landing-session-card-name">
                    {s.video_name}
                  </span>
                  <span className="landing-session-card-date">
                    {new Date(s.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="landing-hero">
            <div className="landing-hero-badge" aria-hidden="true">
              Powered by Moondream AI
            </div>
            <h1>
              Analyze your Mario Kart{" "}
              <span className="accent">gameplay footage</span>
            </h1>
            <p>
              Load a video, let AI extract frames, classify scenes, read
              positions and coins, then explore everything on an interactive
              dashboard.
            </p>
            <div className="landing-hero-actions">
              <Link href="/auth/sign-up" className="landing-btn-primary">
                Get Started Free
              </Link>
              <Link href="/how-it-works" className="landing-btn-secondary">
                How It Works
              </Link>
            </div>
          </section>
        )}

        <section
          className="landing-features"
          aria-label="Key features"
        >
          <div className="landing-feature-card">
            <div
              className="landing-feature-icon landing-feature-icon--red"
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15.2 3.9 2.9 2.9"/><path d="m9.7 14.7-2.3 5.3 5.3-2.3"/><path d="m17.6 13.1-7.4 7.4"/><path d="M3.5 20.5 6 18"/><path d="m6.6 17.4 3.5-3.5"/><path d="M20.1 6.8 9.7 14.7"/><path d="m3.9 8.8 4.2 4.2"/><path d="m6.8 3.9 7.9 10.4"/></svg>
            </div>
            <h3>AI Frame Analysis</h3>
            <p>
              Moondream vision AI classifies every frame: racing, menu, loading,
              or results. Fine-tuned models detect positions 1st through 12th
              and coin counts automatically.
            </p>
          </div>
          <div className="landing-feature-card">
            <div
              className="landing-feature-icon landing-feature-icon--gold"
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
            </div>
            <h3>Race Dashboard</h3>
            <p>
              Automatic race segmentation turns your labeled frames into
              per-race charts showing position over time, coin trends, and
              session-wide statistics.
            </p>
          </div>
          <div className="landing-feature-card">
            <div
              className="landing-feature-icon landing-feature-icon--blue"
              aria-hidden="true"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            </div>
            <h3>Import / Export</h3>
            <p>
              Export frame annotations and race data as JSON. Import previous
              sessions to continue labeling or re-analyze with different AI
              models and parameters.
            </p>
          </div>
        </section>

        <section className="landing-pipeline" aria-label="Analysis pipeline">
          <h2>From video to insights in minutes</h2>
          <p>The full analysis pipeline runs right in your browser</p>
          <div className="landing-pipeline-steps">
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-step-num">1</div>
              <span>Load Video</span>
            </div>
            <div className="landing-pipeline-arrow" aria-hidden="true">
              &rarr;
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-step-num">2</div>
              <span>Extract Frames</span>
            </div>
            <div className="landing-pipeline-arrow" aria-hidden="true">
              &rarr;
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-step-num">3</div>
              <span>AI Classify</span>
            </div>
            <div className="landing-pipeline-arrow" aria-hidden="true">
              &rarr;
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-step-num">4</div>
              <span>Read Data</span>
            </div>
            <div className="landing-pipeline-arrow" aria-hidden="true">
              &rarr;
            </div>
            <div className="landing-pipeline-step">
              <div className="landing-pipeline-step-num">5</div>
              <span>Dashboard</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p>Mario Kart Analyzer -- built with Next.js, Supabase, and Moondream AI</p>
      </footer>
    </div>
  )
}
