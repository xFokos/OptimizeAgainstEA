import { useSyncExternalStore, type CSSProperties } from 'react';
import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { DNA_INDEX, DNA_NAMES, DNA_GENE_INFO } from '../shooter.types';
import { MOD_POOL } from '../mods/modTypes';
import { runModsStore } from '../mods/runModsStore';
import { Switch } from '../../../components/ui/Switch';
import { CompiTooltip } from '../../../components/ui/CompiTooltip';

// ── Shared slider row ────────────────────────────────────────────────────────

interface SliderRowProps {
    label: string;
    min: number; max: number; step: number;
    value: number;
    display: string;
    onChange: (v: number) => void;
    /** Hover explanation shown on the label. */
    tooltip?: string;
    /** Keeps the row's layout but removes the draggable track — used while a difficulty preset (not "Custom") owns the value. */
    hideSlider?: boolean;
}

function SliderRow({ label, min, max, step, value, display, onChange, tooltip, hideSlider }: SliderRowProps) {
    return (
        <div style={styles.row}>
            {tooltip ? (
                <CompiTooltip text={tooltip}>
                    <label style={styles.label}>{label}</label>
                </CompiTooltip>
            ) : (
                <label style={styles.label}>{label}</label>
            )}
            {hideSlider ? <div style={styles.slider} /> : (
                <input
                    type="range" min={min} max={max} step={step} value={value}
                    onChange={e => onChange(parseFloat(e.target.value))}
                    className="slider" style={styles.slider}
                />
            )}
            <span style={styles.value}>{display}</span>
        </div>
    );
}

// ── Shared switch row — same label/value columns as SliderRow ──

interface SwitchRowProps {
    label: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    tooltip?: string;
}

function SwitchRow({ label, checked, onChange, tooltip }: SwitchRowProps) {
    return (
        <div style={styles.row}>
            {tooltip ? (
                <CompiTooltip text={tooltip}>
                    <label style={styles.label}>{label}</label>
                </CompiTooltip>
            ) : (
                <label style={styles.label}>{label}</label>
            )}
            <div style={styles.slider}>
                <Switch checked={checked} onChange={onChange} />
            </div>
            <span style={styles.value}>{checked ? 'On' : 'Off'}</span>
        </div>
    );
}

// ── Section: Starter DNA ─────────────────────────────────────────────────────
// Controlled component (dna + onChange in) — Solo and Horde each keep their own
// starterDna in separate settings slices, so this doesn't reach into context itself.

/** One editable row: which DNA index it reads/writes, plus its label/tooltip.
 *  Not every gene has a DNA_GENE_INFO entry — Horde's Size/Opacity/Movement
 *  Loop genes are real, editable starter-DNA slots too, but they're Horde-only
 *  concepts with no shared-schema name, so callers describe them ad hoc. */
export interface DnaGeneDescriptor {
    index:   number;
    label:   string;
    tooltip: string;
}

const ALL_SHARED_GENES: DnaGeneDescriptor[] = DNA_NAMES.map(name => ({
    index:   DNA_INDEX[name],
    label:   DNA_GENE_INFO[name].label,
    tooltip: DNA_GENE_INFO[name].tooltip,
}));

interface ShooterDnaSectionProps {
    dna:             number[];
    onChange:        (index: number, value: number) => void;
    onBeforeChange?: () => void;
    /** Which rows to show. Defaults to every shared gene (Solo Play). Horde
     *  passes its own descriptor list — a subset of the shared genes it
     *  actually uses, plus its Horde-only genes (see ShooterLobbyPage.tsx). */
    genes?: DnaGeneDescriptor[];
}

export function ShooterDnaSection({ dna, onChange, onBeforeChange, genes = ALL_SHARED_GENES }: ShooterDnaSectionProps) {
    const updateDna = (index: number, value: number) => {
        onBeforeChange?.();
        onChange(index, value);
    };
    return (
        <div style={dnaStyles.grid}>
            {genes.map(({ index: i, label, tooltip }) => (
                <div key={i} style={dnaStyles.item}>
                    <div style={dnaStyles.itemHeader}>
                        <CompiTooltip text={tooltip}>
                            <span style={dnaStyles.itemLabel}>{label}</span>
                        </CompiTooltip>
                        <span style={dnaStyles.itemValue}>{dna[i].toFixed(2)}</span>
                    </div>
                    <input
                        type="range" min={0} max={1} step={0.01}
                        value={dna[i]}
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
        fontSize:   12,
        color:      'var(--text-dim)',
        fontFamily: 'var(--font-mono)',
        whiteSpace: 'nowrap' as const,
        overflow:   'hidden',
        textOverflow: 'ellipsis',
    },
    itemValue: {
        fontSize:   12,
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
                tooltip="How fast your bullets travel."
            />
            <SliderRow
                label="Move Speed"
                min={50} max={600} step={10}
                value={s.playerStats.moveSpeed}
                display={String(s.playerStats.moveSpeed)}
                onChange={v => setShooterSettings({ ...s, playerStats: { ...s.playerStats, moveSpeed: Math.round(v) } })}
                tooltip="How fast you move."
            />
            <SliderRow
                label="Shoot Cooldown"
                min={0.05} max={2} step={0.05}
                value={s.playerStats.shootCooldown}
                display={s.playerStats.shootCooldown.toFixed(2) + 's'}
                onChange={v => setShooterSettings({ ...s, playerStats: { ...s.playerStats, shootCooldown: v } })}
                tooltip="Minimum time between your shots."
            />
            <ModSlotGrid />
        </div>
    );
}

// ── Section: Mod-Loadout (frei togglebare Slots, à la Mario Kart Item-Auswahl) ──

function ModSlotGrid() {
    const activeModIds = useSyncExternalStore(
        cb => runModsStore.subscribe(cb),
        () => runModsStore.activeModIds,
    );

    return (
        <div style={modStyles.wrapper}>
            <h4 style={modStyles.title}>Mods</h4>
            <div style={modStyles.grid}>
                {MOD_POOL.map(mod => {
                    const active = activeModIds.includes(mod.id);
                    return (
                        <CompiTooltip key={mod.id} text={`${mod.name} — ${mod.description}`}>
                            <button
                                type="button"
                                onClick={() => runModsStore.toggleMod(mod.id)}
                                style={{ ...modStyles.slot, ...(active ? modStyles.slotActive : modStyles.slotInactive) }}
                            >
                                <span style={modStyles.slotIcon}>{mod.icon}</span>
                                <span style={modStyles.slotName}>{mod.name}</span>
                            </button>
                        </CompiTooltip>
                    );
                })}
            </div>
        </div>
    );
}

const modStyles: Record<string, CSSProperties> = {
    wrapper: {
        marginTop:  '16px',
        paddingTop: '14px',
        borderTop:  '1px solid var(--border)',
    },
    title: {
        fontSize:      '12px',
        color:         'var(--text-muted)',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        margin:        '0 0 8px 0',
    },
    grid: {
        display:               'grid',
        gridTemplateColumns:   'repeat(auto-fill, 64px)',
        gap:                   '8px',
    },
    slot: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            '2px',
        width:          '64px',
        height:         '64px',
        borderRadius:   'var(--r-md)',
        cursor:         'pointer',
        fontFamily:     'var(--font)',
        transition:     'transform 0.1s ease, border-color 0.15s ease, background 0.15s ease, filter 0.15s ease',
    },
    slotActive: {
        background: 'var(--surface)',
        border:     '2px solid var(--accent)',
        boxShadow:  '0 0 8px color-mix(in srgb, var(--accent) 50%, transparent)',
        filter:     'none',
    },
    slotInactive: {
        background: 'var(--surface)',
        border:     '2px solid var(--border)',
        filter:     'grayscale(0.6) opacity(0.55)',
    },
    slotIcon: {
        fontSize:   '20px',
        lineHeight: 1,
    },
    slotName: {
        fontSize:      '9.5px',
        color:         'var(--text-dim)',
        textAlign:     'center',
        lineHeight:    1.2,
        letterSpacing: '0.02em',
    },
};

// ── Section: Spielrunde ──────────────────────────────────────────────────────

export function ShooterRoundSection({ onBeforeChange, locked }: { onBeforeChange?: () => void; locked?: boolean } = {}) {
    const { shooterSettings: s, setShooterSettings } = useSettings();
    return (
        <div>
            <SliderRow
                label="Timelimit"
                min={10} max={120} step={5}
                value={s.roundDuration}
                display={s.roundDuration + 's'}
                onChange={v => { onBeforeChange?.(); setShooterSettings({ ...s, roundDuration: Math.round(v) }); }}
                tooltip="How long a round lasts before it ends automatically."
                hideSlider={locked}
            />
            <SliderRow
                label="Hit to Win"
                min={3} max={30} step={1}
                value={s.tugWinThreshold}
                display={String(s.tugWinThreshold)}
                onChange={v => { onBeforeChange?.(); setShooterSettings({ ...s, tugWinThreshold: Math.round(v) }); }}
                tooltip="Number of hits needed to win the round early."
                hideSlider={locked}
            />
            <SwitchRow
                label="Powerups"
                checked={s.modChoiceEnabled}
                onChange={v => { onBeforeChange?.(); setShooterSettings({ ...s, modChoiceEnabled: v }); }}
                tooltip="When on, the round-end screen occasionally lets you pick a new mod. Off by default — mods can still be equipped manually any time in the Player tab."
            />
            {!locked && (
                <div style={{ opacity: s.modChoiceEnabled ? 1 : 0.4, pointerEvents: s.modChoiceEnabled ? 'auto' : 'none' }}>
                    <SliderRow
                        label="Powerup Every"
                        min={2} max={10} step={1}
                        value={s.modChoiceInterval}
                        display={s.modChoiceInterval + ' rounds'}
                        onChange={v => { onBeforeChange?.(); setShooterSettings({ ...s, modChoiceInterval: Math.round(v) }); }}
                        tooltip="How many rounds between offered powerup choices."
                    />
                </div>
            )}
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
                tooltip="How many agents spawn in each wave."
            />
            <div style={{ marginTop: '16px' }}>
                <CompiTooltip text="When on, you're occasionally offered a new mod every few kills. On by default — mods can still be equipped manually any time in the Player tab.">
                    <Switch
                        checked={s.modChoiceEnabled}
                        onChange={v => setHordeSettings({ ...s, modChoiceEnabled: v })}
                        label="Offer powerups during play"
                    />
                </CompiTooltip>
            </div>
            <div style={{ marginTop: '16px', opacity: s.modChoiceEnabled ? 1 : 0.4, pointerEvents: s.modChoiceEnabled ? 'auto' : 'none' }}>
                <SliderRow
                    label="Kills per Upgrade"
                    min={10} max={300} step={10}
                    value={s.killsPerUpgrade}
                    display={String(s.killsPerUpgrade)}
                    onChange={v => setHordeSettings({ ...s, killsPerUpgrade: Math.round(v) })}
                    tooltip="How many kills between offered powerup choices."
                />
            </div>
        </div>
    );
}

// ── Legacy full panel (still used outside the lobby) ────────────────────────

export function ShooterSettingsPanel() {
    const { shooterSettings: s, setShooterSettings } = useSettings();
    return (
        <div>
            <section className="panel panel--md" style={styles.section}>
                <h3 style={styles.sectionTitle}>Starter DNA</h3>
                <ShooterDnaSection
                    dna={s.starterDna}
                    onChange={(i, v) => {
                        const newDna = [...s.starterDna];
                        newDna[i] = v;
                        setShooterSettings({ ...s, starterDna: newDna });
                    }}
                />
            </section>
            <section className="panel panel--md" style={styles.section}>
                <h3 style={styles.sectionTitle}>Game Round</h3>
                <ShooterRoundSection />
            </section>
            <section className="panel panel--md" style={styles.section}>
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
    // Surface chrome comes from the "panel panel--md" className — this only
    // carries the layout gap between the legacy panel's stacked sections.
    section: {
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
        width:      '170px',
        fontSize:   '14px',
        flexShrink: 0,
        color:      'var(--text-dim)',
    },
    slider: {
        flex:   1,
        cursor: 'pointer',
    },
    value: {
        width:     '52px',
        fontSize:  '14px',
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
        fontSize:     '13px',
    },
};
