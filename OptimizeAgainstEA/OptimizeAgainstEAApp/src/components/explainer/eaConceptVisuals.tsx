import './eaConceptVisuals.css';

// ─────────────────────────────────────────────────────────────────────────
//  Shared, game-agnostic illustrations of the three core EA mechanisms —
//  selection, crossover, mutation. Used as `visual` in ExplainerFlow steps,
//  both for the Dashboard's general "EA Explained" tab and (parameterized
//  with a game's own trait names/colors) inside in-game tutorials.
// ─────────────────────────────────────────────────────────────────────────

// ── Selection: population sorted by fitness, best performers highlighted ──

export interface PopulationMember {
    /** 0–1, higher = did better. */
    fitness:  number;
    /** Set to highlight this member (e.g. as a chosen parent); omit to dim it. */
    color?:   string;
}

export function PopulationVisual({ population }: { population: PopulationMember[] }) {
    return (
        <div className="eaviz">
            <div className="eaviz__population">
                {population.map((member, i) => (
                    <div
                        key={i}
                        className="eaviz__populationBar"
                        style={{
                            height:     `${member.fitness * 100}%`,
                            background: member.color ?? 'rgba(255,255,255,0.15)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

// ── Crossover: two parents' genes mixed into a child, gene by gene ────────

export interface CrossoverGene {
    label:   string;
    parentA: number;
    parentB: number;
    /** true = child inherits this gene from parent A, false = parent B. */
    fromA:   boolean;
}

interface CrossoverVisualProps {
    genes:      CrossoverGene[];
    colorA?:    string;
    colorB?:    string;
    labelA?:    string;
    labelB?:    string;
    labelChild?: string;
}

function GeneBar({ value, color }: { value: number; color: string }) {
    return (
        <div className="eaviz__bar">
            <div className="eaviz__barTrack">
                <div className="eaviz__barFill" style={{ width: `${value * 100}%`, background: color }} />
            </div>
            <span className="eaviz__barVal" style={{ color }}>{value.toFixed(2)}</span>
        </div>
    );
}

export function CrossoverVisual({
    genes,
    colorA = '#60a5fa',
    colorB = '#f97316',
    labelA = 'Parent A',
    labelB = 'Parent B',
    labelChild = 'Child',
}: CrossoverVisualProps) {
    return (
        <div className="eaviz">
            <div className="eaviz__geneRow">
                <span />
                <span className="eaviz__colLabel" style={{ color: colorA }}>{labelA}</span>
                <span className="eaviz__colLabel" style={{ color: colorB }}>{labelB}</span>
                <span className="eaviz__colLabel">{labelChild}</span>
            </div>
            {genes.map(gene => {
                const childValue = gene.fromA ? gene.parentA : gene.parentB;
                return (
                    <div key={gene.label} className="eaviz__geneRow">
                        <span className="eaviz__geneName">{gene.label}</span>
                        <GeneBar value={gene.parentA} color={colorA} />
                        <GeneBar value={gene.parentB} color={colorB} />
                        <GeneBar value={childValue} color={gene.fromA ? colorA : colorB} />
                    </div>
                );
            })}
        </div>
    );
}

// ── Mutation: before → after for whichever genes got a random tweak ───────

export interface MutationChange {
    label:  string;
    before: number;
    after:  number;
}

export function MutationVisual({ changes, unchangedNote = 'No changes this time — mutation is random.' }: {
    changes: MutationChange[];
    unchangedNote?: string;
}) {
    return (
        <div className="eaviz">
            {changes.length > 0 ? changes.map(g => (
                <div key={g.label} className="eaviz__mutationRow">
                    <span className="eaviz__geneName">{g.label}</span>
                    <span className="eaviz__mutationBefore">{g.before.toFixed(2)}</span>
                    <span className="eaviz__mutationArrow">→</span>
                    <span className="eaviz__mutationAfter">✨ {g.after.toFixed(2)}</span>
                </div>
            )) : (
                <span className="eaviz__geneName">{unchangedNote}</span>
            )}
        </div>
    );
}

// ── Fitness: a score breakdown — how one individual's round becomes a grade ──

export interface FitnessRow {
    label:   string;
    /** Optional calculation shown between label and value, e.g. "3 × +100". */
    detail?: string;
    value:   number;
}

function signed(v: number): string {
    return v > 0 ? `+${v}` : `${v}`;
}

export function FitnessVisual({ rows, totalLabel = 'Fitness' }: { rows: FitnessRow[]; totalLabel?: string }) {
    const total = rows.reduce((sum, r) => sum + r.value, 0);
    return (
        <div className="eaviz">
            {rows.map(row => (
                <div key={row.label} className="eaviz__fitnessRow">
                    <span className="eaviz__geneName">{row.label}</span>
                    <span className="eaviz__fitnessDetail">{row.detail ?? ''}</span>
                    <span className={`eaviz__fitnessValue ${row.value >= 0 ? 'eaviz__fitnessValue--pos' : 'eaviz__fitnessValue--neg'}`}>
                        {signed(row.value)}
                    </span>
                </div>
            ))}
            <div className="eaviz__fitnessRow eaviz__fitnessRow--total">
                <span className="eaviz__fitnessTotalLabel">{totalLabel}</span>
                <span />
                <span className="eaviz__fitnessTotalValue">{total}</span>
            </div>
        </div>
    );
}

// ── Generations: the same population, early vs. many generations later ───

export function GenerationsVisual({ early, later, earlyLabel = 'Generation 1', laterLabel = 'Generation 50' }: {
    early:       PopulationMember[];
    later:       PopulationMember[];
    earlyLabel?: string;
    laterLabel?: string;
}) {
    return (
        <div className="eaviz eaviz--generations">
            <span className="eaviz__generationsLabel">{earlyLabel}</span>
            <div className="eaviz__population eaviz__population--compact">
                {early.map((m, i) => <div key={i} className="eaviz__populationBar" style={{ height: `${m.fitness * 100}%`, background: m.color ?? 'rgba(255,255,255,0.15)' }} />)}
            </div>
            <span className="eaviz__generationsLabel">{laterLabel}</span>
            <div className="eaviz__population eaviz__population--compact">
                {later.map((m, i) => <div key={i} className="eaviz__populationBar" style={{ height: `${m.fitness * 100}%`, background: m.color ?? 'rgba(255,255,255,0.15)' }} />)}
            </div>
        </div>
    );
}
