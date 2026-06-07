import { sampleGradientRgb } from '../../../../engine/colorScale';
import type { IndividualSnapshot } from '../../../../engine/ea/eaReplayLog';

export type IndividualRole =
  | 'normal' | 'elite' | 'parentA' | 'parentB' | 'child' | 'solution' | 'dim'
  | 'winner' | 'candidate' | 'eligible';

interface IndividualListProps {
  individuals:  IndividualSnapshot[];
  roles?:       Map<string, IndividualRole>;
  title?:       string;
  /** Per-individual right-side annotation (e.g. "42%" for roulette weight) */
  annotations?: Map<string, string>;
  /** Max rows to show before cutting */
  maxRows?:     number;
}

const ROLE_STYLES: Record<IndividualRole, { bg: string; label?: string; textColor?: string }> = {
  normal:    { bg: 'transparent' },
  elite:     { bg: 'rgba(240,196,74,0.15)',  label: 'ELITE',     textColor: '#f0c44a' },
  parentA:   { bg: 'rgba(74,240,160,0.15)',  label: 'PARENT A',  textColor: '#4af0a0' },
  parentB:   { bg: 'rgba(74,144,240,0.15)',  label: 'PARENT B',  textColor: '#4a90f0' },
  child:     { bg: 'rgba(255,255,255,0.08)', label: 'CHILD',     textColor: '#e8eaf0' },
  solution:  { bg: 'rgba(74,240,160,0.25)',  label: '✓ WIN',     textColor: '#4af0a0' },
  dim:       { bg: 'transparent' },
  winner:    { bg: 'rgba(240,196,74,0.20)',  label: 'WINNER',    textColor: '#f0c44a' },
  candidate: { bg: 'rgba(240,160,74,0.15)',  label: 'CANDIDATE', textColor: '#f0a04a' },
  eligible:  { bg: 'rgba(74,144,240,0.15)',  label: 'ELIGIBLE',  textColor: '#4a90f0' },
};

export function IndividualList({ individuals, roles, annotations, title, maxRows = 12 }: IndividualListProps) {
  const shown   = individuals.slice(0, maxRows);
  const hidden  = individuals.length - shown.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {title && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
          color: 'var(--text-muted)', letterSpacing: '0.08em',
          textTransform: 'uppercase', marginBottom: 4,
        }}>{title}</div>
      )}

      {shown.map((ind, idx) => {
        const role   = roles?.get(ind.id) ?? 'normal';
        const style  = ROLE_STYLES[role];
        const isDim  = role === 'dim';
        const color  = sampleGradientRgb(ind.fitness);

        return (
          <div key={ind.id} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '3px 6px', borderRadius: 3,
            background: style.bg,
            opacity: isDim ? 0.3 : 1,
            transition: 'all 0.25s ease',
            border: role !== 'normal' && role !== 'dim'
              ? `1px solid ${style.textColor}30`
              : '1px solid transparent',
          }}>
            {/* Rank */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
              color: 'var(--text-muted)', minWidth: 22,
            }}>#{idx + 1}</span>

            {/* Fitness swatch */}
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: color, flexShrink: 0,
              boxShadow: role !== 'normal' ? `0 0 4px ${color}` : 'none',
            }}/>

            {/* Fitness value */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.68rem',
              color: style.textColor ?? 'var(--text-secondary)',
              flex: 1,
            }}>
              {ind.fitness.toFixed(4)}
            </span>

            {/* Position */}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '0.6rem',
              color: 'var(--text-muted)',
            }}>
              ({ind.position.x.toFixed(2)},{ind.position.y.toFixed(2)})
            </span>

            {/* Annotation (e.g. roulette probability) */}
            {annotations?.get(ind.id) && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                color: 'var(--text-secondary)', flexShrink: 0,
              }}>{annotations.get(ind.id)}</span>
            )}

            {/* Role badge */}
            {style.label && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.58rem',
                color: style.textColor, background: `${style.textColor}20`,
                padding: '1px 5px', borderRadius: 2, letterSpacing: '0.05em',
                flexShrink: 0,
              }}>{style.label}</span>
            )}
          </div>
        );
      })}

      {hidden > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
          color: 'var(--text-muted)', padding: '2px 6px', textAlign: 'center',
        }}>
          + {hidden} more
        </div>
      )}
    </div>
  );
}