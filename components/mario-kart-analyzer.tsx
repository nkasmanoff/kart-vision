"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialSessionId && !initialLoadDone.current) {
      initialLoadDone.current = true;
      loadSession(initialSessionId);
    }
  }, [initialSessionId, loadSession]);

  const GRID_MIN = 160;
  const GRID_MAX = 700;
  const [gridWidth, setGridWidth] = useState(260);
  const [gridCollapsed, setGridCollapsed] = useState(false);
  const dragState = useRef<{ active: boolean; startX: number; startWidth: number }>({
    active: false, startX: 0, startWidth: 260,
  });

  const startResize = useCallback((e: React.MouseEvent) => {
    dragState.current = { active: true, startX: e.clientX, startWidth: gridWidth };
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  }, [gridWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragState.current.active) return;
      const delta = e.clientX - dragState.current.startX;
      setGridWidth(Math.max(GRID_MIN, Math.min(GRID_MAX, dragState.current.startWidth + delta)));
    };
    const onUp = () => {
      if (dragState.current.active) {
        dragState.current.active = false;
        document.body.style.cursor = "";
      }
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

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
        {gridCollapsed ? (
          <button
            className="grid-expand-strip"
            onClick={() => setGridCollapsed(false)}
            title="Expand frame panel"
            aria-label="Expand frame panel"
          >
            ▶
          </button>
        ) : (
          <>
            <FrameGrid width={gridWidth} onCollapse={() => setGridCollapsed(true)} />
            <div
              className="resize-handle"
              onMouseDown={startResize}
              role="separator"
              aria-label="Resize frame panel"
              aria-orientation="vertical"
            />
          </>
        )}

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
