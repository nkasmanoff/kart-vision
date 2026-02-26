"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { deleteSessionAction } from "@/app/actions"

type Session = {
  id: string
  video_name: string
  created_at: string
  thumbUrl: string | null
}

export function SessionsGrid({ sessions }: { sessions: Session[] }) {
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDeleteConfirm() {
    if (!pendingDelete) return
    const formData = new FormData()
    formData.set("sessionId", pendingDelete.id)
    startTransition(() => deleteSessionAction(formData))
    setPendingDelete(null)
  }

  return (
    <>
      <div className="landing-sessions-grid">
        <Link
          href="/analyzer"
          className="landing-session-card landing-session-card--new"
          aria-label="Add new session"
        >
          <span className="landing-session-card-icon" aria-hidden="true">+</span>
          <span className="landing-session-card-label">New session</span>
        </Link>

        {sessions.map((s) => (
          <div key={s.id} className="landing-session-card-wrapper">
            <Link href={`/analyzer?session=${s.id}`} className="landing-session-card">
              {s.thumbUrl ? (
                <img
                  src={s.thumbUrl}
                  className="landing-session-card-thumb"
                  alt=""
                />
              ) : (
                <div
                  className="landing-session-card-thumb landing-session-card-thumb--empty"
                  aria-hidden="true"
                />
              )}
              <div className="landing-session-card-meta">
                <span className="landing-session-card-name">{s.video_name}</span>
                <span className="landing-session-card-date">
                  {new Date(s.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </span>
              </div>
            </Link>
            <button
              className="landing-session-card-delete"
              onClick={() => setPendingDelete(s)}
              aria-label={`Delete session ${s.video_name}`}
              title="Delete session"
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {pendingDelete && (
        <div
          className="sessions-modal-overlay"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="sessions-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            aria-describedby="delete-modal-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sessions-modal-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </div>
            <h3 id="delete-modal-title" className="sessions-modal-title">
              Delete session?
            </h3>
            <p id="delete-modal-desc" className="sessions-modal-desc">
              <strong>&ldquo;{pendingDelete.video_name}&rdquo;</strong> and all
              its frames will be permanently deleted. This cannot be undone.
            </p>
            <div className="sessions-modal-actions">
              <button
                className="sessions-modal-cancel"
                onClick={() => setPendingDelete(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="sessions-modal-confirm"
                onClick={handleDeleteConfirm}
                disabled={isPending}
                type="button"
              >
                {isPending ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
