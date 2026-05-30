import { useMemo } from 'react';

export interface FitnessSeries {
  label: string;
  /** One value per step — the best fitness seen up to and including that step */
  data: number[];
  color: string;
}

interface FitnessChartProps {
  series: FitnessSeries[];
  /** Y-axis domain max. Defaults to 1. */
  yMax?: number;
  /** Compact mode — shorter height for sidebar use */
  compact?: boolean;
}

const W = 400;
const H_FULL = 140;
const H_COMPACT = 90;
const PAD = { top: 10, right: 10, bottom: 24, left: 36 };
// INNER_W / INNER_H are computed inside the component based on compact prop
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1.0];

export function FitnessChart({ series, yMax = 1, compact = false }: FitnessChartProps) {
  const H       = compact ? H_COMPACT : H_FULL;
  const INNER_W = W - PAD.left - PAD.right;
  const INNER_H = H - PAD.top  - PAD.bottom;
  // Find the longest series to set the x-axis domain
  const maxLen = useMemo(
    () => Math.max(1, ...series.map((s) => s.data.length)),
    [series],
  );

  const toX = (i: number) =>
    PAD.left + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * INNER_W);

  const toY = (v: number) =>
    PAD.top + INNER_H - (v / yMax) * INNER_H;

  // Build an SVG polyline points string for one series
  const points = (data: number[]) => {
    if (data.length === 0) return '';
    if (data.length === 1) {
      const x = PAD.left;
      const y = toY(data[0]);
      return `${x},${y} ${PAD.left + INNER_W},${y}`;
    }
    return data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  };

  // X-axis tick count — keep it sparse
  const xTicks = useMemo(() => {
    if (maxLen <= 1) return [0];
    const step = Math.ceil(maxLen / 5);
    const ticks: number[] = [];
    for (let i = 0; i < maxLen; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== maxLen - 1) ticks.push(maxLen - 1);
    return ticks;
  }, [maxLen]);

  return (
    <div className="fitness-chart">
      {/* Legend */}
      {series.length > 1 && (
        <div className="fitness-chart__legend">
          {series.map((s) => (
            <div key={s.label} className="fitness-chart__legend-item">
              <span className="fitness-chart__legend-swatch" style={{ background: s.color }} />
              <span className="fitness-chart__legend-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Fitness over time"
      >
        {/* ── Grid lines ── */}
        {Y_TICKS.map((t) => {
          const y = toY(t * yMax);
          return (
            <line
              key={t}
              x1={PAD.left} y1={y}
              x2={PAD.left + INNER_W} y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={0.5}
            />
          );
        })}

        {/* ── Y axis labels ── */}
        {Y_TICKS.map((t) => (
          <text
            key={t}
            x={PAD.left - 5}
            y={toY(t * yMax)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={8}
            fill="rgba(255,255,255,0.35)"
            fontFamily="monospace"
          >
            {(t * yMax).toFixed(2)}
          </text>
        ))}

        {/* ── X axis labels ── */}
        {xTicks.map((i) => (
          <text
            key={i}
            x={toX(i)}
            y={PAD.top + INNER_H + 10}
            textAnchor="middle"
            fontSize={8}
            fill="rgba(255,255,255,0.35)"
            fontFamily="monospace"
          >
            {i + 1}
          </text>
        ))}

        {/* ── Axis lines ── */}
        <line
          x1={PAD.left} y1={PAD.top}
          x2={PAD.left} y2={PAD.top + INNER_H}
          stroke="rgba(255,255,255,0.15)" strokeWidth={0.5}
        />
        <line
          x1={PAD.left} y1={PAD.top + INNER_H}
          x2={PAD.left + INNER_W} y2={PAD.top + INNER_H}
          stroke="rgba(255,255,255,0.15)" strokeWidth={0.5}
        />

        {/* ── Series lines ── */}
        {series.map((s) => (
          <polyline
            key={s.label}
            points={points(s.data)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
        ))}

        {/* ── Dots at each data point (only when few points) ── */}
        {series.map((s) =>
          s.data.length <= 40
            ? s.data.map((v, i) => (
              <circle
                key={i}
                cx={toX(i)}
                cy={toY(v)}
                r={2}
                fill={s.color}
                opacity={0.8}
              />
            ))
            : null,
        )}

        {/* ── Axis labels ── */}
        <text
          x={PAD.left - 28}
          y={PAD.top + INNER_H / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={8}
          fill="rgba(255,255,255,0.3)"
          fontFamily="monospace"
          transform={`rotate(-90, ${PAD.left - 28}, ${PAD.top + INNER_H / 2})`}
        >
          fitness
        </text>
        <text
          x={PAD.left + INNER_W / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={8}
          fill="rgba(255,255,255,0.3)"
          fontFamily="monospace"
        >
          probe #
        </text>
      </svg>
    </div>
  );
}