import type { CSSProperties } from 'react';
import { useSettings, resetEASettings, defaultHordeSettings } from '../../context/SettingsContext';
import { CompiTooltip } from '../ui/CompiTooltip';

export function EASettingsPanel() {
    const { eaSettings: s, setEaSettings } = useSettings();

    return (
        <section style={styles.section}>
            <h3 style={styles.sectionTitle}>EA Settings</h3>

            <div style={styles.row}>
                <CompiTooltip text="Chance each gene has to randomly mutate when a new generation is created.">
                    <label style={styles.label}>Mutation Rate</label>
                </CompiTooltip>
                <input
                    type="range" min={0} max={0.5} step={0.01}
                    value={s.mutationRate}
                    onChange={e => setEaSettings({ ...s, mutationRate: parseFloat(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.mutationRate.toFixed(2)}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="How large a mutation's random change to a gene can be.">
                    <label style={styles.label}>Mutation Strength</label>
                </CompiTooltip>
                <input
                    type="range" min={0} max={0.5} step={0.01}
                    value={s.mutationStrength}
                    onChange={e => setEaSettings({ ...s, mutationStrength: parseFloat(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.mutationStrength.toFixed(2)}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="How many generations the EA simulates against itself before your first round — higher starts tougher.">
                    <label style={styles.label}>Presim Generations</label>
                </CompiTooltip>
                <input
                    type="range" min={0} max={10} step={1}
                    value={s.presimGenerations}
                    onChange={e => setEaSettings({ ...s, presimGenerations: parseInt(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.presimGenerations}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="How many individuals compete and evolve each generation.">
                    <label style={styles.label}>Population Size</label>
                </CompiTooltip>
                <input
                    type="range" min={5} max={50} step={5}
                    value={s.populationSize}
                    onChange={e => setEaSettings({ ...s, populationSize: parseInt(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.populationSize}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="How two parents' DNA combine into a child: Uniform mixes genes randomly, Single-Point splits the DNA at one point.">
                    <label style={styles.label}>Crossover Type</label>
                </CompiTooltip>
                <div style={styles.toggleGroup}>
                    {(['uniform', 'single-point'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setEaSettings({ ...s, crossoverType: type })}
                            style={s.crossoverType === type ? styles.toggleActive : styles.toggleInactive}
                        >
                            {type === 'uniform' ? 'Uniform' : 'Single-Point'}
                        </button>
                    ))}
                </div>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="Random spread applied when refreshing the population, to keep genetic diversity.">
                    <label style={styles.label}>Injection Deviation</label>
                </CompiTooltip>
                <input
                    type="range" min={0.05} max={1} step={0.05}
                    value={s.injectionDeviation}
                    onChange={e => setEaSettings({ ...s, injectionDeviation: parseFloat(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.injectionDeviation.toFixed(2)}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="Keeps the best individual ever found so evolution can't lose a good solution.">
                    <label style={styles.label}>Hall of Fame</label>
                </CompiTooltip>
                <div style={styles.toggleGroup}>
                    {([true, false] as const).map(val => (
                        <button
                            key={String(val)}
                            onClick={() => setEaSettings({ ...s, useHallOfFame: val })}
                            style={s.useHallOfFame === val ? styles.toggleActive : styles.toggleInactive}
                        >
                            {val ? 'On' : 'Off'}
                        </button>
                    ))}
                </div>
            </div>

            <button style={styles.resetBtn} onClick={() => setEaSettings(resetEASettings())}>
                Reset
            </button>
        </section>
    );
}

// Horde runs its own EA tuning (see HordeSettings) so difficulty presets there
// never bleed into — or get overwritten by — Solo Play's EASettings.
export function HordeEASettingsPanel() {
    const { hordeSettings: s, setHordeSettings } = useSettings();

    const resetAlgorithm = () => setHordeSettings({
        ...s,
        mutationRate:     defaultHordeSettings.mutationRate,
        mutationStrength: defaultHordeSettings.mutationStrength,
        crossoverType:    defaultHordeSettings.crossoverType,
    });

    return (
        <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Horde EA Settings</h3>

            <div style={styles.row}>
                <CompiTooltip text="Chance each gene has to randomly mutate when a new generation is created.">
                    <label style={styles.label}>Mutation Rate</label>
                </CompiTooltip>
                <input
                    type="range" min={0} max={0.5} step={0.01}
                    value={s.mutationRate}
                    onChange={e => setHordeSettings({ ...s, mutationRate: parseFloat(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.mutationRate.toFixed(2)}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="How large a mutation's random change to a gene can be.">
                    <label style={styles.label}>Mutation Strength</label>
                </CompiTooltip>
                <input
                    type="range" min={0} max={0.5} step={0.01}
                    value={s.mutationStrength}
                    onChange={e => setHordeSettings({ ...s, mutationStrength: parseFloat(e.target.value) })}
                    className="slider"
                    style={styles.slider}
                />
                <span style={styles.value}>{s.mutationStrength.toFixed(2)}</span>
            </div>

            <div style={styles.row}>
                <CompiTooltip text="How two parents' DNA combine into a child: Uniform mixes genes randomly, Single-Point splits the DNA at one point.">
                    <label style={styles.label}>Crossover Type</label>
                </CompiTooltip>
                <div style={styles.toggleGroup}>
                    {(['uniform', 'single-point'] as const).map(type => (
                        <button
                            key={type}
                            onClick={() => setHordeSettings({ ...s, crossoverType: type })}
                            style={s.crossoverType === type ? styles.toggleActive : styles.toggleInactive}
                        >
                            {type === 'uniform' ? 'Uniform' : 'Single-Point'}
                        </button>
                    ))}
                </div>
            </div>

            <button style={styles.resetBtn} onClick={resetAlgorithm}>
                Reset
            </button>
        </section>
    );
}

const styles: Record<string, CSSProperties> = {
    section: {
        padding:      '16px',
        background:   'var(--surface)',
        borderRadius: 'var(--r-md)',
        border:       '1px solid var(--border)',
    },
    sectionTitle: {
        fontSize:      '12px',
        color:         'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin:        '0 0 8px 0',
    },
    row: {
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        marginBottom: '10px',
    },
    label: {
        width:      '160px',
        fontSize:   '13px',
        flexShrink: 0,
        color:      'var(--text-dim)',
    },
    slider: {
        flex:   1,
        cursor: 'pointer',
    },
    value: {
        width:     '36px',
        fontSize:  '13px',
        textAlign: 'right',
        color:     'var(--accent)',
    },
    toggleGroup: {
        display: 'flex',
        gap:     '6px',
        flex:    1,
    },
    toggleActive: {
        padding:      '4px 12px',
        background:   'var(--accent-dim)',
        border:       '1px solid var(--accent)',
        borderRadius: 'var(--r-sm)',
        color:        'var(--accent)',
        cursor:       'pointer',
        fontSize:     '12px',
        fontFamily:   'var(--font)',
    },
    toggleInactive: {
        padding:      '4px 12px',
        background:   'transparent',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        color:        'var(--text-muted)',
        cursor:       'pointer',
        fontSize:     '12px',
        fontFamily:   'var(--font)',
    },
    resetBtn: {
        marginTop:    '8px',
        padding:      '8px 20px',
        background:   'transparent',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        color:        'var(--text-muted)',
        cursor:       'pointer',
        fontFamily:   'var(--font)',
        fontSize:     '12px',
    },
};
