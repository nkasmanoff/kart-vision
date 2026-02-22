export interface FrameLabels {
  scene: "in_race" | "not_in_race" | null;
  position: number | "x" | null;
  coins: number | null;
  events: string[];
}

export interface Frame {
  timestamp: number;
  dataUrl: string;
  hiResUrl: string;
  labels: FrameLabels;
}

export interface RaceData {
  race_number: number;
  start_time: number;
  end_time: number;
  duration: number;
  total_frames: number;
  in_race_frames: number;
  position_history: { timestamp: number; position: number; relative_time: number }[];
  coin_history: { timestamp: number; coins: number; relative_time: number }[];
  best_position: number | null;
  worst_position: number | null;
  final_position: number | null;
  avg_position: number | null;
  position_changes: number;
  final_coins: number | null;
  max_coins: number | null;
  min_coins: number | null;
}

export const EVENT_TYPES = ["shock", "item_hit"] as const;
export const EVENT_LABELS: Record<string, string> = {
  shock: "Shock",
  item_hit: "Item Hit",
};

export function defaultLabels(): FrameLabels {
  return { scene: null, position: null, coins: null, events: [] };
}

export function isLabeled(labels: FrameLabels): boolean {
  return (
    labels.scene !== null ||
    labels.position !== null ||
    labels.coins !== null ||
    labels.events.length > 0
  );
}

export function fmtTs(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m + ":" + sec.padStart(4, "0");
}

export function ordinal(n: number | null): string {
  if (n == null) return "?";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || "th");
}
