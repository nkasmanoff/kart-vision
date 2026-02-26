"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAnalyzer } from "@/lib/analyzer-context";
import { ordinal, type RaceData } from "@/lib/analyzer-types";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import Chart.js to avoid SSR issues
let Chart: typeof import("chart.js").Chart | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────

function sessionGrade(avg: number): { grade: string; color: string } {
  if (avg <= 2.0) return { grade: "S", color: "#ffd700" };
  if (avg <= 4.0) return { grade: "A", color: "#00c853" };
  if (avg <= 6.5) return { grade: "B", color: "#4488ff" };
  if (avg <= 9.0) return { grade: "C", color: "#ff8844" };
  return { grade: "D", color: "#e94560" };
}

function getRaceBadges(race: RaceData) {
  const badges: { label: string; color: string }[] = [];
  const startPos = race.position_history[0]?.position ?? null;
  const posGained =
    startPos != null && race.final_position != null
      ? startPos - race.final_position
      : null;

  if (race.final_position === 1) badges.push({ label: "1st Place", color: "#ffd700" });
  else if (race.final_position === 2) badges.push({ label: "2nd Place", color: "#c0c0c0" });
  else if (race.final_position === 3) badges.push({ label: "3rd Place", color: "#cd7f32" });

  if (posGained !== null && posGained >= 4)
    badges.push({ label: `Comeback +${posGained}`, color: "#00c853" });

  if (
    startPos === 1 &&
    race.final_position === 1 &&
    race.position_history.length > 4
  )
    badges.push({ label: "Wire-to-Wire", color: "#4488ff" });

  if (
    race.final_position != null &&
    race.avg_position != null &&
    race.final_position < race.avg_position - 1.5
  )
    badges.push({ label: "Strong Finish", color: "#ff8844" });

  return badges;
}

function getStartDelta(race: RaceData) {
  const start = race.position_history[0]?.position ?? null;
  const delta =
    start != null && race.final_position != null
      ? start - race.final_position
      : null;
  return { start, delta };
}

function getTop3Pct(race: RaceData): number | null {
  if (!race.position_history.length) return null;
  const top3 = race.position_history.filter((p) => p.position <= 3).length;
  return Math.round((top3 / race.position_history.length) * 100);
}

function getTierCounts(race: RaceData) {
  const ph = race.position_history;
  if (!ph.length) return null;
  const t1 = ph.filter((p) => p.position <= 3).length;
  const t2 = ph.filter((p) => p.position >= 4 && p.position <= 6).length;
  const t3 = ph.filter((p) => p.position > 6).length;
  return { t1, t2, t3, total: ph.length };
}

// ── Component ─────────────────────────────────────────────────────────────

export function DashboardTab() {
  const { frames, races, analyzing, setSelection, setFocusIdx, switchTab } =
    useAnalyzer();
  const chartRefs = useRef<import("chart.js").Chart[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const destroyCharts = useCallback(() => {
    chartRefs.current.forEach((c) => c.destroy());
    chartRefs.current = [];
  }, []);

  const navigateToFrame = useCallback(
    (timestamp: number) => {
      let bestIdx = 0,
        bestDist = Infinity;
      for (let i = 0; i < frames.length; i++) {
        const d = Math.abs(frames[i].timestamp - timestamp);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      setFocusIdx(bestIdx);
      setSelection([bestIdx]);
      switchTab("frames");
    },
    [frames, setFocusIdx, setSelection, switchTab]
  );

  useEffect(() => {
    let mounted = true;

    async function render() {
      if (!Chart) {
        const mod = await import("chart.js");
        mod.Chart.register(
          mod.CategoryScale,
          mod.LinearScale,
          mod.BarElement,
          mod.BarController,
          mod.LineElement,
          mod.LineController,
          mod.PointElement,
          mod.DoughnutController,
          mod.ArcElement,
          mod.Legend,
          mod.Tooltip,
          mod.Filler
        );
        mod.Chart.defaults.color = "#888";
        mod.Chart.defaults.borderColor = "#2a2a4a";
        Chart = mod.Chart;
      }
      if (!mounted) return;
      const ChartClass = Chart!;
      destroyCharts();

      if (frames.length === 0 || races.length === 0) return;

      // ── Overview bar + avg trend line ──────────────────────────────────
      if (races.length >= 2) {
        const canvas = document.getElementById(
          "chart-overview"
        ) as HTMLCanvasElement | null;
        if (canvas) {
          const finals = races.map((r) => r.final_position);
          const validFinals = finals.filter(Boolean) as number[];
          const sessionAvg = validFinals.length
            ? validFinals.reduce((a, b) => a + b, 0) / validFinals.length
            : null;

          const barColors = finals.map((p) => {
            if (p === 1) return "#ffd700";
            if (p === 2) return "#c0c0c0";
            if (p === 3) return "#cd7f32";
            if (p != null && p <= 6) return "#4488ff";
            if (p != null && p <= 12) return "rgba(68,136,255,0.45)";
            return "#e94560";
          });

          const datasets: Record<string, unknown>[] = [
            {
              type: "bar",
              label: "Final Position",
              data: finals,
              backgroundColor: barColors,
              borderRadius: 6,
              barThickness: 40,
              yAxisID: "y",
            },
          ];

          if (sessionAvg !== null) {
            datasets.push({
              type: "line",
              label: "Session Avg",
              data: races.map(() => sessionAvg),
              borderColor: "rgba(255,136,68,0.75)",
              borderWidth: 2,
              borderDash: [6, 4],
              pointRadius: 0,
              fill: false,
              tension: 0,
              yAxisID: "y",
            });
          }

          chartRefs.current.push(
            new ChartClass(canvas, {
              type: "bar",
              data: {
                labels: races.map((r) => "Race " + r.race_number),
                datasets: datasets as never,
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    reverse: true,
                    min: 0,
                    max: 13,
                    ticks: {
                      stepSize: 2,
                      callback: (v) => (v === 0 ? "" : ordinal(v as number)),
                    },
                    grid: { color: "rgba(255,255,255,0.05)" },
                  },
                  x: { grid: { display: false } },
                },
                plugins: {
                  legend: {
                    display: true,
                    labels: { usePointStyle: true, padding: 12 },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        if (ctx.dataset.label === "Final Position")
                          return ordinal(ctx.parsed.y) + " place";
                        return (
                          "Session avg: " +
                          ordinal(Math.round(ctx.parsed.y as number)) +
                          " place"
                        );
                      },
                    },
                  },
                },
              },
            })
          );
        }
      }

      // ── Finish distribution donut ──────────────────────────────────────
      const donutCanvas = document.getElementById(
        "chart-donut"
      ) as HTMLCanvasElement | null;
      if (donutCanvas) {
        const allFinals = races
          .map((r) => r.final_position)
          .filter(Boolean) as number[];
        const dWins = allFinals.filter((p) => p === 1).length;
        const dPodium = allFinals.filter((p) => p === 2 || p === 3).length;
        const dTop6 = allFinals.filter((p) => p >= 4 && p <= 6).length;
        const dRest = allFinals.filter((p) => p > 6).length;

        if (allFinals.length > 0) {
          chartRefs.current.push(
            new ChartClass(donutCanvas, {
              type: "doughnut",
              data: {
                labels: ["1st Place", "2nd–3rd", "4th–6th", "7th+"],
                datasets: [
                  {
                    data: [dWins, dPodium, dTop6, dRest],
                    backgroundColor: [
                      "#ffd700",
                      "#c0c0c0",
                      "#4488ff",
                      "rgba(233,69,96,0.45)",
                    ],
                    borderColor: "#12122a",
                    borderWidth: 3,
                    hoverOffset: 8,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                plugins: {
                  legend: {
                    display: true,
                    position: "right",
                    labels: {
                      padding: 14,
                      usePointStyle: true,
                      pointStyleWidth: 8,
                    },
                  },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => {
                        const val = ctx.parsed as number;
                        const pct = Math.round(
                          (val / allFinals.length) * 100
                        );
                        return ` ${val} race${val !== 1 ? "s" : ""} (${pct}%)`;
                      },
                    },
                  },
                },
              },
            })
          );
        }
      }

      // ── Session timeline ───────────────────────────────────────────────
      const timelineCanvas = document.getElementById(
        "chart-timeline"
      ) as HTMLCanvasElement | null;
      if (timelineCanvas) {
        const tData = frames.map((f) =>
          f.labels.scene === "in_race" ? 1 : 0
        );
        chartRefs.current.push(
          new ChartClass(timelineCanvas, {
            type: "bar",
            data: {
              labels: frames.map((f) => f.timestamp),
              datasets: [
                {
                  label: "In Race",
                  data: tData,
                  backgroundColor: tData.map((v) =>
                    v
                      ? "rgba(233,69,96,0.7)"
                      : "rgba(100,100,140,0.25)"
                  ),
                  borderWidth: 0,
                  barPercentage: 1.0,
                  categoryPercentage: 1.0,
                },
              ],
            },
            options: {
              onClick: (_ev, el) => {
                if (el.length)
                  navigateToFrame(frames[el[0].index].timestamp);
              },
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { display: false, max: 1.2 },
                x: {
                  title: {
                    display: true,
                    text: "Time (seconds)",
                    color: "#888",
                  },
                  grid: { display: false },
                  ticks: { maxTicksLimit: 20 },
                },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) =>
                      ctx.parsed.y === 1 ? "In Race" : "Not In Race",
                    title: (items) => items[0].label + "s",
                  },
                },
              },
            },
          })
        );
      }

      // ── Per-race charts ────────────────────────────────────────────────
      races.forEach((race) => {
        const cid = `chart-race-${race.race_number}`;
        const raceCanvas = document.getElementById(
          cid
        ) as HTMLCanvasElement | null;
        if (!raceCanvas) return;

        const hasPos = race.position_history.length > 0;
        const hasCoins = race.coin_history && race.coin_history.length > 0;
        if (!hasPos && !hasCoins) return;

        const merged = new Map<
          number,
          { position: number | null; coins: number | null; timestamp: number }
        >();
        for (const p of race.position_history || [])
          merged.set(p.relative_time, {
            position: p.position,
            coins: null,
            timestamp: p.timestamp,
          });
        for (const c of race.coin_history || []) {
          if (merged.has(c.relative_time))
            merged.get(c.relative_time)!.coins = c.coins;
          else
            merged.set(c.relative_time, {
              position: null,
              coins: c.coins,
              timestamp: c.timestamp,
            });
        }
        const sorted = [...merged.entries()].sort((a, b) => a[0] - b[0]);
        const timestamps = sorted.map(([, v]) => v.timestamp);
        const isSparse = sorted.length > 30;

        const datasets: Record<string, unknown>[] = [];

        if (hasPos) {
          datasets.push({
            label: "Position",
            data: sorted.map(([, v]) => v.position),
            yAxisID: "y",
            borderColor: "#e94560",
            backgroundColor: "rgba(233,69,96,0.07)",
            borderWidth: 2.5,
            pointRadius: isSparse ? 0 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#e94560",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            fill: true,
            tension: 0.3,
            spanGaps: true,
          });
        }
        if (hasCoins) {
          datasets.push({
            label: "Coins",
            data: sorted.map(([, v]) => v.coins),
            yAxisID: "y1",
            borderColor: "#ffd700",
            backgroundColor: "rgba(255,215,0,0.07)",
            borderWidth: 2.5,
            pointRadius: isSparse ? 0 : 3,
            pointHoverRadius: 5,
            pointBackgroundColor: "#ffd700",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
            fill: true,
            tension: 0.3,
            spanGaps: true,
          });
        }

        chartRefs.current.push(
          new ChartClass(raceCanvas, {
            type: "line",
            data: {
              labels: sorted.map(([rt]) => rt),
              datasets: datasets as never,
            },
            options: {
              onClick: (_ev, el) => {
                if (el.length && timestamps[el[0].index])
                  navigateToFrame(timestamps[el[0].index]);
              },
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              scales: {
                y: {
                  type: "linear",
                  display: hasPos,
                  position: "left",
                  reverse: true,
                  min: 0.5,
                  max: 12.5,
                  ticks: {
                    stepSize: 2,
                    callback: (v) => ordinal(Math.round(v as number)),
                    color: "#e94560",
                  },
                  grid: { color: "rgba(255,255,255,0.05)" },
                  title: {
                    display: hasPos,
                    text: "Position",
                    color: "#e94560",
                  },
                },
                y1: {
                  type: "linear",
                  display: hasCoins,
                  position: "right",
                  min: 0,
                  max: 12,
                  ticks: { stepSize: 2, color: "#ffd700" },
                  grid: { drawOnChartArea: false },
                  title: {
                    display: hasCoins,
                    text: "Coins",
                    color: "#ffd700",
                  },
                },
                x: {
                  title: {
                    display: true,
                    text: "Time into race (s)",
                    color: "#888",
                  },
                  grid: { color: "rgba(255,255,255,0.03)" },
                  ticks: { maxTicksLimit: 10 },
                },
              },
              plugins: {
                legend: {
                  display: true,
                  labels: { usePointStyle: true, padding: 12 },
                },
                tooltip: {
                  callbacks: {
                    label: (ctx) => {
                      if (
                        ctx.dataset.label === "Position" &&
                        ctx.parsed.y != null
                      )
                        return (
                          "Position: " +
                          ordinal(Math.round(ctx.parsed.y)) +
                          " place"
                        );
                      if (
                        ctx.dataset.label === "Coins" &&
                        ctx.parsed.y != null
                      )
                        return "Coins: " + ctx.parsed.y;
                      return "";
                    },
                    title: (items) =>
                      items[0]?.label != null
                        ? items[0].label + "s into race"
                        : "",
                  },
                },
              },
            },
          })
        );
      });
    }

    const t = setTimeout(render, 50);
    return () => {
      mounted = false;
      clearTimeout(t);
      destroyCharts();
    };
  }, [frames, races, destroyCharts, navigateToFrame]);

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (analyzing && frames.length === 0) {
    return (
      <div
        style={{ padding: "1.2rem" }}
        role="status"
        aria-label="Loading analysis"
      >
        <div className="summary-bar">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-20 flex-1"
              style={{ minWidth: 110, borderRadius: 10, background: "var(--card)" }}
            />
          ))}
        </div>
        <div className="section-wrap">
          <Skeleton
            className="h-64 w-full"
            style={{ borderRadius: 10, background: "var(--card)" }}
          />
        </div>
      </div>
    );
  }

  if (frames.length === 0 || races.length === 0) {
    return (
      <div className="dash-empty" role="status">
        {frames.length > 0
          ? "No races detected. Correct scene labels in the Frames tab — changes save automatically."
          : "Load a video and run analysis to see results."}
      </div>
    );
  }

  // ── Computed session stats ─────────────────────────────────────────────
  const allFinals = races
    .filter((r) => r.final_position)
    .map((r) => r.final_position!);
  const avgFinalNum = allFinals.length
    ? allFinals.reduce((a, b) => a + b, 0) / allFinals.length
    : null;
  const avgFinalStr = avgFinalNum != null ? avgFinalNum.toFixed(1) : "?";
  const wins = allFinals.filter((p) => p === 1).length;
  const podiums = allFinals.filter((p) => p <= 3).length;
  const bestFinish = allFinals.length ? Math.min(...allFinals) : null;
  const totalTime = races.reduce((a, r) => a + r.duration, 0);
  const winRate = allFinals.length
    ? Math.round((wins / allFinals.length) * 100)
    : 0;
  const podiumRate = allFinals.length
    ? Math.round((podiums / allFinals.length) * 100)
    : 0;
  const grade = avgFinalNum != null ? sessionGrade(avgFinalNum) : null;

  const racesWithCoins = races.filter((r) => r.final_coins != null);
  const avgCoins =
    racesWithCoins.length
      ? (
          racesWithCoins.reduce((a, r) => a + r.final_coins!, 0) /
          racesWithCoins.length
        ).toFixed(1)
      : null;

  const totalMins = Math.floor(totalTime / 60);
  const totalSecs = String(Math.round(totalTime % 60)).padStart(2, "0");
  const avgRaceTime =
    races.length > 0 ? Math.round(totalTime / races.length) : 0;

  return (
    <div ref={containerRef} role="region" aria-label="Dashboard">

      {/* ── Summary cards ── */}
      <div className="summary-bar" role="list" aria-label="Race summary">
        {grade && (
          <div className="summary-card" role="listitem">
            <div className="big" style={{ color: grade.color, fontSize: "2.2rem" }}>
              {grade.grade}
            </div>
            <div className="label">Session Grade</div>
          </div>
        )}
        <div className="summary-card" role="listitem">
          <div className="big">{races.length}</div>
          <div className="label">Races</div>
        </div>
        <div className="summary-card" role="listitem">
          <div className="big">{avgFinalStr}</div>
          <div className="label">Avg Finish</div>
        </div>
        <div className="summary-card" role="listitem">
          <div className="big" style={{ color: "#ffd700" }}>{wins}</div>
          <div className="label">Wins</div>
        </div>
        <div className="summary-card" role="listitem">
          <div className="big">{podiums}</div>
          <div className="label">Podiums</div>
        </div>
        {bestFinish != null && (
          <div className="summary-card" role="listitem">
            <div
              className="big"
              style={{
                color:
                  bestFinish === 1
                    ? "#ffd700"
                    : bestFinish <= 3
                    ? "#00c853"
                    : undefined,
              }}
            >
              {ordinal(bestFinish)}
            </div>
            <div className="label">Best Finish</div>
          </div>
        )}
        {avgCoins != null && (
          <div className="summary-card" role="listitem">
            <div className="big" style={{ color: "#cca300" }}>{avgCoins}</div>
            <div className="label">Avg Coins</div>
          </div>
        )}
      </div>

      {/* ── Performance breakdown row ── */}
      <div className="section-wrap">
        <div className="perf-breakdown">
          <div className="perf-card">
            <div
              className="perf-card-pct"
              style={{ color: winRate >= 50 ? "#ffd700" : winRate >= 25 ? "#4488ff" : "#888" }}
            >
              {winRate}%
            </div>
            <div className="perf-card-label">Win Rate</div>
            <div className="perf-card-sub">
              {wins} of {allFinals.length} races
            </div>
          </div>
          <div className="perf-card">
            <div
              className="perf-card-pct"
              style={{ color: podiumRate >= 50 ? "#cd7f32" : podiumRate >= 25 ? "#4488ff" : "#888" }}
            >
              {podiumRate}%
            </div>
            <div className="perf-card-label">Podium Rate</div>
            <div className="perf-card-sub">
              {podiums} of {allFinals.length} races
            </div>
          </div>
          <div className="perf-card">
            <div className="perf-card-pct" style={{ color: "#4488ff" }}>
              {totalMins}:{totalSecs}
            </div>
            <div className="perf-card-label">Total Race Time</div>
            <div className="perf-card-sub">{avgRaceTime}s avg per race</div>
          </div>
        </div>
      </div>

      {/* ── Overview + donut ── */}
      {races.length >= 2 && (
        <div className="section-wrap">
          <div className="dash-grid-2">
            <div className="section-card">
              <h3>Final Positions Across Races</h3>
              <div className="chart-box">
                <canvas
                  id="chart-overview"
                  aria-label="Final positions bar chart"
                  role="img"
                />
              </div>
            </div>
            <div className="section-card">
              <h3>Finish Distribution</h3>
              <div className="chart-box">
                <canvas
                  id="chart-donut"
                  aria-label="Finish position distribution donut chart"
                  role="img"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Session timeline ── */}
      <div className="section-wrap">
        <div className="section-card">
          <h3>Session Timeline</h3>
          <div className="chart-box short">
            <canvas
              id="chart-timeline"
              aria-label="Session timeline chart"
              role="img"
            />
          </div>
        </div>
      </div>

      {/* ── Per-race cards ── */}
      <div className="section-wrap">
        {races.map((race) => {
          const { start, delta } = getStartDelta(race);
          const top3pct = getTop3Pct(race);
          const tiers = getTierCounts(race);
          const badges = getRaceBadges(race);
          const fp = race.final_position ? ordinal(race.final_position) : "?";
          const bp = race.best_position ? ordinal(race.best_position) : "?";
          const avg =
            race.avg_position != null ? race.avg_position.toFixed(1) : "?";
          const fc = race.final_coins != null ? race.final_coins : "?";
          const hasCoins =
            race.coin_history && race.coin_history.length > 0;

          const borderColor =
            race.final_position === 1
              ? "#ffd700"
              : race.final_position === 2
              ? "#c0c0c0"
              : race.final_position === 3
              ? "#cd7f32"
              : undefined;

          return (
            <article
              key={race.race_number}
              className="race-card"
              style={borderColor ? { borderColor } : undefined}
              aria-label={`Race ${race.race_number}`}
            >
              <div className="race-card-header">
                <div className="race-card-header-left">
                  <h3>Race {race.race_number}</h3>
                  {badges.length > 0 && (
                    <div className="race-badge-row">
                      {badges.map((b) => (
                        <span
                          key={b.label}
                          className="race-badge"
                          style={{
                            color: b.color,
                            borderColor: b.color + "55",
                            background: b.color + "18",
                          }}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="race-duration">{race.duration}s</span>
              </div>

              <div
                className="race-stats"
                role="list"
                aria-label="Race statistics"
              >
                <div className="stat" role="listitem">
                  <div className="stat-val final-pos">{fp}</div>
                  <div className="stat-label">Final</div>
                </div>
                {start != null && (
                  <div className="stat" role="listitem">
                    <div className="stat-val">{ordinal(start)}</div>
                    <div className="stat-label">Start</div>
                  </div>
                )}
                {delta !== null && (
                  <div className="stat" role="listitem">
                    <div
                      className={`stat-val ${
                        delta > 0
                          ? "pos-gained"
                          : delta < 0
                          ? "pos-lost"
                          : ""
                      }`}
                    >
                      {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : "—"}
                    </div>
                    <div className="stat-label">Gained</div>
                  </div>
                )}
                <div className="stat" role="listitem">
                  <div className="stat-val best-pos">{bp}</div>
                  <div className="stat-label">Best</div>
                </div>
                <div className="stat" role="listitem">
                  <div className="stat-val">{avg}</div>
                  <div className="stat-label">Avg Pos</div>
                </div>
                {top3pct !== null && (
                  <div className="stat" role="listitem">
                    <div
                      className="stat-val"
                      style={{
                        color: top3pct >= 50 ? "#00c853" : undefined,
                      }}
                    >
                      {top3pct}%
                    </div>
                    <div className="stat-label">In Top 3</div>
                  </div>
                )}
                <div className="stat" role="listitem">
                  <div className="stat-val">{race.position_changes}</div>
                  <div className="stat-label">Changes</div>
                </div>
                {hasCoins && (
                  <div className="stat" role="listitem">
                    <div className="stat-val" style={{ color: "#cca300" }}>
                      {fc}
                    </div>
                    <div className="stat-label">Coins</div>
                  </div>
                )}
                {hasCoins && race.max_coins != null && (
                  <div className="stat" role="listitem">
                    <div className="stat-val" style={{ color: "#cca300" }}>
                      {race.max_coins}
                    </div>
                    <div className="stat-label">Max Coins</div>
                  </div>
                )}
              </div>

              {/* Position tier bar */}
              {tiers && (
                <div className="pos-tier-wrap">
                  <div className="pos-tier-bar">
                    {tiers.t1 > 0 && (
                      <div
                        className="pos-tier-seg pos-tier-top3"
                        style={{ width: `${(tiers.t1 / tiers.total) * 100}%` }}
                        title={`Top 3: ${Math.round((tiers.t1 / tiers.total) * 100)}%`}
                      />
                    )}
                    {tiers.t2 > 0 && (
                      <div
                        className="pos-tier-seg pos-tier-mid"
                        style={{ width: `${(tiers.t2 / tiers.total) * 100}%` }}
                        title={`4th–6th: ${Math.round((tiers.t2 / tiers.total) * 100)}%`}
                      />
                    )}
                    {tiers.t3 > 0 && (
                      <div
                        className="pos-tier-seg pos-tier-low"
                        style={{ width: `${(tiers.t3 / tiers.total) * 100}%` }}
                        title={`7th+: ${Math.round((tiers.t3 / tiers.total) * 100)}%`}
                      />
                    )}
                  </div>
                  <div className="pos-tier-legend">
                    <span className="pos-tier-key pos-tier-key--top3">
                      Top 3 · {Math.round((tiers.t1 / tiers.total) * 100)}%
                    </span>
                    <span className="pos-tier-key pos-tier-key--mid">
                      4–6 · {Math.round((tiers.t2 / tiers.total) * 100)}%
                    </span>
                    <span className="pos-tier-key pos-tier-key--low">
                      7+ · {Math.round((tiers.t3 / tiers.total) * 100)}%
                    </span>
                  </div>
                </div>
              )}

              <div className="race-chart-box">
                <canvas
                  id={`chart-race-${race.race_number}`}
                  aria-label={`Race ${race.race_number} position and coins chart`}
                  role="img"
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
