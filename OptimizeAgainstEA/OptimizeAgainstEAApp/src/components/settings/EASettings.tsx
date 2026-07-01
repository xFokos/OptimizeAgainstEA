import type { CSSProperties } from 'react';
import { useSettings, resetEASettings } from '../../context/SettingsContext';

export function EASettingsPanel() {
    const { eaSettings: s, setEaSettings } = useSettings();

    return (
        <section style={styles.section}>
            <h3 style={styles.sectionTitle}>Allgemeine EA Einstellungen</h3>
            <p style={styles.hint}>Diese Einstellungen gelten für alle Spiele</p>

            <div style={styles.row}>
                <label style={styles.label}>Mutations-Rate</label>
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
                <label style={styles.label}>Mutations-Stärke</label>
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
                <label style={styles.label}>Presim Generationen</label>
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
                <label style={styles.label}>Populations-Größe</label>
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
                <label style={styles.label}>Crossover Typ</label>
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
                <label style={styles.label}>Injection Deviation</label>
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
                <label style={styles.label}>Hall of Fame</label>
                <div style={styles.toggleGroup}>
                    {([true, false] as const).map(val => (
                        <button
                            key={String(val)}
                            onClick={() => setEaSettings({ ...s, useHallOfFame: val })}
                            style={s.useHallOfFame === val ? styles.toggleActive : styles.toggleInactive}
                        >
                            {val ? 'An' : 'Aus'}
                        </button>
                    ))}
                </div>
            </div>

            <button style={styles.resetBtn} onClick={() => setEaSettings(resetEASettings())}>
                Zurücksetzen
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
    hint: {
        fontSize: '12px',
        color:    'var(--text-muted)',
        margin:   '0 0 16px 0',
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
