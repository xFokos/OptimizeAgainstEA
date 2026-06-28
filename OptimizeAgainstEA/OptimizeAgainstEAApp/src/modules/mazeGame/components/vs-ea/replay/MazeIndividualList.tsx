import type { IndividualSnapshot } from '../../../engine/ea/eaReplayLog';
import type { Path } from '../../../types/maze';
import { MOVE_ARROWS } from '../../../types/maze';
import { sampleGradientRgb } from '../../../../BattleShips/engine/colorScale';

export type IndividualRole =
  | 'normal' | 'elite' | 'parentA' | 'parentB' | 'child' | 'solution' | 'dim'
  | 'winner' | 'candidate' | 'eligible';

/** Per-row genome highlighting: a spliced suffix and/or mutated gene indices. */
export interface GenomeHighlight {
  /** Genes at index >= this came from Parent B (single-point splice). */
  spliceFrom?: number;
  /** Genes re-picked by mutation. */
  mutated?: number[];
}

interface MazeIndividualListProps {
  individuals: IndividualSnapshot[];
  roles?: Map<string, IndividualRole>;
  title?: string;
  annotations?: Map<string, string>;
  highlights?: Map<string, GenomeHighlight>;
  maxRows?: number;
  /** Max genes rendered per genome before truncating with an ellipsis. */
  maxGenes?: number;
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

const SPLICE_COLOR = '#4a90f0';
const MUTATED_COLOR = '#f0a04a';

function GenomeArrows({ path, highlight, maxGenes }: { path: Path; highlight?: GenomeHighlight; maxGenes: number }) {
  const mutated = new Set(highlight?.mutated ?? []);
  const shown = path.slice(0, maxGenes);
  return (
    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.3, wordBreak: 'break-all' }}>
      {shown.map((move, i) => {
        const isMut = mutated.has(i);
        const isSplice = highlight?.spliceFrom !== undefined && i >= highlight.spliceFrom;
        const color = isMut ? MUTATED_COLOR : isSplice ? SPLICE_COLOR : 'inherit';
        return (
          <span
            key={i}
            style={{
              color,
              fontWeight: isMut ? 700 : 400,
              background: isMut ? 'rgba(240,160,74,0.18)' : 'transparent',
            }}
          >{MOVE_ARROWS[move]}</span>
        );
      })}
      {path.length > maxGenes && <span style={{ opacity: 0.5 }}>…</span>}
    </span>
  );
}

/**
 * Re-skin of BattleShips' IndividualList: instead of an (x,y) position, each row
 * renders the genome as a string of move arrows (↑→↓←). Spliced suffixes and
 * mutated genes are colour-highlighted so crossover / mutation are legible.
 */
export function MazeIndividualList({
  individuals, roles, annotations, highlights, title, maxRows = 10, maxGenes = 48,
}: MazeIndividualListProps) {
  const shown = individuals.slice(0, maxRows);
  const hidden = individuals.length - shown.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {title && (
        <div className="eyebrow" style={{ marginBottom: 4 }}>{title}</div>
      )}

      {shown.map((ind, idx) => {
        const role = roles?.get(ind.id) ?? 'normal';
        const style = ROLE_STYLES[role];
        const isDim = role === 'dim';
        const color = sampleGradientRgb(ind.fitness);

        return (
          <div key={ind.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            padding: '3px 6px', borderRadius: 3,
            background: style.bg,
            opacity: isDim ? 0.3 : 1,
            border: role !== 'normal' && role !== 'dim'
              ? `1px solid ${style.textColor}30`
              : '1px solid transparent',
          }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'rgba(232,234,240,0.5)', minWidth: 22 }}>
              #{idx + 1}
            </span>

            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0,
              boxShadow: role !== 'normal' ? `0 0 4px ${color}` : 'none',
            }} />

            <span style={{
              fontFamily: 'monospace', fontSize: '0.68rem',
              color: style.textColor ?? 'rgba(232,234,240,0.75)', minWidth: 48,
            }}>
              {ind.fitness.toFixed(3)}
            </span>

            <GenomeArrows path={ind.path} highlight={highlights?.get(ind.id)} maxGenes={maxGenes} />

            {annotations?.get(ind.id) && (
              <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'rgba(232,234,240,0.75)', marginLeft: 'auto' }}>
                {annotations.get(ind.id)}
              </span>
            )}

            {style.label && (
              <span style={{
                fontFamily: 'monospace', fontSize: '0.58rem', color: style.textColor,
                background: `${style.textColor}20`, padding: '1px 5px', borderRadius: 2,
                letterSpacing: '0.05em', flexShrink: 0, marginLeft: annotations?.get(ind.id) ? 0 : 'auto',
              }}>{style.label}</span>
            )}
          </div>
        );
      })}

      {hidden > 0 && (
        <div style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: 'rgba(232,234,240,0.5)', padding: '2px 6px', textAlign: 'center' }}>
          + {hidden} more
        </div>
      )}
    </div>
  );
}
