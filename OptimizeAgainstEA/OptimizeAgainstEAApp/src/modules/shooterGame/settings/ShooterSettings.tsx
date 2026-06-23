import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { DNA_NAMES } from '../shooter.types';

export function ShooterSettingsPanel() {
    const { shooterSettings: s, setShooterSettings } = useSettings();

    const updateDna = (index: number, value: number) => {
        const newDna = [...s.starterDna];
        newDna[index] = value;
        setShooterSettings({ ...s, starterDna: newDna });
    };

    return (
        <div>
            {/* Starter DNA */}
            <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Starter DNA</h3>
                <p style={styles.hint}>Niedrige Werte = schwacher Start · Hohe Werte = starker Start</p>
                {DNA_NAMES.map((name, i) => (
                    <div key={i} style={styles.row}>
                        <label style={styles.label}>{name}</label>
                        <input
                            type="range" min={0} max={1} step={0.01}
                            value={s.starterDna[i]}
                            onChange={e => updateDna(i, parseFloat(e.target.value))}
                            style={styles.slider}
                        />
                        <span style={styles.value}>{s.starterDna[i].toFixed(2)}</span>
                    </div>
                ))}
            </section>

            {/* Runde */}
            <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Spielrunde</h3>
                <div style={styles.row}>
                    <label style={styles.label}>Rundendauer</label>
                    <input
                        type="range" min={10} max={120} step={5}
                        value={s.roundDuration}
                        onChange={e => setShooterSettings({ ...s, roundDuration: parseInt(e.target.value) })}
                        style={styles.slider}
                    />
                    <span style={styles.value}>{s.roundDuration}s</span>
                </div>
            </section>

            <button style={styles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>
                Zurücksetzen
            </button>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    section: {
        padding:      '16px',
        background:   'rgba(255,255,255,0.04)',
        borderRadius: '8px',
        border:       '1px solid rgba(255,255,255,0.08)',
        marginBottom: '12px',
    },
    sectionTitle: {
        fontSize:      '12px',
        color:         'rgba(255,255,255,0.4)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        margin:        '0 0 8px 0',
    },
    hint: {
        fontSize: '12px',
        color:    'rgba(255,255,255,0.25)',
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