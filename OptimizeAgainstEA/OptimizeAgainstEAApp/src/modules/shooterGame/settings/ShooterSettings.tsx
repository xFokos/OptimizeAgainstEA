import type { CSSProperties } from 'react';
import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { DNA_NAMES } from '../shooter.types';

// ── Shared slider row ────────────────────────────────────────────────────────

interface SliderRowProps {
    label: string;
    min: number; max: number; step: number;
    value: number;
    display: string;
    onChange: (v: number) => void;
}

function SliderRow({ label, min, max, step, value, display, onChange }: SliderRowProps) {
    return (
        <div style={styles.row}>
            <label style={styles.label}>{label}</label>
            <input
                type="range" min={min} max={max} step={step} value={value}
                onChange={e => onChange(parseFloat(e.target.value))}
                className="slider" style={styles.slider}
            />
            <span style={styles.value}>{display}</span>
        </div>
    );
}

// ── Section: Starter DNA ─────────────────────────────────────────────────────

export function ShooterDnaSection() {
    const { shooterSettings: s, setShooterSettings } = useSettings();
    const updateDna = (index: number, value: number) => {
        const newDna = [...s.starterDna];
        newDna[index] = value;
        setShooterSettings({ ...s, starterDna: newDna });
    };
    return (
        <div style={dnaStyles.grid}>
            {DNA_NAMES.map((name, i) => (
                <div key={i} style={dnaStyles.item}>
                    <div style={dnaStyles.itemHeader}>
                        <span style={dnaStyles.itemLabel}>{name}</span>
                        <span style={dnaStyles.itemValue}>{s.starterDna[i].toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min={0} max={1} step={0.01}
                        value={s.starterDna[i]}
                        onChange={e => updateDna(i, parseFloat(e.target.value))}
                        className="slider"
                        style={{ width: '100%', cursor: 'pointer' }}
                    />
                </div>
            ))}
        </div>
    );
}

const dnaStyles: Record<string, React.CSSProperties> = {
    grid: {
        display:               'grid',
        gridTemplateColumns:   'repeat(2, 1fr)',
        gap:                   '10px 16px',
    },
    item: {
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
    },
    itemHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
    },
    itemLabel: {
        fontSize:   11,
        color:      'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap' as const,
        overflow:   'hidden',
        textOverflow: 'ellipsis',
    },
    itemValue: {
        fontSize:   11,
        color:      'var(--accent)',
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
    },
};

// ── Section: Spieler ─────────────────────────────────────────────────────────

export function ShooterPlayerSection() {
    const { shooterSettings: s, setShooterSettings } = useSettings();
    return (
        <div>
            <SliderRow
                label="Bullet Speed"
                min={100} max={1000} step={10}
                value={s.playerStats.bulletSpeed}
                display={String(s.playerStats.bulletSpeed)}
                onChange={v => setShooterSettings({ ...s, playerStats: { ...s.playerStats, bulletSpeed: Math.round(v) } })}
            />
            <SliderRow
                label="Move Speed"
                min={50} max={600} step={10}
                value={s.playerStats.moveSpeed}
                display={String(s.playerStats.moveSpeed)}
                onChange={v => setShooterSettings({ ...s, playerStats: { ...s.playerStats, moveSpeed: Math.round(v) } })}
            />
            <SliderRow
                label="Shoot Cooldown"
                min={0.05} max={2} step={0.05}
                value={s.playerStats.shootCooldown}
                display={s.playerStats.shootCooldown.toFixed(2) + 's'}
                onChange={v => setShooterSettings({ ...s, playerStats: { ...s.playerStats, shootCooldown: v } })}
            />
        </div>
    );
}

// ── Section: Spielrunde ──────────────────────────────────────────────────────

export function ShooterRoundSection({ onBeforeChange }: { onBeforeChange?: () => void } = {}) {
    const { shooterSettings: s, setShooterSettings } = useSettings();
    return (
        <div>
            <SliderRow
                label="Timelimit"
                min={10} max={120} step={5}
                value={s.roundDuration}
                display={s.roundDuration + 's'}
                onChange={v => { onBeforeChange?.(); setShooterSettings({ ...s, roundDuration: Math.round(v) }); }}
            />
            <SliderRow
                label="Hit to Win"
                min={3} max={30} step={1}
                value={s.tugWinThreshold}
                display={String(s.tugWinThreshold)}
                onChange={v => { onBeforeChange?.(); setShooterSettings({ ...s, tugWinThreshold: Math.round(v) }); }}
            />
        </div>
    );
}

// ── Section: Horde ───────────────────────────────────────────────────────────

export function HordeWaveSection() {
    const { hordeSettings: s, setHordeSettings } = useSettings();
    return (
        <div>
            <SliderRow
                label="Wave Size"
                min={5} max={40} step={1}
                value={s.waveSize}
                display={String(s.waveSize)}
                onChange={v => setHordeSettings({ ...s, waveSize: Math.round(v) })}
            />
        </div>
    );
}

// ── Legacy full panel (still used outside the lobby) ────────────────────────

export function ShooterSettingsPanel() {
    const { setShooterSettings } = useSettings();
    return (
        <div>
            <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Starter DNA</h3>
                <ShooterDnaSection />
            </section>
            <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Game Round</h3>
                <ShooterRoundSection />
            </section>
            <section style={styles.section}>
                <h3 style={styles.sectionTitle}>Player</h3>
                <ShooterPlayerSection />
            </section>
            <button style={styles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>
                Reset
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
        width:     '48px',
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
