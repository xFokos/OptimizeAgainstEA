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
  const color = valueToColor(probe.value);
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
            :              '1.5px solid rgba(255,255,255,0.3)',
        boxShadow:    highlighted ? `0 0 12px ${color}` : 'none',
        transition:   'all 0.12s ease',
      }} />

      {/* Value label — best or hovered */}
      {highlighted && (
        <div style={{
          position:   'absolute',
          top:        -22,
          left:       '50%',
          transform:  'translateX(-50%)',
          background: 'rgba(13,15,18,0.92)',
          border:     '1px solid rgba(255,255,255,0.18)',
          borderRadius: 3,
          padding:    '1px 5px',
          fontSize:   '0.62rem',
          fontFamily: 'var(--font-mono)',
          color:      '#e8eaf0',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          #{index + 1} · {probe.value.toFixed(3)}
        </div>
      )}
    </div>
  );
}