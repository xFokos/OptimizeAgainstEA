import type { IndividualSnapshot } from '../../../engine/ea/eaReplayLog';
import type { Path } from '../../../types/maze';
import { MOVE_ARROWS } from '../../../types/maze';
import { sampleGradientRgb } from '../../../../BattleShips/engine/colorScale';

export type IndividualRole =
  | 'normal' | 'elite' | 'parentA' | 'parentB' | 'child' | 'solution' | 'dim'
  | 'winner' | 'candidate' | 'eligible';

/** Per-row genome highlighting: parent-origin colouring and/or mutated gene indices. */
export interface GenomeHighlight {
  /** Single-point splice: genes before this index are Parent A's (colour A), the rest Parent B's (colour B). */
  spliceFrom?: number;
  /** Uniform crossover: per-gene origin, true → Parent A (colour A), false → Parent B (colour B). */
  mask?: boolean[];
  /** Flat colour for the whole genome (e.g. a parent row tinted in its own colour). */
  tint?: string;
  /** Crossover split points: a red dot is drawn before each of these gene indices. */
  splits?: number[];
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
  /** Row picked by the user — rendered emphasised. */
  selectedId?: string | null;
  /** When set, rows become clickable; clicking the selected row again passes null. */
  onSelect?: (id: string | null) => void;
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

export const PARENT_A_COLOR = '#4af0a0';
export const PARENT_B_COLOR = '#4a90f0';
export const MUTATED_COLOR = '#f0a04a';
const SPLIT_COLOR = '#f04a4a';

/** Crossover split marker — matches the red dots on the map's child path. */
function SplitDot() {
  return (
    <span style={{
      display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
      background: SPLIT_COLOR, margin: '0 2px', verticalAlign: 'middle',
    }} />
  );
}

function geneColor(i: number, highlight?: GenomeHighlight): string {
  if (highlight?.mutated?.includes(i)) return MUTATED_COLOR;
  if (highlight?.mask) return highlight.mask[i] ? PARENT_A_COLOR : PARENT_B_COLOR;
  if (highlight?.spliceFrom !== undefined) return i < highlight.spliceFrom ? PARENT_A_COLOR : PARENT_B_COLOR;
  if (highlight?.tint) return highlight.tint;
  return 'inherit';
}

function GenomeArrows({ path, highlight, maxGenes }: { path: Path; highlight?: GenomeHighlight; maxGenes: number }) {
  const mutated = new Set(highlight?.mutated ?? []);
  const splits = new Set(highlight?.splits ?? []);
  const shown = path.slice(0, maxGenes);
  return (
    <span className="maze-genome" style={{ fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1.3 }}>
      {shown.map((move, i) => {
        const isMut = mutated.has(i);
        const color = geneColor(i, highlight);
        return (
          <span key={i}>
            {splits.has(i) && <SplitDot />}
            <span
              style={{
                color,
                fontWeight: isMut ? 700 : 400,
                background: isMut ? 'rgba(240,160,74,0.18)' : 'transparent',
              }}
            >{MOVE_ARROWS[move]}</span>
          </span>
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
  selectedId, onSelect,
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
        const isSelected = ind.id === selectedId;
        const isDim = role === 'dim' && !isSelected;
        const color = sampleGradientRgb(ind.fitness);

        return (
          <div
            key={ind.id}
            className={onSelect ? 'maze-replay-row maze-replay-row--clickable' : 'maze-replay-row'}
            onClick={onSelect ? () => onSelect(isSelected ? null : ind.id) : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
              padding: '3px 6px', borderRadius: 3,
              background: isSelected ? 'rgba(255,255,255,0.10)' : style.bg,
              opacity: isDim ? 0.3 : 1,
              border: isSelected
                ? '1px solid rgba(255,255,255,0.8)'
                : role !== 'normal' && role !== 'dim'
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
