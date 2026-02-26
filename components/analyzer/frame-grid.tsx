"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnalyzer } from "@/lib/analyzer-context";
import { fmtTs, EVENT_LABELS } from "@/lib/analyzer-types";

export function FrameGrid({ width, onCollapse }: { width: number; onCollapse: () => void }) {
  const {
    frames,
    selection,
    focusIdx,
    thumbSize,
    setSelection,
    addToSelection,
    setFocusIdx,
    switchTab,
  } = useAnalyzer();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 800
  );
  const dragRef = useRef({ active: false, startIdx: -1 });
  const lastClickRef = useRef(-1);

  // Calculate grid dimensions
  const cellW = thumbSize + 4;
  const aspectRatio = 9 / 16;
  const infoHeight = 22;
  const borderPadding = 8;
  const cellH = Math.round(thumbSize * aspectRatio) + infoHeight + borderPadding;
  const containerWidth = containerRef.current?.clientWidth ?? 250;
  const cols = Math.max(1, Math.floor(containerWidth / cellW));
  const totalRows = Math.ceil(frames.length / cols);
  const totalHeight = totalRows * (cellH + 4);

  // Virtualization: only render visible rows + buffer
  const buffer = 5;
  const startRow = Math.max(0, Math.floor(scrollTop / (cellH + 4)) - buffer);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / (cellH + 4)) + buffer
  );

  const visibleIndices: number[] = [];
  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx < frames.length) visibleIndices.push(idx);
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) setContainerHeight(h);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    requestAnimationFrame(measure);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Scroll to focus
  useEffect(() => {
    if (focusIdx < 0 || !containerRef.current) return;
    const row = Math.floor(focusIdx / cols);
    const top = row * (cellH + 4);
    const bottom = top + cellH + 4;
    const el = containerRef.current;
    if (top < el.scrollTop) {
      el.scrollTop = top - 20;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight + 20;
    }
  }, [focusIdx, cols, cellH]);

  const handleCellMouseDown = useCallback(
    (e: React.MouseEvent, idx: number) => {
      e.preventDefault();
      if (e.shiftKey && lastClickRef.current >= 0) {
        const lo = Math.min(lastClickRef.current, idx);
        const hi = Math.max(lastClickRef.current, idx);
        const range: number[] = [];
        for (let i = lo; i <= hi; i++) range.push(i);
        if (e.ctrlKey || e.metaKey) addToSelection(range);
        else setSelection(range);
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle individual
        const next = new Set(selection);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        setSelection([...next]);
      } else {
        dragRef.current = { active: true, startIdx: idx };
        setSelection([idx]);
      }
      lastClickRef.current = idx;
      setFocusIdx(idx);
      switchTab("frames");
    },
    [selection, addToSelection, setSelection, setFocusIdx, switchTab]
  );

  const handleCellMouseEnter = useCallback(
    (idx: number) => {
      if (!dragRef.current.active) return;
      const lo = Math.min(dragRef.current.startIdx, idx);
      const hi = Math.max(dragRef.current.startIdx, idx);
      const range: number[] = [];
      for (let i = lo; i <= hi; i++) range.push(i);
      setSelection(range);
    },
    [setSelection]
  );

  useEffect(() => {
    const up = () => {
      dragRef.current.active = false;
    };
    document.addEventListener("mouseup", up);
    return () => document.removeEventListener("mouseup", up);
  }, []);

  if (frames.length === 0) {
    return (
      <nav
        className="grid-panel"
        style={{ width }}
        aria-label="Frame grid"
      >
        <div className="grid-header">
          <span>Frames</span>
          <b>0</b>
          <button className="grid-collapse-btn" onClick={onCollapse} title="Collapse panel">◀</button>
        </div>
        <div className="grid-empty" role="status">
          <div className="big" aria-hidden="true">
            {"🎮"}
          </div>
          <p>
            Load a video and click <b>Analyze</b> to begin.
          </p>
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="grid-panel"
      style={{ width }}
      aria-label="Frame grid"
    >
      <div className="grid-header">
        <span>Frames</span>
        <b>{frames.length}</b>
        <button className="grid-collapse-btn" onClick={onCollapse} title="Collapse panel">◀</button>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          position: "relative",
          scrollbarWidth: "thin",
          scrollbarColor: "var(--border) transparent",
        }}
        role="listbox"
        aria-label={`${frames.length} frames`}
        aria-multiselectable="true"
        tabIndex={0}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleIndices.map((idx) => {
            const frame = frames[idx];
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const top = row * (cellH + 4) + 4;
            const left = col * cellW + 4;
            const isSelected = selection.has(idx);
            const isFocused = idx === focusIdx;
            const labels = frame.labels;

            let cellClass = "frame-cell";
            if (isSelected) cellClass += " selected";
            if (isFocused) cellClass += " focused";
            if (labels.scene === "not_in_race")
              cellClass += " scene-not_in_race";
            if (labels.scene === "in_race") cellClass += " scene-in_race";

            return (
              <div
                key={idx}
                className={cellClass}
                style={{
                  position: "absolute",
                  top,
                  left,
                  width: thumbSize,
                  height: cellH,
                }}
                role="option"
                aria-selected={isSelected}
                aria-label={`Frame ${idx} at ${fmtTs(frame.timestamp)}${labels.scene ? `, ${labels.scene}` : ""}${labels.position != null ? `, position ${labels.position}` : ""}`}
                onMouseDown={(e) => handleCellMouseDown(e, idx)}
                onMouseEnter={() => handleCellMouseEnter(idx)}
              >
                {frame.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="frame-img"
                    src={frame.dataUrl}
                    alt={`Frame ${idx}`}
                    draggable={false}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className="frame-img"
                    style={{
                      background: "#111",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.55rem",
                      color: "var(--dim)",
                    }}
                  >
                    {fmtTs(frame.timestamp)}
                  </div>
                )}
                <div className="frame-info">
                  <span className="frame-idx">{"#"}{idx}</span>
                  <span className="frame-ts">{fmtTs(frame.timestamp)}</span>
                  {labels.scene !== null && (
                    <span
                      className={`frame-badge fb-scene ${labels.scene === "in_race" ? "fb-scene-in" : "fb-scene-out"}`}
                    >
                      {labels.scene === "in_race" ? "RACE" : "OUT"}
                    </span>
                  )}
                  {labels.position !== null && (
                    <span
                      className={`frame-badge ${labels.position === "x" ? "fb-pos-x" : "fb-pos"}`}
                    >
                      {labels.position === "x"
                        ? "P:x"
                        : `P${labels.position}`}
                    </span>
                  )}
                  {labels.coins !== null && (
                    <span className="frame-badge fb-coins">
                      {"\u00A2"}{labels.coins}
                    </span>
                  )}
                  {labels.events.map((ev) => (
                    <span key={ev} className="frame-badge fb-event">
                      {EVENT_LABELS[ev] || ev}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
