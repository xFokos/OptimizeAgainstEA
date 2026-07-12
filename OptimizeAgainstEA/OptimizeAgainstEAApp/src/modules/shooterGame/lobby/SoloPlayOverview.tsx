import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings, defaultShooterSettings } from '../../../context/SettingsContext';
import { makeInitialGameState } from '../game/makeGameState';
import { DNA_NAMES, DNA_GENE_INFO } from '../shooter.types';
import { gameStore } from '../game/gameStore';
import { analyticsStore } from '../game/analyticsStore';
import { useMobile } from './lobbyHooks';
import { ovStyles, tabStyles } from './lobbyStyles';
import { PRESETS, type PresetId, type LobbyTab } from './lobbyConstants';
import { DnaGeneRow } from './DnaGeneRow';

// ---- Solo Play Overview (tab 1) ----

interface SoloPlayOverviewProps {
    selectedPreset:    PresetId;
    setSelectedPreset: (p: PresetId) => void;
    onNavigateTab:     (tab: LobbyTab) => void;
    /** Anchors for the guided tour's spotlight (see NormalLobby's TOUR_STEPS). */
    presetsRef?:  RefObject<HTMLDivElement | null>;
    dnaPanelRef?: RefObject<HTMLDivElement | null>;
}

export function SoloPlayOverview({ selectedPreset, setSelectedPreset, onNavigateTab, presetsRef, dnaPanelRef }: SoloPlayOverviewProps) {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const [round, setRound]     = useState(gameStore.state?.roundNumber ?? 0);
    const [hasGame, setHasGame] = useState(!!gameStore.state);
    const [lastRecord, setLastRecord] = useState(analyticsStore.rounds.at(-1) ?? null);
    const { shooterSettings, setShooterSettings, eaSettings, setEaSettings } = useSettings();

    useEffect(() => {
        const syncGame = () => {
            setHasGame(!!gameStore.state);
            setRound(gameStore.state?.roundNumber ?? 0);
        };
        const syncAnalytics = () => setLastRecord(analyticsStore.rounds.at(-1) ?? null);
        syncGame();
        syncAnalytics();
        const unsub1 = gameStore.subscribe(syncGame);
        const unsub2 = analyticsStore.subscribe(syncAnalytics);
        return () => { unsub1(); unsub2(); };
    }, []);

    const handlePrepare = () => {
        gameStore.state = makeInitialGameState(shooterSettings);
        gameStore.notify();
    };

    const handleReset = () => {
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        analyticsStore.clear();
    };

    const applyPreset = (p: typeof PRESETS[number]) => {
        setSelectedPreset(p.id);
        setShooterSettings({ ...defaultShooterSettings, starterDna: [...p.dna], modChoiceInterval: p.modInterval });
        setEaSettings({ ...eaSettings, mutationRate: p.mutation, mutationStrength: p.strength, presimGenerations: p.presim });
    };

    const activePreset = PRESETS.find(p => p.id === selectedPreset) ?? null;

    const showActiveDna = round > 0 && !!gameStore.state?.agent.dna;
    const displayDna    = showActiveDna ? gameStore.state.agent.dna : shooterSettings.starterDna;

    const [displayedDna, setDisplayedDna] = useState<number[]>([...displayDna]);
    const [prevDna, setPrevDna] = useState<number[]>([...displayDna]);
    const animTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);
    const prevRoundRef = useRef(round);

    useEffect(() => {
        const roundIncreased = round > prevRoundRef.current;
        prevRoundRef.current = round;

        if (!roundIncreased || !showActiveDna) {
            setDisplayedDna([...displayDna]);
            setPrevDna([...displayDna]);
        } else {
            setPrevDna([...displayedDna]); // freeze the last-shown values as the delta baseline
            displayDna.forEach((target, i) => {
                const t = setTimeout(() => {
                    setDisplayedDna(prev => {
                        const next = [...prev];
                        next[i] = target;
                        return next;
                    });
                }, Math.floor(i / 2) * 200 + 80);
                animTimers.current.push(t);
            });
        }

        return () => {
            animTimers.current.forEach(clearTimeout);
            animTimers.current = [];
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [round, displayDna, showActiveDna]);

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
            <div style={ovStyles.slot}>
            {hasGame ? (
                    <div className="panel panel--md" style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Round</div>
                            <div style={ovStyles.roundValue}>{round}</div>
                        </div>

                        <div style={ovStyles.divider} />

                        {lastRecord ? (
                            <div style={ovStyles.statsCompact}>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>EA Accuracy</span>
                                    <span style={ovStyles.statsCompactValue}>{Math.round(lastRecord.accuracy * 100)}%</span>
                                </div>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>Score (EA : You)</span>
                                    <span style={ovStyles.statsCompactValue}>{lastRecord.hitsLanded} : {lastRecord.hitsReceived}</span>
                                </div>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>EA Fitness</span>
                                    <span style={ovStyles.statsCompactValue}>{lastRecord.fitness.toFixed(1)}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ ...ovStyles.statsCompactLabel, flex: 1 }}>No round completed yet</div>
                        )}

                        <div style={ovStyles.divider} />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn--outline btn--c-danger btn--sm" onClick={handleReset}>
                                Reset
                            </button>
                            {round > 0 && (
                                <button className="btn btn--ghost btn--sm" onClick={() => navigate('/Analytics')}>
                                    Analytics →
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={ovStyles.emptySlot}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <span style={ovStyles.slotIcon}>🎮</span>
                            <span style={ovStyles.slotTitle}>No active game</span>
                            <span style={ovStyles.slotSub}>
                                Choose a difficulty<br />
                                and start your first round.
                            </span>
                        </div>
                        <button
                            className="btn btn--outline btn--sm"
                            style={{ width: '100%', marginTop: 16 }}
                            onClick={handlePrepare}
                        >
                            Set up round →
                        </button>
                    </div>
                )}
            </div>

            {/* Right column: Difficulty stacked above the (read-only) DNA display.
                Both stretch to the same width automatically; the Status box on the
                left stretches to match this column's combined height. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div ref={presetsRef} className="panel panel--md" style={{ ...ovStyles.placeholder, flex: 'none' }}>
                    <span style={ovStyles.placeholderHeading}>Game</span>
                    <div style={ovStyles.presetBtns}>
                        {PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p)}
                                disabled={round > 0}
                                style={{
                                    ...ovStyles.presetBtn,
                                    borderColor: selectedPreset === p.id ? p.color : 'var(--border)',
                                    color:       selectedPreset === p.id ? p.color : 'var(--text-dim)',
                                    background:  selectedPreset === p.id ? `${p.color}18` : 'transparent',
                                    opacity:     round > 0 ? 0.35 : 1,
                                    cursor:      round > 0 ? 'not-allowed' : 'pointer',
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
                        {activePreset
                            ? activePreset.desc
                            : 'Custom configuration — settings adjusted manually.'}
                    </p>
                    <div style={ovStyles.divider} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Time Limit</span>
                            <span style={ovStyles.statsCompactValue}>{shooterSettings.roundDuration}s</span>
                        </div>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Hit to Win</span>
                            <span style={ovStyles.statsCompactValue}>{shooterSettings.tugWinThreshold}</span>
                        </div>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Powerups</span>
                            <span style={ovStyles.statsCompactValue}>
                                {shooterSettings.modChoiceEnabled ? `Every ${shooterSettings.modChoiceInterval} rounds` : 'Off'}
                            </span>
                        </div>
                    </div>
                    <button
                        className="btn btn--ghost btn--sm"
                        style={{ alignSelf: 'flex-end' }}
                        onClick={() => onNavigateTab('DnaRound')}
                    >
                        Round Settings →
                    </button>
                </div>

                {/* DNA-Sektion — read-only here; edited from the DNA & Round tab.
                    No separate "starter vs current" label — it's just DNA,
                    whichever is currently true (live agent if a game exists). */}
                <div ref={dnaPanelRef} className="panel panel--md">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ ...tabStyles.sectionLabel, margin: 0 }}>DNA</p>
                        <button className="btn btn--ghost btn--sm" onClick={() => onNavigateTab('DnaRound')}>
                            Edit →
                        </button>
                    </div>
                    <div style={{ ...ovStyles.geneList, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
                        {DNA_NAMES.map((name, i) => (
                            <DnaGeneRow
                                key={i}
                                label={DNA_GENE_INFO[name].label}
                                tooltip={DNA_GENE_INFO[name].tooltip}
                                value={displayedDna[i] ?? 0}
                                delta={showActiveDna ? (displayedDna[i] ?? 0) - (prevDna[i] ?? 0) : 0}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
