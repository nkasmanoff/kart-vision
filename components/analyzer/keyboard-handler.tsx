"use client";

import { useEffect } from "react";
import { useAnalyzer } from "@/lib/analyzer-context";
import { defaultLabels } from "@/lib/analyzer-types";

export function KeyboardHandler() {
  const {
    frames,
    selection,
    focusIdx,
    thumbSize,
    setSelection,
    addToSelection,
    setFocusIdx,
    applyLabel,
    clearSelectedLabels,
    goNextUnlabeled,
  } = useAnalyzer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (frames.length === 0) return;

      const key = e.key;
      const kl = key.toLowerCase();

      // Arrow left/right
      if (key === "ArrowRight" || key === "ArrowLeft") {
        e.preventDefault();
        const dir = key === "ArrowRight" ? 1 : -1;
        const ni = Math.max(0, Math.min(frames.length - 1, focusIdx + dir));
        if (e.shiftKey) addToSelection([ni]);
        else setSelection([ni]);
        setFocusIdx(ni);
        return;
      }

      // Arrow up/down (row jump)
      if (key === "ArrowDown" || key === "ArrowUp") {
        e.preventDefault();
        const gw = 256; // approximate grid width
        const cpr = Math.max(1, Math.floor(gw / (thumbSize + 4)));
        const dir = key === "ArrowDown" ? cpr : -cpr;
        const ni = Math.max(0, Math.min(frames.length - 1, focusIdx + dir));
        if (e.shiftKey) {
          const lo = Math.min(focusIdx, ni);
          const hi = Math.max(focusIdx, ni);
          const range: number[] = [];
          for (let i = lo; i <= hi; i++) range.push(i);
          addToSelection(range);
        } else {
          setSelection([ni]);
        }
        setFocusIdx(ni);
        return;
      }

      if (key === "Escape") {
        setSelection([]);
        setFocusIdx(-1);
        return;
      }

      if (key === "Tab") {
        e.preventDefault();
        goNextUnlabeled();
        return;
      }

      if (kl === "a" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const all: number[] = [];
        for (let i = 0; i < frames.length; i++) all.push(i);
        setSelection(all);
        return;
      }

      if (kl >= "0" && kl <= "9" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        applyLabel("position", kl === "0" ? 10 : parseInt(kl));
        return;
      }
      if (kl === "x" && !e.ctrlKey && !e.metaKey) {
        applyLabel("position", "x");
        return;
      }
      if (kl === "n" && !e.ctrlKey && !e.metaKey) {
        applyLabel("scene", "not_in_race");
        return;
      }
      if (kl === "r" && !e.ctrlKey && !e.metaKey) {
        applyLabel("scene", "in_race");
        return;
      }

      if (key === "Delete" || key === "Backspace") {
        if (selection.size > 0) {
          e.preventDefault();
          clearSelectedLabels();
        }
        return;
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    frames,
    selection,
    focusIdx,
    thumbSize,
    setSelection,
    addToSelection,
    setFocusIdx,
    applyLabel,
    clearSelectedLabels,
    goNextUnlabeled,
  ]);

  return null;
}
