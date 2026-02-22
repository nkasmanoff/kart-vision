import type { Frame, RaceData } from "./analyzer-types";

// ── Moondream API (proxied through /api/moondream to avoid CORS + keep key server-side) ──
const PROXY_URL = "/api/moondream";
const SCENE_QUESTION =
  "Is this an active mario kart race? Response yes no or unsure";
const POSITION_QUESTION =
  "What position number (1-24) is shown? Respond with just the number or n/a if nothing is shown.";
const COINS_QUESTION =
  "How many coins are shown? Respond with just the number or n/a if nothing is shown.";
const CONCURRENCY = 5;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Parse model string like "moondream3-preview/<finetune_id>@<step>" into parts */
function parseFinetuneModel(model: string): { finetuneId: string; step?: number } | null {
  const m = model.match(/^[^/]+\/([A-Za-z0-9]+)(?:@(\d+))?$/);
  if (!m) return null;
  return {
    finetuneId: m[1],
    step: m[2] ? parseInt(m[2], 10) : undefined,
  };
}

async function queryViaRollouts(
  imageUrl: string,
  question: string,
  finetuneId: string,
  reasoning: boolean
): Promise<string> {
  const payload = {
    mode: "rollouts",
    finetune_id: finetuneId,
    num_rollouts: 1,
    request: {
      skill: "query",
      question,
      image_url: imageUrl,
      reasoning,
      settings: { temperature: 0, max_tokens: 128 },
    },
  };

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const resp = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.status === 429) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[Moondream Rollouts] Rate limited, retrying in ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`[Moondream Rollouts] ${resp.status}:`, errBody);
        throw new Error(`API ${resp.status}: ${errBody}`);
      }
      const data = await resp.json();
      return data?.rollouts?.[0]?.output?.answer ?? "";
    } catch (e) {
      if (attempt < 4) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[Moondream Rollouts] Error (attempt ${attempt + 1}/5), retrying in ${wait}ms:`, e);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  return "";
}

export async function queryMoondream(
  imageUrl: string,
  question: string,
  _apiKey?: string,
  model?: string | null,
  reasoning = true,
  finetuneIdOverride?: string | null
): Promise<string> {
  const finetuneId =
    finetuneIdOverride?.trim() ||
    (model ? parseFinetuneModel(model)?.finetuneId : null);

  if (finetuneId) {
    return queryViaRollouts(imageUrl, question, finetuneId, reasoning);
  }

  // Standard /query for base model (also proxied)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const payload: Record<string, unknown> = {
        mode: "query",
        image_url: imageUrl,
        question,
      };
      if (reasoning) payload.reasoning = true;
      const resp = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (resp.status === 429) {
        const wait = Math.pow(2, attempt) * 1000;
        console.warn(`[Moondream Query] Rate limited, retrying in ${wait}ms...`);
        await sleep(wait);
        continue;
      }
      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`API ${resp.status}: ${errBody}`);
      }
      const data = await resp.json();
      return data.answer || "";
    } catch (e) {
      if (attempt < 4) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw e;
    }
  }
  return "";
}

export function parseScene(answer: string): "in_race" | "not_in_race" {
  const n = answer
    .trim()
    .toLowerCase()
    .replace(/[.,!]/g, "")
    .trim();
  if (n === "yes") return "in_race";
  if (["no", "unsure"].includes(n)) return "not_in_race";
  if (n.includes("yes") && !n.includes("no") && !n.includes("unsure"))
    return "in_race";
  return "not_in_race";
}

export function parsePosition(answer: string): number | null {
  const m = answer.trim().match(/\d+/);
  if (m) {
    const v = parseInt(m[0]);
    if (v >= 1 && v <= 24) return v;
  }
  return null;
}

export function parseCoins(answer: string): number | null {
  const n = answer.trim().toLowerCase();
  if (n.includes("n/a") || n.includes("nothing") || n === "") return null;
  const m = answer.trim().match(/\d+/);
  if (m) {
    const v = parseInt(m[0]);
    if (v >= 0 && v <= 20) return v;
  }
  return null;
}

export async function runBatch<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
  onCancel: () => boolean
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < tasks.length) {
      if (onCancel()) return;
      const idx = nextIdx++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, tasks.length); i++)
    workers.push(worker());
  await Promise.all(workers);
  return results;
}

// ── Frame extraction helpers ──
export function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const h = () => {
      video.removeEventListener("seeked", h);
      resolve();
    };
    video.addEventListener("seeked", h);
    video.currentTime = time;
  });
}

export function getHighResDataUrl(video: HTMLVideoElement): string {
  const vw = video.videoWidth,
    vh = video.videoHeight;
  const maxDim = 768;
  let w = vw,
    h = vh;
  if (Math.max(w, h) > maxDim) {
    const r = maxDim / Math.max(w, h);
    w = Math.round(w * r);
    h = Math.round(h * r);
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

export function cropBottomRight(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.width,
        h = img.height;
      const cropW = Math.round(w * 0.3);
      const cropH = Math.round(h * 0.3);
      const sx = w - cropW,
        sy = h - cropH;
      const c = document.createElement("canvas");
      c.width = cropW;
      c.height = cropH;
      c.getContext("2d")!.drawImage(img, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to load image for crop"));
    img.src = imageDataUrl;
  });
}

export function cropBottomLeft(imageDataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const w = img.width,
        h = img.height;
      const cropW = Math.round(w * 0.3);
      const cropH = Math.round(h * 0.3);
      const sy = h - cropH;
      const c = document.createElement("canvas");
      c.width = cropW;
      c.height = cropH;
      c.getContext("2d")!.drawImage(img, 0, sy, cropW, cropH, 0, 0, cropW, cropH);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => reject(new Error("Failed to load image for crop"));
    img.src = imageDataUrl;
  });
}

// ── Imputation ──
export function imputeScene(frames: Frame[], minGap = 5): number {
  const n = frames.length;
  let imputed = 0,
    i = 0;
  while (i < n) {
    if (frames[i].labels.scene === "not_in_race") {
      let j = i;
      while (j < n && frames[j].labels.scene === "not_in_race") j++;
      const runLen = j - i;
      const hasLeft = i > 0 && frames[i - 1].labels.scene === "in_race";
      const hasRight = j < n && frames[j].labels.scene === "in_race";
      if (runLen < minGap && hasLeft && hasRight) {
        const lp = frames[i - 1].labels.position;
        const rp = frames[j].labels.position;
        for (let k = i; k < j; k++) {
          frames[k].labels.scene = "in_race";
          if (
            lp != null &&
            typeof lp === "number" &&
            rp != null &&
            typeof rp === "number"
          ) {
            frames[k].labels.position = Math.round(
              lp + ((k - (i - 1)) / (j - (i - 1))) * (rp - lp)
            );
          } else if (lp != null && typeof lp === "number") {
            frames[k].labels.position = lp;
          } else if (rp != null && typeof rp === "number") {
            frames[k].labels.position = rp;
          }
          imputed++;
        }
      }
      i = j;
    } else {
      i++;
    }
  }
  return imputed;
}

// ── Race segmentation ──
export function segmentRaces(frames: Frame[], minGap = 5): RaceData[] {
  const segments: [number, number][] = [];
  let segStart: number | null = null;
  for (let i = 0; i < frames.length; i++) {
    if (frames[i].labels.scene === "in_race") {
      if (segStart === null) segStart = i;
    } else {
      if (segStart !== null) {
        segments.push([segStart, i - 1]);
        segStart = null;
      }
    }
  }
  if (segStart !== null) segments.push([segStart, frames.length - 1]);
  if (segments.length === 0) return [];

  const merged: [number, number][] = [[...segments[0]]];
  for (let s = 1; s < segments.length; s++) {
    const gap = segments[s][0] - merged[merged.length - 1][1] - 1;
    if (gap < minGap) merged[merged.length - 1][1] = segments[s][1];
    else merged.push([...segments[s]]);
  }

  return merged.map((seg, r) => {
    const [si, ei] = seg;
    const rf = frames.slice(si, ei + 1);
    const irf = rf.filter((f) => f.labels.scene === "in_race");
    const rStart = rf[0].timestamp,
      rEnd = rf[rf.length - 1].timestamp;
    const positions: RaceData["position_history"] = [];
    const coins: RaceData["coin_history"] = [];
    for (const f of irf) {
      if (f.labels.position != null && typeof f.labels.position === "number")
        positions.push({
          timestamp: f.timestamp,
          position: f.labels.position,
          relative_time: f.timestamp - rStart,
        });
      if (f.labels.coins != null && typeof f.labels.coins === "number")
        coins.push({
          timestamp: f.timestamp,
          coins: f.labels.coins,
          relative_time: f.timestamp - rStart,
        });
    }
    const pv = positions.map((p) => p.position);
    const cv = coins.map((c) => c.coins);
    let changes = 0;
    for (let j = 1; j < pv.length; j++) if (pv[j] !== pv[j - 1]) changes++;
    return {
      race_number: r + 1,
      start_time: rStart,
      end_time: rEnd,
      duration: Math.round((rEnd - rStart) * 100) / 100,
      total_frames: rf.length,
      in_race_frames: irf.length,
      position_history: positions,
      coin_history: coins,
      best_position: pv.length ? Math.min(...pv) : null,
      worst_position: pv.length ? Math.max(...pv) : null,
      final_position: pv.length ? pv[pv.length - 1] : null,
      avg_position: pv.length
        ? Math.round((pv.reduce((a, b) => a + b, 0) / pv.length) * 100) / 100
        : null,
      position_changes: changes,
      final_coins: cv.length ? cv[cv.length - 1] : null,
      max_coins: cv.length ? Math.max(...cv) : null,
      min_coins: cv.length ? Math.min(...cv) : null,
    };
  });
}

// ── Full analysis pipeline ──
export {
  SCENE_QUESTION,
  POSITION_QUESTION,
  COINS_QUESTION,
  CONCURRENCY,
};
