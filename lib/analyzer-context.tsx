"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Frame, FrameLabels, RaceData } from "./analyzer-types";
import { defaultLabels, isLabeled, EVENT_TYPES } from "./analyzer-types";
import {
  queryMoondream,
  queryModalScene,
  parseScene,
  parsePosition,
  parseCoins,
  runBatch,
  seekTo,
  getHighResDataUrl,
  cropBottomRight,
  cropBottomLeft,
  imputeScene,
  segmentRaces,
  CONCURRENCY,
  SCENE_QUESTION,
  POSITION_QUESTION,
  COINS_QUESTION,
} from "./analyzer-engine";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const STORAGE_BUCKET = "frame-images";
const UPLOAD_CONCURRENCY = 10;

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

async function uploadFrameImages(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sessionId: string,
  frames: Frame[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  let uploaded = 0;
  const tasks: (() => Promise<void>)[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    if (frame.dataUrl && frame.dataUrl.startsWith("data:")) {
      const idx = i;
      tasks.push(async () => {
        const blob = dataUrlToBlob(frame.dataUrl);
        await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(`${userId}/${sessionId}/${idx}_thumb.jpg`, blob, {
            contentType: "image/jpeg",
            upsert: true,
          });
        uploaded++;
        onProgress?.(uploaded, tasks.length);
      });
    }
    if (frame.hiResUrl && frame.hiResUrl.startsWith("data:")) {
      const idx = i;
      tasks.push(async () => {
        const blob = dataUrlToBlob(frame.hiResUrl);
        await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(`${userId}/${sessionId}/${idx}_hires.jpg`, blob, {
            contentType: "image/jpeg",
            upsert: true,
          });
        uploaded++;
        onProgress?.(uploaded, tasks.length);
      });
    }
  }

  for (let i = 0; i < tasks.length; i += UPLOAD_CONCURRENCY) {
    await Promise.all(
      tasks.slice(i, i + UPLOAD_CONCURRENCY).map((t) => t())
    );
  }

  return uploaded;
}

async function fetchFrameImageUrls(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  sessionId: string,
  frameCount: number
): Promise<{ thumbUrls: string[]; hiResUrls: string[] }> {
  const empty = {
    thumbUrls: new Array(frameCount).fill("") as string[],
    hiResUrls: new Array(frameCount).fill("") as string[],
  };
  if (frameCount === 0) return empty;

  const { data: listing } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(`${userId}/${sessionId}`, { limit: 1 });
  if (!listing || listing.length === 0) return empty;

  const thumbPaths: string[] = [];
  const hiResPaths: string[] = [];
  for (let i = 0; i < frameCount; i++) {
    thumbPaths.push(`${userId}/${sessionId}/${i}_thumb.jpg`);
    hiResPaths.push(`${userId}/${sessionId}/${i}_hires.jpg`);
  }

  const EXPIRES_IN = 60 * 60 * 24; // 24 hours
  const [thumbResult, hiResResult] = await Promise.all([
    supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(thumbPaths, EXPIRES_IN),
    supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrls(hiResPaths, EXPIRES_IN),
  ]);

  return {
    thumbUrls: (thumbResult.data ?? []).map((d) => d.signedUrl || ""),
    hiResUrls: (hiResResult.data ?? []).map((d) => d.signedUrl || ""),
  };
}

export interface SessionSummary {
  id: string;
  video_name: string;
  created_at: string;
}

interface AnalyzerState {
  frames: Frame[];
  races: RaceData[];
  selection: Set<number>;
  focusIdx: number;
  lastClickIdx: number;
  videoLoaded: boolean;
  videoName: string;
  videoDuration: number;
  analyzing: boolean;
  progress: number;
  progressVisible: boolean;
  statusMessage: string;
  annotateMessage: string;
  activeTab: "dashboard" | "frames";
  thumbSize: number;
  interval: number;
  sessions: SessionSummary[];
  currentSessionId: string | null;
}



interface AnalyzerActions {
  loadVideo: (file: File) => void;
  runAnalysis: () => Promise<void>;
  cancelAnalysis: () => void;
  reAnalyze: () => void;
  setSelection: (indices: number[]) => void;
  addToSelection: (indices: number[]) => void;
  toggleSelection: (idx: number) => void;
  applyLabel: (key: keyof FrameLabels, value: unknown) => void;
  toggleEvent: (eventType: string) => void;
  clearSelectedLabels: () => void;
  goNextUnlabeled: () => void;
  switchTab: (tab: "dashboard" | "frames") => void;
  setThumbSize: (size: number) => void;
  setInterval: (val: number) => void;
  setFocusIdx: (idx: number) => void;
  saveToSupabase: () => Promise<void>;
  fetchSessions: () => Promise<void>;
  loadSession: (id: string) => Promise<void>;
  newSession: () => void;
  deleteSession: (id: string) => Promise<void>;
  getConsensus: () => {
    scene: FrameLabels["scene"] | undefined;
    position: FrameLabels["position"] | undefined;
    coins: FrameLabels["coins"] | undefined;
    events: Record<string, boolean>;
  };
  videoRef: React.RefObject<HTMLVideoElement | null>;
  getStats: () => {
    total: number;
    labeled: number;
    inRace: number;
    notInRace: number;
    positions: number;
    coins: number;
    events: number;
  };
}

const AnalyzerContext = createContext<(AnalyzerState & AnalyzerActions) | null>(
  null
);

export function useAnalyzer() {
  const ctx = useContext(AnalyzerContext);
  if (!ctx) throw new Error("useAnalyzer must be inside AnalyzerProvider");
  return ctx;
}

export function AnalyzerProvider({ children }: { children: ReactNode }) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [races, setRaces] = useState<RaceData[]>([]);
  const [selection, setSelectionState] = useState<Set<number>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [lastClickIdx, setLastClickIdx] = useState(-1);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoName, setVideoName] = useState("");
  const [videoDuration, setVideoDuration] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressVisible, setProgressVisible] = useState(false);
  const [statusMessage, setStatusMessage] = useState("No video loaded");
  const [annotateMessage, setAnnotateMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "frames">(
    "dashboard"
  );
  const [thumbSize, setThumbSize] = useState(72);
  const [interval, setIntervalVal] = useState(1.0);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cancelRef = useRef(false);
  const framesRef = useRef<Frame[]>([]);

  // Keep framesRef in sync
  const updateFrames = useCallback((newFrames: Frame[]) => {
    framesRef.current = newFrames;
    setFrames([...newFrames]);
  }, []);

  const loadVideo = useCallback(
    (file: File) => {
      if (!file || !videoRef.current) return;
      const url = URL.createObjectURL(file);
      const vid = videoRef.current;
      vid.src = url;
      vid.load();
      vid.onloadedmetadata = () => {
        setVideoLoaded(true);
        const dur = vid.duration;
        setVideoDuration(dur);
        const m = Math.floor(dur / 60);
        const s = Math.floor(dur % 60);
        setVideoName(file.name);
        setStatusMessage(`${file.name} (${m}m${s}s)`);
        toast.success(`Video loaded: ${file.name}`);
      };
    },
    []
  );

  const setSelectionAction = useCallback((indices: number[]) => {
    setSelectionState(new Set(indices));
  }, []);

  const addToSelectionAction = useCallback((indices: number[]) => {
    setSelectionState((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => next.add(i));
      return next;
    });
  }, []);

  const toggleSelectionAction = useCallback((idx: number) => {
    setSelectionState((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const applyLabel = useCallback(
    (key: keyof FrameLabels, value: unknown) => {
      if (selection.size === 0) return;
      const updated = [...framesRef.current];
      selection.forEach((idx) => {
        if (key === "events") return;
        (updated[idx].labels as unknown as Record<string, unknown>)[key] = value;
      });
      imputeScene(updated);
      const newRaces = segmentRaces(updated);
      framesRef.current = updated;
      setFrames([...updated]);
      setRaces(newRaces);
    },
    [selection]
  );

  const toggleEvent = useCallback(
    (eventType: string) => {
      if (selection.size === 0) return;
      const updated = [...framesRef.current];
      const selArr = [...selection];
      const allHave = selArr.every((idx) =>
        updated[idx].labels.events.includes(eventType)
      );
      selArr.forEach((idx) => {
        if (allHave) {
          updated[idx].labels.events = updated[idx].labels.events.filter(
            (e) => e !== eventType
          );
        } else {
          if (!updated[idx].labels.events.includes(eventType)) {
            updated[idx].labels.events = [
              ...updated[idx].labels.events,
              eventType,
            ];
          }
        }
      });
      imputeScene(updated);
      const newRaces = segmentRaces(updated);
      framesRef.current = updated;
      setFrames([...updated]);
      setRaces(newRaces);
    },
    [selection]
  );

  const clearSelectedLabels = useCallback(() => {
    if (selection.size === 0) return;
    const updated = [...framesRef.current];
    selection.forEach((idx) => {
      updated[idx].labels = defaultLabels();
    });
    imputeScene(updated);
    const newRaces = segmentRaces(updated);
    framesRef.current = updated;
    setFrames([...updated]);
    setRaces(newRaces);
    toast("Cleared labels for selected frames");
  }, [selection]);

  const goNextUnlabeled = useCallback(() => {
    const f = framesRef.current;
    const start = focusIdx >= 0 ? focusIdx + 1 : 0;
    for (let i = start; i < f.length; i++) {
      if (!isLabeled(f[i].labels)) {
        setFocusIdx(i);
        setLastClickIdx(i);
        setSelectionState(new Set([i]));
        return;
      }
    }
    for (let i = 0; i < start; i++) {
      if (!isLabeled(f[i].labels)) {
        setFocusIdx(i);
        setLastClickIdx(i);
        setSelectionState(new Set([i]));
        return;
      }
    }
    toast.success("All frames labeled!");
  }, [focusIdx]);

  const runAnalysis = useCallback(async () => {
    if (analyzing || !videoLoaded || !videoRef.current) return;

    setAnalyzing(true);
    cancelRef.current = false;
    setProgressVisible(true);
    setProgress(0);

    const vid = videoRef.current;
    const intv = interval;
    const duration = vid.duration;
    const totalFrames = Math.ceil(duration / intv);
    let errors = 0;

    try {
      // Step 1: Extract frames
      setAnnotateMessage("Extracting frames...");
      const newFrames: Frame[] = [];
      const tc = document.createElement("canvas");
      const vw = vid.videoWidth,
        vh = vid.videoHeight;
      const tw = 320,
        th = Math.round((tw * vh) / vw);
      tc.width = tw;
      tc.height = th;
      const tctx = tc.getContext("2d")!;

      for (let i = 0; i < totalFrames; i++) {
        if (cancelRef.current) {
          finish("Cancelled during extraction");
          return;
        }
        const t = Math.min(i * intv, duration - 0.01);
        await seekTo(vid, t);
        tctx.drawImage(vid, 0, 0, tw, th);
        newFrames.push({
          timestamp: Math.round(t * 1000) / 1000,
          dataUrl: tc.toDataURL("image/jpeg", 0.65),
          hiResUrl: getHighResDataUrl(vid),
          labels: defaultLabels(),
        });
        setProgress(((i / totalFrames) * 10));
        setAnnotateMessage(`Extracting ${i + 1}/${totalFrames}`);
        if (i % 20 === 0) await new Promise((r) => setTimeout(r, 0));
      }
      framesRef.current = newFrames;
      setFrames([...newFrames]);

      // Step 2: Scene classification via Modal fine-tuned detector
      let completed = 0;
      const sceneTasks = newFrames.map((frame, _idx) => async () => {
        if (cancelRef.current) return;
        try {
          frame.labels.scene = parseScene(
            await queryModalScene(frame.hiResUrl)
          );
        } catch {
          errors++;
        }
        completed++;
        setProgress(10 + (completed / newFrames.length) * 50);
        setAnnotateMessage(
          `Phase 1: Scene ${completed}/${newFrames.length}${errors ? ` (${errors} err)` : ""}`
        );
        setFrames([...newFrames]);
      });
      await runBatch(sceneTasks, CONCURRENCY, () => cancelRef.current);
      if (cancelRef.current) {
        finish("Cancelled after scene classification");
        return;
      }

      // Step 3: Position for in_race frames
      const raceIndices: number[] = [];
      newFrames.forEach((f, i) => {
        if (f.labels.scene === "in_race") raceIndices.push(i);
      });
      completed = 0;
      errors = 0;
      const posTasks = raceIndices.map((idx) => async () => {
        if (cancelRef.current) return;
        try {
          const croppedUrl = await cropBottomRight(newFrames[idx].hiResUrl);
          newFrames[idx].labels.position = parsePosition(
            await queryMoondream(
              croppedUrl,
              POSITION_QUESTION
            )
          );
        } catch {
          errors++;
        }
        completed++;
        setProgress(60 + (completed / Math.max(raceIndices.length, 1)) * 15);
        setAnnotateMessage(
          `Phase 2: Position ${completed}/${raceIndices.length}${errors ? ` (${errors} err)` : ""}`
        );
        setFrames([...newFrames]);
      });
      await runBatch(posTasks, CONCURRENCY, () => cancelRef.current);
      if (cancelRef.current) {
        finish("Cancelled during position reading");
        return;
      }

      // Step 3b: Coins for in_race frames
      completed = 0;
      errors = 0;
      const coinTasks = raceIndices.map((idx) => async () => {
        if (cancelRef.current) return;
        try {
          const croppedUrl = await cropBottomLeft(newFrames[idx].hiResUrl);
          newFrames[idx].labels.coins = parseCoins(
            await queryMoondream(
              croppedUrl,
              COINS_QUESTION
            )
          );
        } catch {
          errors++;
        }
        completed++;
        setProgress(75 + (completed / Math.max(raceIndices.length, 1)) * 15);
        setAnnotateMessage(
          `Phase 3: Coins ${completed}/${raceIndices.length}${errors ? ` (${errors} err)` : ""}`
        );
        setFrames([...newFrames]);
      });
      await runBatch(coinTasks, CONCURRENCY, () => cancelRef.current);
      if (cancelRef.current) {
        finish("Cancelled during coins reading");
        return;
      }

      // Step 4: Impute + Segment
      setAnnotateMessage("Segmenting races...");
      setProgress(95);
      const imputed = imputeScene(newFrames);
      const newRaces = segmentRaces(newFrames);
      framesRef.current = newFrames;
      setFrames([...newFrames]);
      setRaces(newRaces);
      setProgress(100);
      finish(
        `${newRaces.length} race(s) from ${newFrames.length} frames${imputed ? ` (${imputed} imputed)` : ""}`
      );
      setActiveTab("dashboard");
      toast.success(
        `Analysis complete: ${newRaces.length} race(s) detected`
      );
    } catch (e) {
      finish("Error: " + (e as Error).message);
      toast.error("Analysis failed: " + (e as Error).message);
    }

    function finish(message: string) {
      setAnalyzing(false);
      cancelRef.current = false;
      setProgressVisible(false);
      setStatusMessage(message);
      setAnnotateMessage("");
    }
  }, [analyzing, videoLoaded, interval]);

  const cancelAnalysis = useCallback(() => {
    cancelRef.current = true;
    toast("Analysis cancelled");
  }, []);

  const reAnalyze = useCallback(() => {
    if (framesRef.current.length === 0) return;
    const updated = [...framesRef.current];
    imputeScene(updated);
    const newRaces = segmentRaces(updated);
    framesRef.current = updated;
    setFrames([...updated]);
    setRaces(newRaces);
    setStatusMessage(`${newRaces.length} race(s) after re-analysis`);
    setActiveTab("dashboard");
    toast.success(`Re-analysis complete: ${newRaces.length} race(s)`);
  }, []);

  const saveToSupabase = useCallback(async () => {
    const f = framesRef.current;
    if (f.length === 0) {
      toast.error("No frames to save.");
      return;
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to save to Supabase.");
      return;
    }
    const frameAnnotations = {
      type: "frame_annotations",
      sample_interval: interval,
      total_frames: f.length,
      labeled_frames: f.filter((fr) => isLabeled(fr.labels)).length,
      frames: f.map((fr) => ({
        timestamp: fr.timestamp,
        scene: fr.labels.scene,
        position: fr.labels.position,
        coins: fr.labels.coins,
        events: fr.labels.events,
      })),
    };

    const hasNewImages = f.some(
      (fr) =>
        (fr.dataUrl && fr.dataUrl.startsWith("data:")) ||
        (fr.hiResUrl && fr.hiResUrl.startsWith("data:"))
    );

    if (currentSessionId) {
      const { error } = await supabase
        .from("analysis_sessions")
        .update({
          video_name: videoName || "Untitled",
          sample_interval: interval,
          frame_annotations: frameAnnotations,
          race_data: races,
        })
        .eq("id", currentSessionId)
        .eq("user_id", user.id);
      if (error) {
        toast.error("Failed to update: " + error.message);
        return;
      }

      if (hasNewImages) {
        const toastId = toast.loading("Uploading frame images...");
        try {
          await uploadFrameImages(
            supabase, user.id, currentSessionId, f,
            (done, total) => toast.loading(`Uploading images ${done}/${total}...`, { id: toastId })
          );
          toast.dismiss(toastId);
        } catch (e) {
          toast.dismiss(toastId);
          toast.error("Failed to upload some images: " + (e as Error).message);
        }
      }

      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, video_name: videoName || "Untitled" }
            : s
        )
      );
      toast.success("Session updated");
    } else {
      const payload = {
        user_id: user.id,
        video_name: videoName || "Untitled",
        sample_interval: interval,
        frame_annotations: frameAnnotations,
        race_data: races,
      };
      const { data, error } = await supabase
        .from("analysis_sessions")
        .insert(payload)
        .select("id")
        .single();
      if (error) {
        toast.error("Failed to save: " + error.message);
        return;
      }

      if (hasNewImages) {
        const toastId = toast.loading("Uploading frame images...");
        try {
          await uploadFrameImages(
            supabase, user.id, data.id, f,
            (done, total) => toast.loading(`Uploading images ${done}/${total}...`, { id: toastId })
          );
          toast.dismiss(toastId);
        } catch (e) {
          toast.dismiss(toastId);
          toast.error("Failed to upload some images: " + (e as Error).message);
        }
      }

      setCurrentSessionId(data.id);
      setSessions((prev) => [
        { id: data.id, video_name: payload.video_name, created_at: new Date().toISOString() },
        ...prev,
      ]);
      toast.success("Session saved");
    }
  }, [interval, videoName, races, currentSessionId]);

  const fetchSessions = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("analysis_sessions")
      .select("id, video_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load sessions");
      return;
    }
    setSessions((data ?? []).map((r) => ({
      id: r.id,
      video_name: r.video_name || "Untitled",
      created_at: r.created_at,
    })));
  }, []);

  const loadSession = useCallback(async (id: string) => {
    const hasUnsaved = framesRef.current.length > 0 && !currentSessionId;
    if (hasUnsaved && !window.confirm("Discard current session and load selected?")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("analysis_sessions")
      .select("video_name, sample_interval, frame_annotations, race_data")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error || !data) {
      toast.error("Failed to load session");
      return;
    }
    const ann = data.frame_annotations as {
      sample_interval?: number;
      frames?: { timestamp: number; scene: string | null; position: number | string | null; coins: number | null; events: string[] }[];
    };
    const frameList = ann?.frames ?? [];

    const toastId = toast.loading("Loading frame images...");
    let thumbUrls: string[] = [];
    let hiResUrls: string[] = [];
    try {
      const result = await fetchFrameImageUrls(supabase, user.id, id, frameList.length);
      thumbUrls = result.thumbUrls;
      hiResUrls = result.hiResUrls;
    } catch {
      // Images may not exist for older sessions — continue with empty URLs
    }
    toast.dismiss(toastId);

    const loadedFrames: Frame[] = frameList.map((fr, i) => {
      const pos = fr.position;
      const position: FrameLabels["position"] =
        pos === "x" ? "x" : typeof pos === "number" ? pos : null;
      return {
        timestamp: fr.timestamp,
        dataUrl: thumbUrls[i] || "",
        hiResUrl: hiResUrls[i] || "",
        labels: {
          scene: fr.scene === "in_race" || fr.scene === "not_in_race" ? fr.scene : null,
          position,
          coins: fr.coins,
          events: fr.events ?? [],
        },
      };
    });
    setIntervalVal(data.sample_interval ?? 1);
    setVideoName(data.video_name || "Untitled");
    setVideoDuration(loadedFrames.length ? loadedFrames[loadedFrames.length - 1].timestamp : 0);
    setVideoLoaded(true);
    framesRef.current = loadedFrames;
    setFrames([...loadedFrames]);
    setRaces((data.race_data as RaceData[]) ?? []);
    setCurrentSessionId(id);
    setStatusMessage(`Loaded: ${data.video_name || "Untitled"} (${loadedFrames.length} frames)`);
    setActiveTab("dashboard");
    toast.success("Session loaded");
  }, [currentSessionId]);

  const newSession = useCallback(() => {
    const hasUnsaved = framesRef.current.length > 0 && !currentSessionId;
    if (hasUnsaved && !window.confirm("Discard current session and start new?")) return;
    setFrames([]);
    setRaces([]);
    setSelectionState(new Set());
    setFocusIdx(-1);
    setLastClickIdx(-1);
    setVideoLoaded(false);
    setVideoName("");
    setVideoDuration(0);
    setStatusMessage("No video loaded");
    setCurrentSessionId(null);
    framesRef.current = [];
    if (videoRef.current) {
      videoRef.current.src = "";
    }
    toast.success("New session");
  }, [currentSessionId]);

  const deleteSession = useCallback(async (id: string) => {
    if (!window.confirm("Delete this session? This cannot be undone.")) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("analysis_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to delete session");
      return;
    }

    const { data: files } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(`${user.id}/${id}`);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${id}/${f.name}`);
      await supabase.storage.from(STORAGE_BUCKET).remove(paths);
    }

    if (id === currentSessionId) {
      setFrames([]);
      setRaces([]);
      setSelectionState(new Set());
      setFocusIdx(-1);
      setLastClickIdx(-1);
      setVideoLoaded(false);
      setVideoName("");
      setVideoDuration(0);
      setStatusMessage("No video loaded");
      setCurrentSessionId(null);
      framesRef.current = [];
      if (videoRef.current) videoRef.current.src = "";
    }

    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Session deleted");
  }, [currentSessionId]);

  const getConsensus = useCallback(() => {
    let scene: FrameLabels["scene"] | undefined = undefined;
    let position: FrameLabels["position"] | undefined = undefined;
    let coins: FrameLabels["coins"] | undefined = undefined;
    const eventConsensus: Record<string, boolean> = {};
    EVENT_TYPES.forEach((ev) => {
      eventConsensus[ev] = true;
    });
    const selArr = [...selection];
    const f = framesRef.current;

    if (selArr.length > 0) {
      const first = f[selArr[0]]?.labels;
      if (!first) return { scene, position, coins, events: eventConsensus };
      scene = first.scene;
      position = first.position;
      coins = first.coins;
      EVENT_TYPES.forEach((ev) => {
        if (!first.events.includes(ev)) eventConsensus[ev] = false;
      });
      for (let i = 1; i < selArr.length; i++) {
        const l = f[selArr[i]]?.labels;
        if (!l) continue;
        if (l.scene !== scene) scene = undefined;
        if (l.position !== position) position = undefined;
        if (l.coins !== coins) coins = undefined;
        EVENT_TYPES.forEach((ev) => {
          if (!l.events.includes(ev)) eventConsensus[ev] = false;
        });
      }
    } else {
      EVENT_TYPES.forEach((ev) => {
        eventConsensus[ev] = false;
      });
    }
    return { scene, position, coins, events: eventConsensus };
  }, [selection]);

  const getStats = useCallback(() => {
    const f = framesRef.current;
    const total = f.length;
    let labeled = 0,
      inRace = 0,
      notInRace = 0,
      positions = 0,
      coinsCount = 0,
      eventsCount = 0;
    f.forEach((fr) => {
      if (isLabeled(fr.labels)) labeled++;
      if (fr.labels.scene === "in_race") inRace++;
      if (fr.labels.scene === "not_in_race") notInRace++;
      if (fr.labels.position !== null) positions++;
      if (fr.labels.coins !== null) coinsCount++;
      if (fr.labels.events.length > 0) eventsCount++;
    });
    return {
      total,
      labeled,
      inRace,
      notInRace,
      positions,
      coins: coinsCount,
      events: eventsCount,
    };
  }, []);

  return (
    <AnalyzerContext.Provider
      value={{
        frames,
        races,
        selection,
        focusIdx,
        lastClickIdx,
        videoLoaded,
        videoName,
        videoDuration,
        analyzing,
        progress,
        progressVisible,
        statusMessage,
        annotateMessage,
        activeTab,
        thumbSize,
        interval,
        sessions,
        currentSessionId,
        loadVideo,
        runAnalysis,
        cancelAnalysis,
        reAnalyze,
        setSelection: setSelectionAction,
        addToSelection: addToSelectionAction,
        toggleSelection: toggleSelectionAction,
        applyLabel,
        toggleEvent,
        clearSelectedLabels,
        goNextUnlabeled,
        switchTab: setActiveTab,
        setThumbSize,
        setInterval: setIntervalVal,
        setFocusIdx,
        saveToSupabase,
        fetchSessions,
        loadSession,
        newSession,
        deleteSession,
        getConsensus,
        videoRef,
        getStats,
      }}
    >
      {children}
      {/* Hidden video element */}
      <video
        ref={videoRef}
        style={{ display: "none" }}
        preload="auto"
        aria-hidden="true"
      />
    </AnalyzerContext.Provider>
  );
}
