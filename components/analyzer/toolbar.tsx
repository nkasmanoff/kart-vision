"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAnalyzer } from "@/lib/analyzer-context";
import { signout } from "@/app/auth/actions";

export function Toolbar({ userEmail }: { userEmail?: string | null }) {
  const {
    videoLoaded,
    analyzing,
    statusMessage,
    annotateMessage,
    interval,
    thumbSize,
    frames,
    sessions,
    currentSessionId,
    loadVideo,
    runAnalysis,
    cancelAnalysis,
    setInterval,
    setThumbSize,
    saveToSupabase,
    fetchSessions,
    loadSession,
    newSession,
    deleteSession,
  } = useAnalyzer();

  useEffect(() => {
    if (userEmail) fetchSessions();
  }, [userEmail, fetchSessions]);

  const canAnalyze = videoLoaded && !analyzing;
  const hasFrames = frames.length > 0;

  return (
    <header className="toolbar" role="toolbar" aria-label="Analyzer controls">
      <Link href="/" className="toolbar-logo" aria-label="Home">
        Kart Vision
      </Link>
      <Link
        href="/how-it-works"
        className="btn btn-secondary btn-sm"
        style={{ textDecoration: "none" }}
      >
        How It Works
      </Link>

      {userEmail && (
        <div className="tb-group" role="group" aria-label="Sessions">
          <select
            className="tb-select"
            value={currentSessionId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v) loadSession(v);
              else newSession();
            }}
            aria-label="Select session"
            style={{ minWidth: 140, maxWidth: 200 }}
          >
            <option value="">New session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.video_name || "Untitled"} ({new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })})
              </option>
            ))}
          </select>
          {currentSessionId && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => deleteSession(currentSessionId)}
              aria-label="Delete current session"
            >
              Delete Session
            </button>
          )}
        </div>
      )}

      <div className="tb-group">
        <label className="btn btn-primary btn-sm" tabIndex={0} role="button">
          <span>{videoLoaded ? "Change Video" : "Load Video"}</span>
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            aria-label="Load video file"
            onChange={(e) => {
              if (e.target.files?.[0]) loadVideo(e.target.files[0]);
            }}
          />
        </label>
      </div>

      <div className="tb-group" role="group" aria-label="Frame interval">
        <span className="tb-label" id="interval-label">
          Every
        </span>
        <input
          type="number"
          className="tb-input"
          value={interval}
          min={0.1}
          max={10}
          step={0.1}
          aria-labelledby="interval-label"
          onChange={(e) => setInterval(parseFloat(e.target.value) || 1.0)}
        />
        <span className="tb-label">sec</span>
      </div>

      <div className="tb-group" role="group" aria-label="Thumbnail size">
        <span className="tb-label">Size</span>
        <input
          type="range"
          min={80}
          max={240}
          value={thumbSize}
          aria-label="Thumbnail size"
          style={{ width: 70, accentColor: "var(--accent)" }}
          onChange={(e) => setThumbSize(parseInt(e.target.value))}
        />
      </div>

      <div className="tb-group" role="group" aria-label="Analysis controls">
        {!analyzing ? (
          <button
            className="btn btn-warning btn-sm"
            disabled={!canAnalyze}
            onClick={() => runAnalysis()}
            aria-label="Start analysis"
          >
            Analyze
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={cancelAnalysis}
            aria-label="Cancel analysis"
          >
            Cancel
          </button>
        )}
        {annotateMessage && (
          <span className="annotate-status" aria-live="polite" role="status">
            {annotateMessage}
          </span>
        )}
      </div>

      <div
        className="tb-group"
        style={{
          borderLeft: "1px solid var(--border)",
          paddingLeft: "0.6rem",
        }}
        role="group"
        aria-label="Session actions"
      >
        {userEmail && (
          <button
            className="btn btn-primary btn-sm"
            disabled={!hasFrames}
            onClick={() => saveToSupabase()}
            aria-label={currentSessionId ? "Update session" : "Save session"}
          >
            {currentSessionId ? "Update Session" : "Save Session"}
          </button>
        )}
      </div>

      <span className="badge" role="status" aria-live="polite">
        {statusMessage}
      </span>

      {userEmail && (
        <div
          className="tb-group"
          style={{
            marginLeft: "auto",
            borderLeft: "1px solid var(--border)",
            paddingLeft: "0.6rem",
          }}
          role="group"
          aria-label="User account"
        >
          <span className="tb-label" style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userEmail}
          </span>
          <form action={signout}>
            <button type="submit" className="btn btn-secondary btn-sm">
              Sign Out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
