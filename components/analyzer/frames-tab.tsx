"use client";

import { useRef } from "react";
import { useAnalyzer } from "@/lib/analyzer-context";
import { fmtTs, isLabeled, EVENT_TYPES, EVENT_LABELS } from "@/lib/analyzer-types";

export function FramesTab() {
  const {
    frames,
    selection,
    focusIdx,
    applyLabel,
    toggleEvent,
    clearSelectedLabels,
    goNextUnlabeled,
    setSelection,
    setFocusIdx,
    getConsensus,
    getStats,
  } = useAnalyzer();

  const rangeFromRef = useRef<HTMLInputElement>(null);
  const rangeToRef = useRef<HTMLInputElement>(null);

  const consensus = getConsensus();
  const stats = getStats();
  // Preview image
  let previewSrc = "";
  if (selection.size > 0) {
    const showIdx =
      focusIdx >= 0 && selection.has(focusIdx)
        ? focusIdx
        : Math.min(...selection);
    if (frames[showIdx]?.dataUrl) previewSrc = frames[showIdx].dataUrl;
  }

  // Selection info
  let selInfoText = "No selection";
  if (selection.size > 0) {
    const indices = [...selection].sort((a, b) => a - b);
    if (indices.length === 1) {
      const f = frames[indices[0]];
      let extra = "";
      if (f.labels.scene) extra += ` | ${f.labels.scene}`;
      if (f.labels.position != null) extra += ` | P${f.labels.position}`;
      if (f.labels.coins != null) extra += ` | ${f.labels.coins} coins`;
      if (f.labels.events.length)
        extra +=
          " | " + f.labels.events.map((e) => EVENT_LABELS[e] || e).join(", ");
      selInfoText = `Frame #${indices[0]} at ${fmtTs(f.timestamp)}${extra}`;
    } else {
      selInfoText = `${indices.length} frames (#${indices[0]} - #${indices[indices.length - 1]})`;
    }
  }

  const handleRangeSelect = () => {
    const from = parseInt(rangeFromRef.current?.value ?? "0") || 0;
    const to =
      parseInt(rangeToRef.current?.value ?? String(frames.length - 1)) ||
      frames.length - 1;
    const lo = Math.max(0, Math.min(from, to));
    const hi = Math.min(frames.length - 1, Math.max(from, to));
    const range: number[] = [];
    for (let i = lo; i <= hi; i++) range.push(i);
    setSelection(range);
    setFocusIdx(lo);
  };

  const selectAll = () => {
    const all: number[] = [];
    for (let i = 0; i < frames.length; i++) all.push(i);
    setSelection(all);
  };

  const selectNone = () => {
    setSelection([]);
    setFocusIdx(-1);
  };

  const selectUnlabeled = () => {
    const ul: number[] = [];
    frames.forEach((f, i) => {
      if (!isLabeled(f.labels)) ul.push(i);
    });
    setSelection(ul);
  };

  return (
    <div className="frames-tab" role="region" aria-label="Frame labeling">
      {/* Preview */}
      <div className="preview-wrap" role="img" aria-label="Selected frame preview">
        {previewSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="preview-img" src={previewSrc} alt="Selected frame" />
        ) : (
          <div className="preview-placeholder">Select a frame from the grid</div>
        )}
      </div>
      <div className="sel-info" aria-live="polite" role="status">
        {selInfoText}
      </div>

      {/* Selection tools */}
      <section className="correction-section" aria-label="Frame selection tools">
        <h3>Select Frames</h3>
        <div className="range-row">
          <input
            ref={rangeFromRef}
            type="number"
            className="range-input"
            placeholder="from"
            min={0}
            defaultValue={0}
            aria-label="Range start"
          />
          <span className="range-sep" aria-hidden="true">
            {"\u2013"}
          </span>
          <input
            ref={rangeToRef}
            type="number"
            className="range-input"
            placeholder="to"
            min={0}
            defaultValue={frames.length > 0 ? frames.length - 1 : 0}
            aria-label="Range end"
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRangeSelect}
            aria-label="Select range"
          >
            Select
          </button>
        </div>
        <div className="qs-row" role="group" aria-label="Quick selection">
          <button className="qs-btn" onClick={selectAll}>
            All
          </button>
          <button className="qs-btn" onClick={selectNone}>
            None
          </button>
          <button className="qs-btn" onClick={selectUnlabeled}>
            All Unlabeled
          </button>
          <button className="qs-btn" onClick={goNextUnlabeled}>
            Next Unlabeled
          </button>
          <button className="qs-btn" onClick={clearSelectedLabels}>
            Clear Labels
          </button>
        </div>
      </section>

      {/* Scene */}
      <section className="correction-section" aria-label="Scene classification">
        <h3>Scene</h3>
        <div className="scene-toggle" role="radiogroup" aria-label="Scene type">
          <button
            className={`scene-btn${consensus.scene === "in_race" ? " active-in" : ""}`}
            onClick={() => applyLabel("scene", "in_race")}
            aria-pressed={consensus.scene === "in_race"}
          >
            In Race <kbd>R</kbd>
          </button>
          <button
            className={`scene-btn${consensus.scene === "not_in_race" ? " active-out" : ""}`}
            onClick={() => applyLabel("scene", "not_in_race")}
            aria-pressed={consensus.scene === "not_in_race"}
          >
            Not in Race <kbd>N</kbd>
          </button>
        </div>
      </section>

      {/* Position */}
      <section className="correction-section" aria-label="Position labeling">
        <h3>
          Position{" "}
          <span
            style={{
              fontSize: "0.55rem",
              color: "var(--dim)",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            keys 1-9, 0=10, X=n/a (1-24)
          </span>
        </h3>
        <div className="label-grid" role="group" aria-label="Position buttons">
          <button
            className="label-btn"
            style={{ color: "var(--dim)" }}
            onClick={() => applyLabel("position", null)}
            title="Clear position"
            aria-label="Clear position"
          >
            {"\u2715"}
          </button>
          <button
            className={`label-btn${consensus.position === "x" ? " active-pos" : ""}`}
            onClick={() => applyLabel("position", "x")}
            title="Not visible"
            aria-label="Position not visible"
          >
            X
          </button>
          {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className={`label-btn${consensus.position === n ? " active-pos" : ""}`}
              onClick={() => applyLabel("position", n)}
              aria-label={`Position ${n}`}
              aria-pressed={consensus.position === n}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Coins */}
      <section className="correction-section" aria-label="Coins labeling">
        <h3>Coins</h3>
        <div className="label-grid" role="group" aria-label="Coin buttons">
          <button
            className="label-btn"
            style={{ color: "var(--dim)" }}
            onClick={() => applyLabel("coins", null)}
            title="Clear coins"
            aria-label="Clear coins"
          >
            {"\u2715"}
          </button>
          {Array.from({ length: 21 }, (_, i) => i).map((n) => (
            <button
              key={n}
              className={`label-btn${consensus.coins === n ? " active-coins" : ""}`}
              onClick={() => applyLabel("coins", n)}
              aria-label={`${n} coins`}
              aria-pressed={consensus.coins === n}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      {/* Events */}
      <section className="correction-section" aria-label="Event labeling">
        <h3>
          Events{" "}
          <span
            style={{
              fontSize: "0.55rem",
              color: "var(--dim)",
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            toggle on/off
          </span>
        </h3>
        <div className="label-grid" role="group" aria-label="Event buttons">
          {EVENT_TYPES.map((ev) => (
            <button
              key={ev}
              className={`label-btn${consensus.events[ev] ? " active-event" : ""}`}
              onClick={() => toggleEvent(ev)}
              aria-pressed={consensus.events[ev]}
              aria-label={EVENT_LABELS[ev] || ev}
            >
              {EVENT_LABELS[ev] || ev}
            </button>
          ))}
        </div>
      </section>

      {/* Progress stats */}
      <section className="correction-section" aria-label="Labeling progress">
        <h3>Progress</h3>
        {stats.total > 0 && (
          <div className="stats-grid" role="list" aria-label="Progress statistics">
            <div className="stat-card" role="listitem">
              <div className="stat-val">
                {Math.round((stats.labeled / stats.total) * 100)}%
              </div>
              <div className="stat-lbl">
                {stats.labeled}/{stats.total}
              </div>
            </div>
            <div className="stat-card" role="listitem">
              <div className="stat-val">{stats.inRace}</div>
              <div className="stat-lbl">In Race</div>
            </div>
            <div className="stat-card" role="listitem">
              <div className="stat-val">{stats.notInRace}</div>
              <div className="stat-lbl">Not in Race</div>
            </div>
            <div className="stat-card" role="listitem">
              <div className="stat-val">{stats.positions}</div>
              <div className="stat-lbl">Position</div>
            </div>
            <div className="stat-card" role="listitem">
              <div className="stat-val">{stats.coins}</div>
              <div className="stat-lbl">Coins</div>
            </div>
            <div className="stat-card" role="listitem">
              <div className="stat-val">{stats.events}</div>
              <div className="stat-lbl">Events</div>
            </div>
          </div>
        )}
      </section>

    </div>
  );
}
