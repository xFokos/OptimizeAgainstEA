import { useEffect, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { useSettings } from '../../../context/SettingsContext';
import { hordeRunStore } from '../horde/hordeRunStore';
import { hordeGameStore } from '../horde/hordeGameStore';
import { runModsStore } from '../mods/runModsStore';
import { MOD_POOL } from '../mods/modTypes';
import { LOOP_STEPS, LOOP_STEP_DURATION, LOOP_GENE_START, loopOffsetRad } from '../horde/hordeDna';
import { useMobile } from './lobbyHooks';
import { ovStyles, tabStyles } from './lobbyStyles';
import { HORDE_PRESETS, HORDE_BAR_GENES, type HordePresetId, type HordeTab } from './lobbyConstants';
import { DnaGeneRow } from './DnaGeneRow';

interface HordeOverviewProps {
    onNavigateTab: (tab: HordeTab) => void;
    /** Anchors for the guided tour's spotlight (see HordeLobby's TOUR_STEPS). */
    presetsRef?:  RefObject<HTMLDivElement | null>;
    dnaPanelRef?: RefObject<HTMLDivElement | null>;
}

export function HordeOverview({ onNavigateTab, presetsRef, dnaPanelRef }: HordeOverviewProps) {
    const isMobile = useMobile();
    const [lastRun, setLastRun]     = useState(hordeRunStore.lastRun);
    const [activeRun, setActiveRun] = useState(hordeGameStore.state);
    const activeModIds = useSyncExternalStore(cb => runModsStore.subscribe(cb), () => runModsStore.activeModIds);
    const { hordeSettings, setHordeSettings } = useSettings();

    useEffect(() => hordeRunStore.subscribe(() => setLastRun(hordeRunStore.lastRun)), []);
    useEffect(() => hordeGameStore.subscribe(() => setActiveRun(hordeGameStore.state)), []);

    // Abandon the in-progress run without having to die first — mirrors Solo
    // Play's Reset. Doesn't touch "Last Run": that's a separate, already-
    // completed run's scoreboard, not part of what's being abandoned here.
    const handleReset = () => {
        hordeGameStore.state = null;
        hordeGameStore.notify();
    };

    const [selectedPreset, setSelectedPreset] = useState<HordePresetId>(() => {
        const match = HORDE_PRESETS.find(p =>
            p.waveSize === hordeSettings.waveSize &&
            Math.abs(p.mutation - hordeSettings.mutationRate) < 0.001 &&
            Math.abs(p.strength - hordeSettings.mutationStrength) < 0.001 &&
            Math.abs(p.shootCd  - hordeSettings.shootCooldown) < 0.001 &&
            p.crossover === hordeSettings.crossoverType
        );
        return match?.id ?? 'custom';
    });

    const applyPreset = (p: typeof HORDE_PRESETS[number]) => {
        setSelectedPreset(p.id);
        setHordeSettings({
            ...hordeSettings,
            waveSize:         p.waveSize,
            mutationRate:     p.mutation,
            mutationStrength: p.strength,
            shootCooldown:    p.shootCd,
            crossoverType:    p.crossover,
        });
    };

    // Wenn Settings manuell geändert werden → zurück zu Custom
    useEffect(() => {
        if (selectedPreset === 'custom') return;
        const active = HORDE_PRESETS.find(p => p.id === selectedPreset);
        if (!active) return;
        const matches = active.waveSize === hordeSettings.waveSize &&
                         Math.abs(active.mutation - hordeSettings.mutationRate) < 0.001 &&
                         Math.abs(active.strength - hordeSettings.mutationStrength) < 0.001 &&
                         Math.abs(active.shootCd  - hordeSettings.shootCooldown) < 0.001 &&
                         active.crossover === hordeSettings.crossoverType;
        if (!matches) setSelectedPreset('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hordeSettings.waveSize, hordeSettings.mutationRate, hordeSettings.mutationStrength, hordeSettings.shootCooldown, hordeSettings.crossoverType]);

    const activePreset = HORDE_PRESETS.find(p => p.id === selectedPreset) ?? null;

    const activeMods = activeRun ? MOD_POOL.filter(m => activeModIds.includes(m.id)) : [];
    const bestIndividual = activeRun
        ? activeRun.population.individuals.reduce((a, b) => (b.fitness > a.fitness ? b : a))
        : null;
    const displayDna = bestIndividual ? bestIndividual.dna : hordeSettings.starterDna;

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
            <div style={ovStyles.slot}>
                {activeRun ? (
                    <div className="panel panel--md" style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Run In Progress</div>
                            <div style={ovStyles.roundValue}>{activeRun.score}</div>
                        </div>
                        <div style={ovStyles.divider} />
                        <div style={ovStyles.statsCompact}>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Kills</span>
                                <span style={ovStyles.statsCompactValue}>{activeRun.score}</span>
                            </div>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Generation</span>
                                <span style={ovStyles.statsCompactValue}>{activeRun.generation}</span>
                            </div>
                        </div>
                        {activeMods.length > 0 && (
                            <>
                                <div style={ovStyles.divider} />
                                <div>
                                    <span style={ovStyles.statsCompactLabel}>Active Items</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                        {activeMods.map(mod => (
                                            <span
                                                key={mod.id}
                                                title={`${mod.name} — ${mod.description}`}
                                                style={{
                                                    display:      'inline-flex',
                                                    alignItems:   'center',
                                                    gap:          4,
                                                    padding:      '4px 9px',
                                                    borderRadius: 999,
                                                    background:   'rgba(251,146,60,0.1)',
                                                    border:       '1px solid rgba(251,146,60,0.25)',
                                                    fontSize:     12,
                                                    color:        'rgba(255,255,255,0.75)',
                                                }}
                                            >
                                                {mod.icon} {mod.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        <div style={ovStyles.divider} />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn--outline btn--c-danger btn--sm" onClick={handleReset}>
                                Reset
                            </button>
                        </div>
                    </div>
                ) : lastRun ? (
                    <div className="panel panel--md" style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Last Run</div>
                            <div style={ovStyles.roundValue}>{lastRun.score}</div>
                        </div>
                        <div style={ovStyles.divider} />
                        <div style={ovStyles.statsCompact}>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Kills</span>
                                <span style={ovStyles.statsCompactValue}>{lastRun.score}</span>
                            </div>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Generations Reached</span>
                                <span style={ovStyles.statsCompactValue}>{lastRun.generation}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={ovStyles.emptySlot}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <span style={ovStyles.slotIcon}>💀</span>
                            <span style={ovStyles.slotTitle}>No runs yet</span>
                            <span style={ovStyles.slotSub}>
                                Start a wave and see<br />how long you survive.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Right column: Difficulty stacked above the (read-only) DNA display —
                same pattern as Solo's Overview. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div ref={presetsRef} className="panel panel--md" style={{ ...ovStyles.placeholder, flex: 'none' }}>
                    <span style={ovStyles.placeholderHeading}>Game</span>
                    <div style={ovStyles.presetBtns}>
                        {HORDE_PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p)}
                                style={{
                                    ...ovStyles.presetBtn,
                                    borderColor: selectedPreset === p.id ? p.color : 'var(--border)',
                                    color:       selectedPreset === p.id ? p.color : 'var(--text-dim)',
                                    background:  selectedPreset === p.id ? `${p.color}18` : 'transparent',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedPreset('custom')}
                            style={{
                                ...ovStyles.presetBtn,
                                borderColor: selectedPreset === 'custom' ? 'rgba(255,255,255,0.4)' : 'var(--border)',
                                color:       selectedPreset === 'custom' ? 'rgba(255,255,255,0.75)' : 'var(--text-dim)',
                                background:  selectedPreset === 'custom' ? 'rgba(255,255,255,0.06)' : 'transparent',
                            }}
                        >
                            Custom
                        </button>
                    </div>
                    <p style={ovStyles.presetDesc}>
                        {activePreset ? activePreset.desc : 'Custom configuration — wave size adjusted manually.'}
                    </p>
                    <div style={ovStyles.divider} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Wave Size</span>
                            <span style={ovStyles.statsCompactValue}>{hordeSettings.waveSize}</span>
                        </div>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Powerups</span>
                            <span style={ovStyles.statsCompactValue}>{hordeSettings.modChoiceEnabled ? 'On' : 'Off'}</span>
                        </div>
                    </div>
                    <button
                        className="btn btn--ghost btn--sm"
                        style={{ alignSelf: 'flex-end' }}
                        onClick={() => onNavigateTab('DnaWave')}
                    >
                        Wave Settings →
                    </button>
                </div>

                {/* DNA-Sektion — read-only here; edited from the DNA & Wave tab.
                    No separate "starter vs current" label — displayDna is
                    either the current run's best agent, or (now that
                    Size/Opacity/Movement Loop are real starter-DNA slots too)
                    the starter DNA setting itself. Either way there's always
                    a real value, so this never needs placeholders. */}
                <div ref={dnaPanelRef} className="panel panel--md">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ ...tabStyles.sectionLabel, margin: 0 }}>DNA</p>
                        <button className="btn btn--ghost btn--sm" onClick={() => onNavigateTab('DnaWave')}>
                            Edit →
                        </button>
                    </div>
                    <div style={{ ...ovStyles.geneList, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
                        {HORDE_BAR_GENES.map(g => (
                            <DnaGeneRow
                                key={g.index}
                                label={g.label}
                                tooltip={g.tooltip}
                                value={displayDna[g.index] ?? 0}
                                delta={0}
                            />
                        ))}
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <span style={ovStyles.placeholderHeading}>Movement Loop</span>
                        <p style={{ ...ovStyles.presetDesc, marginTop: 4 }}>
                            Evolved steering offsets, applied on top of the normal chase/dodge — repeats every {(LOOP_STEPS * LOOP_STEP_DURATION).toFixed(1)}s.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {Array.from({ length: LOOP_STEPS }, (_, i) => {
                                const gene = displayDna[LOOP_GENE_START + i] ?? 0.5;
                                const deg  = Math.round((loopOffsetRad(gene) * 180) / Math.PI);
                                return (
                                    <span
                                        key={i}
                                        style={{
                                            display:      'inline-flex',
                                            alignItems:   'center',
                                            padding:      '4px 10px',
                                            borderRadius: 999,
                                            background:   'rgba(251,146,60,0.1)',
                                            border:       '1px solid rgba(251,146,60,0.25)',
                                            fontSize:     12,
                                            fontFamily:   'var(--font-mono)',
                                            color:        'rgba(255,255,255,0.75)',
                                        }}
                                    >
                                        {deg > 0 ? `+${deg}°` : `${deg}°`}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
