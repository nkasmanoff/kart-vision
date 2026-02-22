"use client";

import { useEffect } from "react";
import { AnalyzerProvider, useAnalyzer } from "@/lib/analyzer-context";
import { Toolbar } from "@/components/analyzer/toolbar";
import { FrameGrid } from "@/components/analyzer/frame-grid";
import { FramesTab } from "@/components/analyzer/frames-tab";
import { DashboardTab } from "@/components/analyzer/dashboard-tab";
import { StatusBar } from "@/components/analyzer/status-bar";
import { KeyboardHandler } from "@/components/analyzer/keyboard-handler";
import { Toaster } from "sonner";

function AnalyzerInner({
  userEmail,
  initialSessionId,
}: {
  userEmail?: string | null;
  initialSessionId?: string | null;
}) {
  const { activeTab, switchTab, progress, progressVisible, loadSession } =
    useAnalyzer();

  useEffect(() => {
    if (initialSessionId) {
      loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  return (
    <div className="analyzer-root">
      <KeyboardHandler />
      <Toolbar userEmail={userEmail} />

      {/* Progress bar */}
      {progressVisible && (
        <div
          className="progress-bar active"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        >
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Main layout */}
      <main className="main">
        <FrameGrid />

        <div className="right-panel">
          {/* Tab bar */}
          <div className="tab-bar" role="tablist" aria-label="View tabs">
            <button
              className={`tab-btn${activeTab === "dashboard" ? " active" : ""}`}
              role="tab"
              aria-selected={activeTab === "dashboard"}
              aria-controls="tab-dashboard"
              id="tab-btn-dashboard"
              onClick={() => switchTab("dashboard")}
            >
              Dashboard
            </button>
            <button
              className={`tab-btn${activeTab === "frames" ? " active" : ""}`}
              role="tab"
              aria-selected={activeTab === "frames"}
              aria-controls="tab-frames"
              id="tab-btn-frames"
              onClick={() => switchTab("frames")}
            >
              Frames
            </button>
          </div>

          {/* Tab panels */}
          <div
            className={`tab-content${activeTab === "dashboard" ? " active" : ""}`}
            role="tabpanel"
            id="tab-dashboard"
            aria-labelledby="tab-btn-dashboard"
            hidden={activeTab !== "dashboard"}
          >
            <DashboardTab />
          </div>
          <div
            className={`tab-content${activeTab === "frames" ? " active" : ""}`}
            role="tabpanel"
            id="tab-frames"
            aria-labelledby="tab-btn-frames"
            hidden={activeTab !== "frames"}
          >
            <FramesTab />
          </div>
        </div>
      </main>

      <StatusBar />
    </div>
  );
}

export default function MarioKartAnalyzer({
  userEmail,
  initialSessionId,
}: {
  userEmail?: string | null;
  initialSessionId?: string | null;
}) {
  return (
    <AnalyzerProvider>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#12122a",
            border: "1px solid #2a2a4a",
            color: "#e0e0e0",
          },
        }}
      />
      <AnalyzerInner userEmail={userEmail} initialSessionId={initialSessionId} />
    </AnalyzerProvider>
  );
}
