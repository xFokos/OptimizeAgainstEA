import type { ProbeResult } from '../../../types/map';

interface ProbeMarkerProps {
  probe: ProbeResult;
  index: number;
  isBest: boolean;
}

// Maps value 0–1 to a colour: green (low/good) → yellow → red (high/far)
function valueToColor(value: number): string {
  const r = Math.round(Math.min(255, value * 2 * 255));
  const g = Math.round(Math.min(255, (1 - value) * 2 * 255));
  return `rgb(${r},${g},60)`;
}

export function ProbeMarker({ probe, isBest }: ProbeMarkerProps) {
  const color = valueToColor(probe.value);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${probe.position.x * 100}%`,
        top:  `${probe.position.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isBest ? 10 : 5,
        pointerEvents: 'none',
      }}
    >
      {/* Dot */}
      <div style={{
        width:  isBest ? 14 : 10,
        height: isBest ? 14 : 10,
        borderRadius: '50%',
        background: color,
        border: isBest ? '2px solid #fff' : '1.5px solid rgba(255,255,255,0.3)',
        boxShadow: isBest ? `0 0 10px ${color}` : 'none',
        transition: 'all 0.15s',
      }} />

      {/* Value label — only on best or last probe */}
      {isBest && (
        <div style={{
          position: 'absolute',
          top: -22,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(13,15,18,0.9)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 3,
          padding: '1px 5px',
          fontSize: '0.62rem',
          fontFamily: 'var(--font-mono)',
          color: '#e8eaf0',
          whiteSpace: 'nowrap',
        }}>
          {probe.value.toFixed(3)}
        </div>
      )}
    </div>
  );
}
