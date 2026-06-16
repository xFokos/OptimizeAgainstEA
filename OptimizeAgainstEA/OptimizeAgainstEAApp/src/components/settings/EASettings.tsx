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
                    style={styles.slider}
                />
                <span style={styles.value}>{s.populationSize}</span>
            </div>

            <button style={styles.resetBtn} onClick={() => setEaSettings(resetEASettings())}>
                Zurücksetzen
            </button>
        </section>
    );
}

const styles: Record<string, React.CSSProperties> = {
    section: {
        padding:      '16px',
        background:   'rgba(255,255,255,0.04)',
        borderRadius: '8px',
        border:       '1px solid rgba(255,255,255,0.08)',
        marginBottom: '24px',
    },
    sectionTitle: {
        fontSize:      '12px',
        color:         'rgba(255,255,255,0.4)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin:        '0 0 8px 0',
    },
    hint: {
        fontSize:     '12px',
        color:        'rgba(255,255,255,0.25)',
        margin:       '0 0 16px 0',
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
        color:      'rgba(255,255,255,0.7)',
    },
    slider: {
        flex:   1,
        cursor: 'pointer',
    },
    value: {
        width:     '36px',
        fontSize:  '13px',
        textAlign: 'right',
        color:     '#4fc3f7',
    },
    resetBtn: {
        marginTop:    '8px',
        padding:      '8px 20px',
        background:   'transparent',
        border:       '1px solid rgba(255,255,255,0.15)',
        borderRadius: '6px',
        color:        'rgba(255,255,255,0.5)',
        cursor:       'pointer',
        fontFamily:   'monospace',
        fontSize:     '12px',
    },
};