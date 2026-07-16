import { DNA_INDEX, type DNA } from '../shooter.types';
import { LOOP_STEPS, LOOP_STEP_DURATION, LOOP_GENE_START, loopOffsetRad, SIZE_GENE_INDEX, OPACITY_GENE_INDEX } from '../horde/hordeDna';
import { HC } from '../horde/hordeRender';

// ---- DNA Panel ----

export const PANEL_W = 200;

const GENE_DEFS: { index: number; label: string; tips: [number, string][] }[] = [
    {
        index: DNA_INDEX.AGGRESSION, label: 'Aggression',
        tips:  [[0, 'Drifts aimlessly'], [0.25, 'Mostly wandering'], [0.5, 'Mixed pursuit'], [0.75, 'Actively hunting'], [0.9, 'Laser-focused']],
    },
    {
        index: DNA_INDEX.MOVEMENT_SPEED, label: 'Speed',
        tips:  [[0, 'Nearly stationary'], [0.25, 'Slow shuffle'], [0.5, 'Moderate speed'], [0.75, 'Fast approach'], [0.9, 'Full sprint']],
    },
    {
        index: DNA_INDEX.DODGE_WEIGHT, label: 'Dodge',
        tips:  [[0, 'No evasion'], [0.3, 'Slight swerve'], [0.6, 'Actively evading'], [0.85, 'Bullet-dancer']],
    },
    {
        index: SIZE_GENE_INDEX, label: 'Size',
        tips:  [[0, 'Tiny — hard to hit'], [0.3, 'Small'], [0.6, 'Average build'], [0.85, 'Large target']],
    },
    {
        index: OPACITY_GENE_INDEX, label: 'Opacity',
        tips:  [[0, 'Nearly invisible'], [0.3, 'Faint'], [0.6, 'Visible'], [0.85, 'Fully solid']],
    },
];

function geneTip(value: number, tips: [number, string][]): string {
    let out = tips[0][1];
    for (const [t, l] of tips) { if (value >= t) out = l; }
    return out;
}

export function HordeDnaPanel({ bestDna, height }: { bestDna: DNA | null; height: number }) {
    return (
        <div style={{
            width:         PANEL_W,
            height,
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
            fontFamily:    '"JetBrains Mono", monospace',
            color:         '#fff',
            flexShrink:    0,
            overflowY:     'auto',
            padding:       '14px 12px',
            boxSizing:     'border-box',
            // Framed surface so the panel reads as its own card next to the
            // arena instead of floating loose on the page background.
            background:    'var(--surface)',
            border:        '1px solid var(--border-strong)',
            borderRadius:  'var(--r-md)',
        }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(251,146,60,0.7)' }}>
                Best DNA
            </div>
            {!bestDna && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8 }}>
                    No data yet.<br />Kill an agent to<br />see evolution.
                </div>
            )}
            {bestDna && GENE_DEFS.map(def => {
                const value = bestDna[def.index] ?? 0;
                return (
                    <div key={def.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{def.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{value.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${value * 100}%`, height: '100%', background: HC, borderRadius: 4, transition: 'width 0.3s ease' }} />
                        </div>
                        <div style={{ fontSize: 11, color: HC, opacity: 0.75, lineHeight: 1.4 }}>
                            {geneTip(value, def.tips)}
                        </div>
                    </div>
                );
            })}
            {bestDna && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Movement Loop</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {Array.from({ length: LOOP_STEPS }, (_, i) => {
                            const gene = bestDna[LOOP_GENE_START + i] ?? 0.5;
                            const deg  = Math.round((loopOffsetRad(gene) * 180) / Math.PI);
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        border: `1px solid ${HC}`, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        transform: `rotate(${deg}deg)`,
                                    }}>
                                        <span style={{ color: HC, fontSize: 14, lineHeight: 1 }}>↑</span>
                                    </div>
                                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                                        {deg > 0 ? `+${deg}°` : `${deg}°`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: 11, color: HC, opacity: 0.75, lineHeight: 1.4 }}>
                        Repeats every {(LOOP_STEPS * LOOP_STEP_DURATION).toFixed(1)}s — arrows show the turn offset applied each step, relative to the current steering direction.
                    </div>
                </div>
            )}
        </div>
    );
}
