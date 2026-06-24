import type { CSSProperties } from 'react';
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

const styles: Record<string, CSSProperties> = {
    section: {
        padding:      '16px',
        background:   'var(--surface)',
        borderRadius: 'var(--r-md)',
        border:       '1px solid var(--border)',
        marginBottom: '12px',
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
    resetBtn: {
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