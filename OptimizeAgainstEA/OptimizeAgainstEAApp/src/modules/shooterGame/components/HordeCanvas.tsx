import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { ARENA, type InputState, type Population, type DNA } from '../shooter.types';
import type { HordeGameState, HordePhase, HordeMap } from '../horde/hordeTypes';
import { hordeRunStore }  from '../horde/hordeRunStore';
import { hordeGameStore } from '../horde/hordeGameStore';
import { HORDE_TUTORIAL_DNA } from '../horde/hordeDna';
import { resolveHordeMap, getHordeMap } from '../horde/hordeMaps';
import { updateHorde, makeInitialState, resetHordeEngine, type HordeEA } from '../horde/hordeEngine';
import { render, HC } from '../horde/hordeRender';
import { HordeDnaPanel, PANEL_W } from './HordeDnaPanel';
import { useInput }       from '../hooks/useInput';
import { useTutorialStep } from '../hooks/useTutorialStep';
import { useSettings }    from '../../../context/SettingsContext';
import type { PlayerStats } from '../shooter.types';
import { applyMods, MOD_POOL, type ModDefinition } from '../mods/modTypes';
import { runModsStore } from '../mods/runModsStore';
import { CompiBubble } from '../../../components/hints';

// React wiring for Horde mode: game loop, overlays (start/choosing/dead),
// tutorial coachmarks. The pure game/EA logic lives in horde/hordeEngine.ts,
// the canvas drawing in horde/hordeRender.ts.

// Alle N Kills eine Mod-Auswahl anbieten (Vampire-Survivors-Stil) — N is now
// configurable via hordeSettings.killsPerUpgrade (see killsPerUpgradeRef below).
const MOD_CHOICE_COUNT  = 3;

// ---- Tutorial-feste Spielkonfiguration ----
// Einzige Übungsrunde: feste Map mit Deckung (Pillars), kleine Welle, inerte
// Gegner (siehe HORDE_TUTORIAL_DNA) und ein niedriger Kill-Schwellwert, damit
// die Mod-Auswahl ("Powerups") garantiert schnell auftaucht.
const TUTORIAL_WAVE_SIZE           = 8;
const TUTORIAL_KILLS_PER_UPGRADE   = 2;

type HordeTutorialStep = 'move' | 'aim' | 'shoot' | 'obstacles' | 'evolution' | 'mods' | 'done';

const HORDE_TUTORIAL_STEP_CONTENT: Record<HordeTutorialStep, { title: string; body: string }> = {
    move:      { title: 'Step 1 — Move',      body: 'Use WASD or the arrow keys to move around the arena.' },
    aim:       { title: 'Step 2 — Aim',       body: 'Move your mouse — your reticle follows it wherever it goes.' },
    shoot:     { title: 'Step 3 — Shoot',     body: 'Left-click or press Space to fire at the dummies.' },
    obstacles: { title: 'Cover',              body: "Those pillars block bullets — yours and theirs. Duck behind one to break line of sight." },
    // Real, not a mockup — the DNA panel really did just update: the killed
    // agent's slot in the population got a fresh genome (a mix of two good
    // survivors, plus a small random tweak) and respawned. Unlike Solo's
    // round-based reveal, here it happens live, on every single death.
    evolution: { title: 'That panel just evolved', body: "Look at the DNA panel on the right — it just updated. This dummy's replacement is a mix of two survivors' genes (crossover) with a small random tweak (mutation). That's the whole algorithm, happening live, every time one of them dies." },
    mods:      { title: 'Powerups',           body: 'Every couple of kills you get to pick a powerup that boosts your stats for the rest of the run.' },
    done:      { title: "You've got it!",     body: 'Try the powerup choice below, then finish whenever you\'re ready.' },
};

// ---- Component ----

const BTN: React.CSSProperties = {
    padding:       '10px 28px',
    background:    'transparent',
    border:        `1px solid ${HC}`,
    borderRadius:  6,
    color:         HC,
    fontFamily:    '"JetBrains Mono", monospace',
    fontSize:      14,
    cursor:        'pointer',
    letterSpacing: '0.06em',
};

interface HordeCanvasProps {
    scale?:            number;
    externalInputRef?: RefObject<InputState>;
    hideDnaPanel?:     boolean;
    tutorial?:         boolean;
}

export function HordeCanvas({ scale = 1, externalInputRef, hideDnaPanel = false, tutorial = false }: HordeCanvasProps) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const localInput = useInput();
    const inputRef   = externalInputRef ?? localInput;
    const navigate   = useNavigate();

    const { hordeSettings, shooterSettings } = useSettings();
    // Resume a saved run if there is one. A 'choosing' phase can't resume as-is —
    // the pending mod-choice prompt itself isn't persisted — so it downgrades to
    // 'playing' (the run continues, that one mod offer is simply skipped).
    const resumed: HordeGameState | null = hordeGameStore.state
        ? (hordeGameStore.state.phase === 'choosing' ? { ...hordeGameStore.state, phase: 'playing' } : hordeGameStore.state)
        : null;
    const stateRef       = useRef<HordeGameState | null>(resumed);
    const eaRef          = useRef<HordeEA>(hordeSettings);
    const playerStatsRef = useRef<PlayerStats>(shooterSettings.playerStats);
    const hordeSizeRef   = useRef(tutorial ? TUTORIAL_WAVE_SIZE : hordeSettings.waveSize);
    const starterDnaRef  = useRef(tutorial ? HORDE_TUTORIAL_DNA : hordeSettings.starterDna);
    const modChoiceEnabledRef = useRef(tutorial ? true : hordeSettings.modChoiceEnabled);
    const killsPerUpgradeRef  = useRef(tutorial ? TUTORIAL_KILLS_PER_UPGRADE : hordeSettings.killsPerUpgrade);
    const mapRef         = useRef<HordeMap>(tutorial ? getHordeMap('pillars') : resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn));

    useEffect(() => { eaRef.current          = hordeSettings;               }, [hordeSettings]);
    useEffect(() => { playerStatsRef.current = shooterSettings.playerStats;  }, [shooterSettings]);
    useEffect(() => { hordeSizeRef.current   = tutorial ? TUTORIAL_WAVE_SIZE : hordeSettings.waveSize;     }, [hordeSettings, tutorial]);
    useEffect(() => { starterDnaRef.current  = tutorial ? HORDE_TUTORIAL_DNA : hordeSettings.starterDna;   }, [hordeSettings.starterDna, tutorial]);
    useEffect(() => { modChoiceEnabledRef.current = tutorial ? true : hordeSettings.modChoiceEnabled; }, [hordeSettings.modChoiceEnabled, tutorial]);
    useEffect(() => { killsPerUpgradeRef.current  = tutorial ? TUTORIAL_KILLS_PER_UPGRADE : hordeSettings.killsPerUpgrade;   }, [hordeSettings.killsPerUpgrade, tutorial]);
    useEffect(() => {
        mapRef.current = tutorial
            ? getHordeMap('pillars')
            : resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn);
    }, [tutorial, hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn]);

    const [uiPhase,  setUiPhase]  = useState<HordePhase | 'start'>(resumed?.phase ?? 'start');
    const [uiGen,    setUiGen]    = useState(resumed?.generation ?? 0);
    const [uiScore,  setUiScore]  = useState(resumed?.score ?? 0);
    const [bestDna,  setBestDna]  = useState<DNA | null>(() => {
        if (!resumed) return null;
        const best = resumed.population.individuals.reduce((a, b) => b.fitness > a.fitness ? b : a);
        return [...best.dna];
    });
    const [pendingModChoices, setPendingModChoices] = useState<ModDefinition[] | null>(null);

    // Tutorial step coachmarks — advanced live from the game loop (refs, since
    // that callback is created once and must not go stale). Mirrors
    // ShooterCanvas. useTutorialStep also enforces a minimum time each step
    // stays visible, so a step a player satisfies instantly (e.g. already
    // moving) doesn't flash by unread.
    const tutorialAimOriginRef = useRef<{ x: number; y: number } | null>(null);
    const {
        stepRef: tutorialStepRef,
        step: tutorialStep,
        bubbleClosed: tutorialBubbleClosed,
        setBubbleClosed: setTutorialBubbleClosed,
        advance: advanceTutorialStep,
        request: requestTutorialStep,
        tick: tickTutorialStep,
    } = useTutorialStep<HordeTutorialStep>('move');

    const finishTutorial = async () => {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        hordeGameStore.state = null;
        hordeGameStore.notify();
        navigate('/lobby/shooter', { state: { mode: 'horde' } });
    };

    const startGame = () => {
        resetHordeEngine();
        runModsStore.reset();
        if (tutorial) {
            tutorialAimOriginRef.current = null;
            advanceTutorialStep('move');
        }
        // Base genes + movement loop + size/opacity are all jittered around the
        // player's Horde Starter DNA (±0.05 per gene — same bootstrap Solo Play's
        // initPopulation() uses), so none of it is a dead setting that always
        // gets overridden by pure randomness. Only the spawn-side weights have
        // no starter equivalent (see HORDE_STARTER_DNA_LENGTH) and stay fully
        // random every spawn, on purpose — not something to bias up front.
        const pop: Population = {
            generation:  1,
            individuals: Array.from({ length: hordeSizeRef.current }, () => ({
                dna: [
                    ...starterDnaRef.current.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1))),
                    ...Array.from({ length: 4 }, () => Math.random()), // spawn-side weights: top, right, bottom, left
                ],
                fitness: 0,
            })),
            bestFitness: 0,
            avgFitness:  0,
        };
        stateRef.current = makeInitialState(pop, mapRef.current);
        hordeGameStore.state = stateRef.current;
        hordeGameStore.notify();
        setUiPhase('playing');
        setUiGen(pop.individuals.length);
        setUiScore(0);
        setBestDna(null);
    };

    const chooseHordeMod = (mod: ModDefinition) => {
        runModsStore.toggleMod(mod.id);
        setPendingModChoices(null);
        if (stateRef.current) stateRef.current = { ...stateRef.current, phase: 'playing' };
        hordeGameStore.state = stateRef.current;
        setUiPhase('playing');
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let last = performance.now();

        const loop = (ts: number) => {
            const dt = Math.min((ts - last) / 1000, 0.05);
            last = ts;

            const s = stateRef.current;
            if (s === null) {
                ctx.fillStyle = '#0f0f1a';
                ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
            } else if (s.phase === 'playing') {
                const activeModIds       = runModsStore.activeModIds;
                const effectivePlayerStats = applyMods(playerStatsRef.current, activeModIds);
                let next = updateHorde(s, dt, inputRef.current, effectivePlayerStats, eaRef.current, activeModIds);
                if (next.generation > s.generation) {
                    const best = next.population.individuals.reduce((a, b) => b.fitness > a.fitness ? b : a);
                    setBestDna([...best.dna]);
                }
                if (next.phase === 'dead') {
                    setUiPhase('dead');
                    setUiScore(next.score);
                    setUiGen(next.generation);
                    hordeRunStore.record({ score: next.score, generation: next.generation });
                    // The run is over — nothing left to resume. "Last Run" above
                    // already has the score/generation via hordeRunStore.
                    hordeGameStore.state = null;
                    hordeGameStore.notify();
                } else if (modChoiceEnabledRef.current && Math.floor(next.score / killsPerUpgradeRef.current) > Math.floor(s.score / killsPerUpgradeRef.current)) {
                    // Kill-Meilenstein erreicht (Vampire-Survivors-Stil): Auswahl anbieten,
                    // falls noch nicht unlockte Mods übrig sind — sonst einfach weiterspielen.
                    const available = MOD_POOL.filter(m => !runModsStore.activeModIds.includes(m.id));
                    if (available.length > 0) {
                        const shuffled = [...available].sort(() => Math.random() - 0.5);
                        setPendingModChoices(shuffled.slice(0, Math.min(MOD_CHOICE_COUNT, available.length)));
                        setUiPhase('choosing');
                        next = { ...next, phase: 'choosing' };
                    }
                }

                if (tutorial) {
                    const step = tutorialStepRef.current;
                    const inp  = inputRef.current;
                    if (step === 'move' && (inp.up || inp.down || inp.left || inp.right)) {
                        requestTutorialStep('aim');
                    } else if (step === 'aim') {
                        if (tutorialAimOriginRef.current === null) {
                            tutorialAimOriginRef.current = { x: inp.mouseX, y: inp.mouseY };
                        } else {
                            const dx = inp.mouseX - tutorialAimOriginRef.current.x;
                            const dy = inp.mouseY - tutorialAimOriginRef.current.y;
                            if (dx * dx + dy * dy > 40 * 40) requestTutorialStep('shoot');
                        }
                    } else if (step === 'shoot' && inp.shoot) {
                        requestTutorialStep('obstacles');
                    } else if (step === 'obstacles' && next.score >= 1) {
                        // The DNA panel only renders when !hideDnaPanel (mobile
                        // landscape hides it for the touch zones) — skip the
                        // step pointing at it rather than reference nothing.
                        requestTutorialStep(hideDnaPanel ? 'mods' : 'evolution');
                    } else if (step === 'evolution') {
                        requestTutorialStep('mods');
                    } else if (step === 'mods' && next.phase === 'choosing') {
                        requestTutorialStep('done');
                    }
                    tickTutorialStep();
                }

                stateRef.current = next;
                if (next.phase !== 'dead') hordeGameStore.state = next;
                render(ctx, next);
            } else {
                render(ctx, s);
            }

            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overlay: React.CSSProperties = {
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            16,
        background:     'rgba(15,15,26,0.78)',
        fontFamily:     '"JetBrains Mono", monospace',
        color:          '#fff',
    };

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
        {/* Mirrors the DNA panel's width on the other side so the canvas itself
            stays centered instead of being pushed left by the panel. */}
        {!hideDnaPanel && <div style={{ width: PANEL_W, flexShrink: 0 }} />}
        <div style={{ width: ARENA.WIDTH * scale, height: ARENA.HEIGHT * scale, position: 'relative', flexShrink: 0 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <canvas ref={canvasRef} width={ARENA.WIDTH} height={ARENA.HEIGHT} style={{ display: 'block' }} />

                {uiPhase === 'start' && (
                    <div style={{ ...overlay, pointerEvents: 'auto' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: HC, letterSpacing: '0.12em' }}>
                            {tutorial ? 'HORDE TUTORIAL' : 'HORDE MODE'}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 320, lineHeight: 1.7 }}>
                            {tutorial ? (
                                <>
                                    Practice against harmless dummies — they barely move.<br />
                                    Learn the pillars for cover and the powerup picks along the way.
                                </>
                            ) : (
                                <>
                                    Agents rush toward you — one shot kills.<br />
                                    If one touches you, it&apos;s over.<br />
                                    Every kill evolves the next spawn.
                                </>
                            )}
                        </div>
                        <button style={{ ...BTN, marginTop: 8 }} onClick={startGame}>
                            {tutorial ? 'Start Tutorial →' : 'Start →'}
                        </button>
                    </div>
                )}

                {uiPhase === 'choosing' && pendingModChoices !== null && (
                    <div style={{ ...overlay, pointerEvents: 'auto' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: HC, letterSpacing: '0.1em' }}>CHOOSE A MOD</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{uiScore} kills so far</div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
                            {pendingModChoices.map(mod => (
                                <button
                                    key={mod.id}
                                    onClick={() => chooseHordeMod(mod)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        width: 170, padding: '18px 14px',
                                        background: 'rgba(255,255,255,0.05)', border: `1px solid ${HC}55`,
                                        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    <span style={{ fontSize: 26 }}>{mod.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: HC, textAlign: 'center' }}>{mod.name}</span>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{mod.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {uiPhase === 'dead' && (
                    <div style={{ ...overlay, pointerEvents: 'auto' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: '#ef5350', letterSpacing: '0.1em' }}>YOU DIED</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, textAlign: 'center' }}>
                            {uiScore} kills · Gen {uiGen}
                        </div>
                        <button style={{ ...BTN, marginTop: 8 }} onClick={startGame}>Try Again →</button>
                    </div>
                )}

                {tutorial && uiPhase === 'playing' && !tutorialBubbleClosed && (
                    <CompiBubble
                        title={HORDE_TUTORIAL_STEP_CONTENT[tutorialStep].title}
                        body={HORDE_TUTORIAL_STEP_CONTENT[tutorialStep].body}
                        actions={tutorialStep === 'done'
                            ? [{ label: 'Finish Tutorial → Lobby', onClick: finishTutorial, variant: 'primary' }]
                            : []}
                        onClose={() => setTutorialBubbleClosed(true)}
                    />
                )}
            </div>
        </div>
        {!hideDnaPanel && <HordeDnaPanel bestDna={bestDna} height={ARENA.HEIGHT * scale} />}
        </div>
    );
}
