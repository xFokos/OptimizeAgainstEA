import React, { useMemo, useRef, useCallback } from 'react';

export interface FitnessSeries {
  label: string;
  data: number[];
  color: string;
}

interface FitnessChartProps {
  series: FitnessSeries[];
  yMax?: number;
  compact?: boolean;
  /** Index of the currently hovered probe (-1 = none) */
  hoveredIndex?: number;
  onHover?: (index: number) => void;
}

const W = 400;
const H_FULL    = 300;
const H_COMPACT = 240;
const PAD = { top: 10, right: 10, bottom: 24, left: 36 };
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1.0];

export function FitnessChart({
                               series,
                               yMax = 1,
                               compact = false,
                               hoveredIndex = -1,
                               onHover,
                             }: FitnessChartProps) {
  const H       = compact ? H_COMPACT : H_FULL;
  const INNER_W = W - PAD.left - PAD.right;
  const INNER_H = H - PAD.top  - PAD.bottom;
  const svgRef  = useRef<SVGSVGElement>(null);

  const maxLen = useMemo(
    () => Math.max(1, ...series.map((s) => s.data.length)),
    [series],
  );

  const toX = (i: number) =>
    PAD.left + (maxLen <= 1 ? 0 : (i / (maxLen - 1)) * INNER_W);
  const toY = (v: number) =>
    PAD.top + INNER_H - (v / yMax) * INNER_H;

  const points = (data: number[]) => {
    if (data.length === 0) return '';
    if (data.length === 1) {
      const x = PAD.left;
      const y = toY(data[0]);
      return `${x},${y} ${PAD.left + INNER_W},${y}`;
    }
    return data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  };

  const xTicks = useMemo(() => {
    if (maxLen <= 1) return [0];
    const step = Math.ceil(maxLen / 5);
    const ticks: number[] = [];
    for (let i = 0; i < maxLen; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== maxLen - 1) ticks.push(maxLen - 1);
    return ticks;
  }, [maxLen]);

  // Resolve which data point is nearest to the mouse x position
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!onHover || maxLen <= 0 || !svgRef.current) return;
    const rect   = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    // Scale from pixel space to SVG viewBox x space
    const svgX   = (mouseX / rect.width) * W;
    const relX   = svgX - PAD.left;
    const idx    = Math.round((relX / INNER_W) * (maxLen - 1));
    onHover(Math.max(0, Math.min(maxLen - 1, idx)));
  }, [onHover, maxLen, INNER_W]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(-1);
  }, [onHover]);

  return (
    <div className="fitness-chart">
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
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', display: 'block', cursor: onHover ? 'crosshair' : 'default' }}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Fitness over time"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        {Y_TICKS.map((t) => {
          const y = toY(t * yMax);
          return <line key={t} x1={PAD.left} y1={y} x2={PAD.left + INNER_W} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} />;
        })}

        {/* Y axis labels */}
        {Y_TICKS.map((t) => (
          <text key={t} x={PAD.left - 5} y={toY(t * yMax)} textAnchor="end" dominantBaseline="middle" fontSize={8} fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            {(t * yMax).toFixed(2)}
          </text>
        ))}

        {/* X axis labels */}
        {xTicks.map((i) => (
          <text key={i} x={toX(i)} y={PAD.top + INNER_H + 10} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.35)" fontFamily="monospace">
            {i + 1}
          </text>
        ))}

        {/* Axis lines */}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + INNER_H} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
        <line x1={PAD.left} y1={PAD.top + INNER_H} x2={PAD.left + INNER_W} y2={PAD.top + INNER_H} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />

        {/* Series lines */}
        {series.map((s) => (
          <polyline key={s.label} points={points(s.data)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
        ))}

        {/* Dots — always shown, highlighted on hover */}
        {series.map((s) =>
          s.data.map((v, i) => {
            const isHovered = i === hoveredIndex;
            return (
              <circle
                key={i}
                cx={toX(i)}
                cy={toY(v)}
                r={isHovered ? 4 : 2}
                fill={s.color}
                opacity={isHovered ? 1 : 0.6}
                stroke={isHovered ? '#fff' : 'none'}
                strokeWidth={isHovered ? 1 : 0}
                style={{ transition: 'r 0.1s, opacity 0.1s' }}
              />
            );
          })
        )}

        {/* Hover vertical line */}
        {hoveredIndex >= 0 && hoveredIndex < maxLen && (
          <line
            x1={toX(hoveredIndex)} y1={PAD.top}
            x2={toX(hoveredIndex)} y2={PAD.top + INNER_H}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={0.75}
            strokeDasharray="3 2"
          />
        )}

        {/* Hover value tooltip */}
        {hoveredIndex >= 0 && hoveredIndex < maxLen && series[0]?.data[hoveredIndex] != null && (() => {
          const x = toX(hoveredIndex);
          const flip = x > PAD.left + INNER_W * 0.7; // flip to left side when near right edge
          return (
            <g>
              <rect
                x={flip ? x - 52 : x + 6}
                y={PAD.top + 2}
                width={46}
                height={series.length * 13 + 4}
                rx={2}
                fill="rgba(13,15,18,0.88)"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth={0.5}
              />
              {series.map((s, si) => (
                s.data[hoveredIndex] != null && (
                  <text
                    key={s.label}
                    x={flip ? x - 29 : x + 29}
                    y={PAD.top + 10 + si * 13}
                    textAnchor="middle"
                    fontSize={7}
                    fill={s.color}
                    fontFamily="monospace"
                  >
                    {s.data[hoveredIndex].toFixed(3)}
                  </text>
                )
              ))}
            </g>
          );
        })()}

        {/* Axis labels */}
        <text x={PAD.left - 28} y={PAD.top + INNER_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace" transform={`rotate(-90, ${PAD.left - 28}, ${PAD.top + INNER_H / 2})`}>fitness</text>
        <text x={PAD.left + INNER_W / 2} y={H - 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily="monospace">probe #</text>
      </svg>
    </div>
  );
}