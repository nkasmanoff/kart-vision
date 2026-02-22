"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAnalyzer } from "@/lib/analyzer-context";
import { ordinal } from "@/lib/analyzer-types";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import Chart.js to avoid SSR issues
let Chart: typeof import("chart.js").Chart | null = null;

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
          mod.Legend,
          mod.Tooltip,
          mod.Filler
        );
        mod.Chart.defaults.color = "#888";
        mod.Chart.defaults.borderColor = "#2a2a4a";
        Chart = mod.Chart;
      }
      if (!mounted) return;
      destroyCharts();

      if (frames.length === 0 || races.length === 0) return;

      // Overview bar chart
      if (races.length >= 2) {
        const canvas = document.getElementById(
          "chart-overview"
        ) as HTMLCanvasElement | null;
        if (canvas) {
          const oData = races.map((r) => r.final_position);
          const oColors = oData.map((p) => {
            if (p === 1) return "#ffd700";
            if (p === 2) return "#c0c0c0";
            if (p === 3) return "#cd7f32";
            if (p != null && p <= 6) return "#4488ff";
            if (p != null && p <= 12) return "#66aaff";
            return "#e94560";
          });
          chartRefs.current.push(
            new Chart(canvas, {
              type: "bar",
              data: {
                labels: races.map((r) => "Race " + r.race_number),
                datasets: [
                  {
                    label: "Final Position",
                    data: oData,
                    backgroundColor: oColors,
                    borderRadius: 6,
                    barThickness: 40,
                  },
                ],
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    reverse: true,
                    min: 0,
                    max: 25,
                    ticks: {
                      stepSize: 2,
                      callback: (v) =>
                        v === 0 ? "" : ordinal(v as number),
                    },
                    grid: { color: "rgba(255,255,255,0.05)" },
                  },
                  x: { grid: { display: false } },
                },
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) =>
                        ordinal(ctx.parsed.y) + " place",
                    },
                  },
                },
              },
            })
          );
        }
      }

      // Timeline
      const timelineCanvas = document.getElementById(
        "chart-timeline"
      ) as HTMLCanvasElement | null;
      if (timelineCanvas) {
        const tData = frames.map((f) =>
          f.labels.scene === "in_race" ? 1 : 0
        );
        chartRefs.current.push(
          new Chart(timelineCanvas, {
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
                      : "rgba(100,100,140,0.3)"
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

      // Per-race charts
      races.forEach((race) => {
        const cid = `chart-race-${race.race_number}`;
        const raceCanvas = document.getElementById(
          cid
        ) as HTMLCanvasElement | null;
        if (!raceCanvas) return;

        const hasPos = race.position_history.length > 0;
        const hasCoins = race.coin_history && race.coin_history.length > 0;

        if (hasPos || hasCoins) {
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

          const datasets: Record<string, unknown>[] = [];
          if (hasPos) {
            datasets.push({
              label: "Position",
              data: sorted.map(([, v]) => v.position),
              yAxisID: "y",
              borderColor: "#e94560",
              backgroundColor: "rgba(233,69,96,0.1)",
              borderWidth: 2.5,
              pointRadius: 3,
              pointBackgroundColor: "#e94560",
              pointBorderColor: "#fff",
              pointBorderWidth: 1,
              fill: true,
              tension: 0.2,
            });
          }
          if (hasCoins) {
            datasets.push({
              label: "Coins",
              data: sorted.map(([, v]) => v.coins),
              yAxisID: "y1",
              borderColor: "#ffd700",
              backgroundColor: "rgba(255,215,0,0.1)",
              borderWidth: 2.5,
              pointRadius: 3,
              pointBackgroundColor: "#ffd700",
              pointBorderColor: "#fff",
              pointBorderWidth: 1,
              fill: true,
              tension: 0.2,
            });
          }

          chartRefs.current.push(
            new Chart(raceCanvas, {
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
                    max: 24.5,
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
                    max: 20.5,
                    ticks: { stepSize: 1, color: "#ffd700" },
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
                      text: "Time (seconds)",
                      color: "#888",
                    },
                    grid: { color: "rgba(255,255,255,0.03)" },
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
                        items[0] && items[0].label != null
                          ? items[0].label + "s into race"
                          : "",
                    },
                  },
                },
              },
            })
          );
        }
      });
    }

    // small delay so DOM is ready after state update
    const t = setTimeout(render, 50);
    return () => {
      mounted = false;
      clearTimeout(t);
      destroyCharts();
    };
  }, [frames, races, destroyCharts, navigateToFrame]);

  // Loading skeleton
  if (analyzing && frames.length === 0) {
    return (
      <div style={{ padding: "1.2rem" }} role="status" aria-label="Loading analysis">
        <div className="summary-bar">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-20 flex-1"
              style={{
                minWidth: 110,
                borderRadius: 10,
                background: "var(--card)",
              }}
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
          ? "No races detected. Correct scene labels and click Re-Analyze."
          : "Load a video and run analysis to see results."}
      </div>
    );
  }

  const allFinals = races
    .filter((r) => r.final_position)
    .map((r) => r.final_position!);
  const avgFinal = allFinals.length
    ? (allFinals.reduce((a, b) => a + b, 0) / allFinals.length).toFixed(1)
    : "?";
  const wins = allFinals.filter((p) => p === 1).length;
  const podiums = allFinals.filter((p) => p <= 3).length;
  const totalTime = races.reduce((a, r) => a + r.duration, 0);

  const summaryCards = [
    { big: races.length, label: "Races" },
    { big: avgFinal, label: "Avg Finish" },
    { big: wins, label: "Wins" },
    { big: podiums, label: "Podiums" },
    { big: Math.round(totalTime) + "s", label: "Total Race Time" },
  ];

  return (
    <div ref={containerRef} role="region" aria-label="Dashboard">
      {/* Summary cards */}
      <div className="summary-bar" role="list" aria-label="Race summary">
        {summaryCards.map((c, i) => (
          <div key={i} className="summary-card" role="listitem">
            <div className="big">{c.big}</div>
            <div className="label">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Overview bar chart */}
      {races.length >= 2 && (
        <div className="section-wrap">
          <div className="section-card">
            <h3>Final Positions Across Races</h3>
            <div className="chart-box">
              <canvas id="chart-overview" aria-label="Final positions bar chart" role="img" />
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="section-wrap">
        <div className="section-card">
          <h3>Session Timeline</h3>
          <div className="chart-box short">
            <canvas id="chart-timeline" aria-label="Session timeline chart" role="img" />
          </div>
        </div>
      </div>

      {/* Per-race cards */}
      <div className="section-wrap">
        {races.map((race) => {
          const fp = race.final_position
            ? ordinal(race.final_position)
            : "?";
          const bp = race.best_position
            ? ordinal(race.best_position)
            : "?";
          const wp = race.worst_position
            ? ordinal(race.worst_position)
            : "?";
          const avg =
            race.avg_position != null
              ? race.avg_position.toFixed(1)
              : "?";
          const fc =
            race.final_coins != null ? race.final_coins : "?";
          const maxc = race.max_coins != null ? race.max_coins : "?";
          const hasCoins =
            race.coin_history && race.coin_history.length > 0;

          return (
            <article
              key={race.race_number}
              className="race-card"
              aria-label={`Race ${race.race_number}`}
            >
              <div className="race-card-header">
                <h3>Race {race.race_number}</h3>
                <span className="race-duration">
                  {race.duration}s
                </span>
              </div>
              <div className="race-stats" role="list" aria-label="Race statistics">
                <div className="stat" role="listitem">
                  <div className="stat-val final-pos">{fp}</div>
                  <div className="stat-label">Final</div>
                </div>
                <div className="stat" role="listitem">
                  <div className="stat-val best-pos">{bp}</div>
                  <div className="stat-label">Best</div>
                </div>
                <div className="stat" role="listitem">
                  <div className="stat-val worst-pos">{wp}</div>
                  <div className="stat-label">Worst</div>
                </div>
                <div className="stat" role="listitem">
                  <div className="stat-val">{avg}</div>
                  <div className="stat-label">Avg</div>
                </div>
                <div className="stat" role="listitem">
                  <div className="stat-val">
                    {race.position_changes}
                  </div>
                  <div className="stat-label">Changes</div>
                </div>
                {hasCoins && (
                  <>
                    <div className="stat" role="listitem">
                      <div className="stat-val">{fc}</div>
                      <div className="stat-label">Coins</div>
                    </div>
                    <div className="stat" role="listitem">
                      <div className="stat-val">{maxc}</div>
                      <div className="stat-label">{"Max \u00A2"}</div>
                    </div>
                  </>
                )}
              </div>
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
