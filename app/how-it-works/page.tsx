import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works - Mario Kart Analyzer",
  description:
    "Learn how the Mario Kart Analyzer uses AI-powered frame analysis to extract race data from gameplay footage.",
};

const steps = [
  {
    num: "01",
    title: "Load Your Video",
    desc: "Select any Mario Kart gameplay video from your device. The analyzer supports all common video formats. The video is processed entirely in your browser \u2014 nothing is uploaded to a server.",
    detail:
      "The video element seeks through the file at your configured interval (default: every 1 second) and captures frames using an HTML5 canvas.",
    color: "var(--mk-accent)",
  },
  {
    num: "02",
    title: "Extract Frames",
    desc: "Frames are captured at regular intervals from your video. You control the sampling rate \u2014 every 0.5s for high-detail analysis or every 2\u20133s for a quick overview.",
    detail:
      "Each frame is rendered at up to 768px on its longest side and encoded as a JPEG data URL for efficient processing.",
    color: "var(--mk-gold)",
  },
  {
    num: "03",
    title: "AI Scene Classification",
    desc: 'The Moondream vision model examines each frame and determines whether it shows an active race. Frames are tagged as "In Race" or "Not In Race" to filter menus, lobbies, and load screens.',
    detail:
      'A fine-tuned model variant can be configured for improved accuracy. The model answers: "Is this an active Mario Kart race?" with yes, no, or unsure.',
    color: "var(--mk-blue)",
  },
  {
    num: "04",
    title: "Position & Coin Reading",
    desc: "For frames identified as in-race, the AI reads the current position (1st\u201324th) from the bottom-right of the HUD and the coin count (0\u201320) from the bottom-left.",
    detail:
      "The image is intelligently cropped to the relevant 30% corner regions before querying the model, improving accuracy and reducing noise from the rest of the frame.",
    color: "var(--mk-green)",
  },
  {
    num: "05",
    title: "Gap Imputation",
    desc: "Short gaps where the AI missed a frame (e.g., during item use animations or transitions) are automatically filled in using linear interpolation from surrounding data.",
    detail:
      'Runs of "not_in_race" frames shorter than 5 frames that are surrounded by race frames are reclassified, and their position values are interpolated.',
    color: "var(--mk-orange)",
  },
  {
    num: "06",
    title: "Race Segmentation",
    desc: "Continuous stretches of race frames are grouped into individual races. The analyzer automatically detects where one race ends and another begins based on gaps in race activity.",
    detail:
      "Adjacent race segments with fewer than 5 non-race frames between them are merged into a single race to handle brief interruptions.",
    color: "var(--mk-accent)",
  },
  {
    num: "07",
    title: "Dashboard & Export",
    desc: "View rich analytics per race: position over time, coin history, best/worst/final placement, and session-wide summaries. Export everything as JSON for further analysis.",
    detail:
      "Two export formats are available: raw frame annotations (for re-import and correction) and structured race data (for external tools and spreadsheets).",
    color: "var(--mk-gold)",
  },
];

const shortcuts = [
  { keys: ["1\u20139"], action: "Set position for selected frames" },
  { keys: ["0"], action: "Set position to value starting with 1 (10\u201319)" },
  { keys: ["Shift+0\u20139"], action: "Set position 20\u201324 and special values" },
  { keys: ["X"], action: "Clear position to N/A" },
  { keys: ["N"], action: "Mark as Not In Race" },
  { keys: ["R"], action: "Mark as In Race" },
  { keys: ["\u2190 \u2192"], action: "Navigate between frames" },
  { keys: ["\u2191 \u2193"], action: "Navigate rows in grid" },
  { keys: ["Shift+\u2190\u2192"], action: "Extend selection" },
  { keys: ["Tab"], action: "Switch between Dashboard and Frames tabs" },
  { keys: ["Ctrl+A"], action: "Select all frames" },
  { keys: ["Esc"], action: "Clear selection" },
  { keys: ["Del"], action: "Clear all labels on selected frames" },
];

export default function HowItWorksPage() {
  return (
    <div className="hiw-root">
      <nav className="hiw-nav">
        <Link href="/" className="hiw-back">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Analyzer
        </Link>
        <h1 className="hiw-nav-title">Mario Kart Analyzer</h1>
      </nav>

      <main className="hiw-main">
        {/* Hero */}
        <header className="hiw-hero">
          <p className="hiw-eyebrow">Documentation</p>
          <h1 className="hiw-heading">How It Works</h1>
          <p className="hiw-subheading">
            The Mario Kart Analyzer uses the Moondream vision model to extract
            race data from gameplay footage. Here is the full pipeline, from
            video to dashboard.
          </p>
        </header>

        {/* Pipeline overview */}
        <section className="hiw-pipeline" aria-label="Pipeline overview">
          <div className="hiw-pipeline-track">
            {["Video", "Frames", "Scene AI", "HUD Read", "Impute", "Segment", "Dashboard"].map(
              (label, i) => (
                <div key={label} className="hiw-pipeline-node">
                  <div
                    className="hiw-pipeline-dot"
                    style={{
                      background: steps[i].color,
                      boxShadow: `0 0 12px ${steps[i].color}`,
                    }}
                  >
                    <span className="hiw-pipeline-num">{i + 1}</span>
                  </div>
                  <span className="hiw-pipeline-label">{label}</span>
                  {i < 6 && <div className="hiw-pipeline-line" />}
                </div>
              )
            )}
          </div>
        </section>

        {/* Steps */}
        <section className="hiw-steps" aria-label="Detailed steps">
          {steps.map((step) => (
            <article key={step.num} className="hiw-step-card">
              <div className="hiw-step-num" style={{ color: step.color }}>
                {step.num}
              </div>
              <div className="hiw-step-body">
                <h2 className="hiw-step-title">{step.title}</h2>
                <p className="hiw-step-desc">{step.desc}</p>
                <div className="hiw-step-detail">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    style={{ flexShrink: 0, marginTop: 2 }}
                  >
                    <circle
                      cx="8"
                      cy="8"
                      r="7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M8 5V8.5M8 11H8.01"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{step.detail}</span>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Keyboard shortcuts */}
        <section className="hiw-section" aria-label="Keyboard shortcuts">
          <h2 className="hiw-section-title">Keyboard Shortcuts</h2>
          <p className="hiw-section-desc">
            Speed up your workflow with these keyboard shortcuts. Select frames
            in the grid, then use the keys below to quickly label them.
          </p>
          <div className="hiw-shortcuts-grid">
            {shortcuts.map((s, i) => (
              <div key={i} className="hiw-shortcut-row">
                <div className="hiw-shortcut-keys">
                  {s.keys.map((k) => (
                    <kbd key={k} className="hiw-kbd">
                      {k}
                    </kbd>
                  ))}
                </div>
                <span className="hiw-shortcut-action">{s.action}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Tips */}
        <section className="hiw-section" aria-label="Tips">
          <h2 className="hiw-section-title">Tips for Best Results</h2>
          <div className="hiw-tips-grid">
            <div className="hiw-tip-card">
              <div className="hiw-tip-icon" style={{ color: "var(--mk-gold)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="hiw-tip-title">Use 1-second intervals</h3>
              <p className="hiw-tip-desc">
                A 1-second frame interval provides good coverage without
                excessive API calls. Use 0.5s for critical races.
              </p>
            </div>
            <div className="hiw-tip-card">
              <div className="hiw-tip-icon" style={{ color: "var(--mk-blue)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M11 4H4V11H11V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 4H13V11H20V4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M20 13H13V20H20V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M11 13H4V20H11V13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="hiw-tip-title">Review and correct</h3>
              <p className="hiw-tip-desc">
                After AI analysis, review the Frames tab to correct any
                misclassifications. The keyboard shortcuts make bulk edits fast.
              </p>
            </div>
            <div className="hiw-tip-card">
              <div className="hiw-tip-icon" style={{ color: "var(--mk-green)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="hiw-tip-title">Export and re-import</h3>
              <p className="hiw-tip-desc">
                Export your annotations as JSON to save progress. Re-import later
                to continue labeling or share with others.
              </p>
            </div>
            <div className="hiw-tip-card">
              <div className="hiw-tip-icon" style={{ color: "var(--mk-accent)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2" />
                  <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="hiw-tip-title">Trim your videos</h3>
              <p className="hiw-tip-desc">
                For best results, trim videos to just the gameplay portion.
                Long lobby or menu sections waste API calls.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="hiw-cta">
          <h2 className="hiw-cta-title">Ready to analyze?</h2>
          <p className="hiw-cta-desc">
            Load a video and hit Analyze (configure your Moondream API key in `.env`).
          </p>
          <Link href="/analyzer" className="hiw-cta-btn">
            Open Analyzer
          </Link>
        </section>
      </main>
    </div>
  );
}
