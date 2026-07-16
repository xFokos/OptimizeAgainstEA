import type { ProbeResult } from '../../../types/map';

interface ProbeMarkerProps {
  probe: ProbeResult;
  index: number;
  isBest: boolean;
  isHovered?: boolean;
  onHover?: (index: number) => void;
}

function valueToColor(value: number): string {
  const r = Math.round(Math.min(255, value * 2 * 255));
  const g = Math.round(Math.min(255, (1 - value) * 2 * 255));
  return `rgb(${r},${g},60)`;
}

export function ProbeMarker({ probe, index, isBest, isHovered = false, onHover }: ProbeMarkerProps) {
  // Probes inside the win zone are tinted blue (and always glow) so that after
  // "Keep Playing" the cluster of blue dots reveals how big the win radius is.
  const color = probe.isWin ? 'var(--accent)' : valueToColor(probe.value);
  const highlighted = isBest || isHovered;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${probe.position.x * 100}%`,
        top:  `${probe.position.y * 100}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: isHovered ? 20 : isBest ? 10 : 5,
        pointerEvents: onHover ? 'all' : 'none',
        cursor: onHover ? 'pointer' : 'default',
      }}
      onMouseEnter={() => onHover?.(index)}
      onMouseLeave={() => onHover?.(-1)}
    >
      {/* Dot */}
      <div style={{
        width:        highlighted ? 16 : 10,
        height:       highlighted ? 16 : 10,
        borderRadius: '50%',
        background:   color,
        border:       isHovered  ? '2px solid #fff'
          : isBest     ? '2px solid #fff'
            : probe.isWin ? '1.5px solid var(--accent)'
              :            '1.5px solid rgba(255,255,255,0.3)',
        boxShadow:    highlighted ? `0 0 12px ${color}`
          : probe.isWin ? '0 0 8px var(--accent)'
            :             'none',
        transition:   'all 0.12s ease',
      }} />
    </div>
  );
}