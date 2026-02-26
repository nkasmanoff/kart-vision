import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { signout } from "./auth/actions"
import { SessionsGrid } from "@/components/sessions-grid"
import "./landing.css"

export default async function LandingPage() {
  let user = null
  let sessionsWithThumbs: {
    id: string
    video_name: string
    created_at: string
    thumbUrl: string | null
  }[] = []

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

      const userId = user.id
      sessionsWithThumbs = await Promise.all(
        (sessionsData ?? []).map(async (r) => {
          const { data: maxFrame } = await supabase
            .from("frames")
            .select("frame_index")
            .eq("session_id", r.id)
            .order("frame_index", { ascending: false })
            .limit(1)
            .single()
          const frameCount = maxFrame ? maxFrame.frame_index + 1 : 0
          const midIdx = Math.floor(frameCount / 2)
          let thumbUrl: string | null = null
          if (frameCount > 0) {
            try {
              const { data: signedData } = await supabase.storage
                .from("frame-images")
                .createSignedUrl(
                  `${userId}/${r.id}/${midIdx}_thumb.jpg`,
                  3600
                )
              thumbUrl = signedData?.signedUrl ?? null
            } catch {
              // No image available for this session
            }
          }
          return {
            id: r.id,
            video_name: r.video_name || "Untitled",
            created_at: r.created_at,
            thumbUrl,
          }
        })
      )
    }
  } catch {
    // Supabase not configured yet - show landing page anyway
  }

  return (
    <div className="landing">
      <div className="landing-nav-sticky">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="landing-nav-logo">
          Kart Vision
        </Link>
        <div className="landing-nav-links">
          <Link href="/how-it-works" className="landing-nav-link">
            How It Works
          </Link>
          {user ? (
            <>
              <Link href="/analyzer" className="landing-nav-link">
                Analyzer
              </Link>
              <form action={signout} style={{ display: "contents" }}>
                <button type="submit" className="landing-nav-link landing-nav-link--btn">
                  Sign Out
                </button>
              </form>
            </>
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
      </div>

      <main>
        {user ? (
          <section className="landing-sessions">
            <h1 className="landing-sessions-title">Your Sessions</h1>
            <p className="landing-sessions-desc">
              Pick a session to continue or start a new analysis.
            </p>
            <SessionsGrid sessions={sessionsWithThumbs} />
          </section>
        ) : (
          <section className="landing-hero">
            <div className="landing-hero-badge" aria-hidden="true">
              Powered by Moondream AI
            </div>
            <h1>
              Analyze your{" "}
              <span className="accent">kart gameplay footage</span>
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
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
            </div>
            <h3>Session Storage</h3>
            <p>
              All sessions and frame images are saved to the cloud. Pick up
              exactly where you left off and explore your analysis on any
              device.
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
        <p>Kart Vision &middot; Built with Next.js, Supabase &amp; Moondream AI</p>
      </footer>
    </div>
  )
}
