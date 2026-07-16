import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ARENA, HORDE_TUTORIAL_COMPLETED_KEY, type InputState, type Population, type DNA } from '../shooter.types';
import type { HordeGameState, HordePhase, HordeMap } from '../horde/hordeTypes';
import { hordeRunStore }  from '../horde/hordeRunStore';
import { hordeGameStore } from '../horde/hordeGameStore';
import { HORDE_TUTORIAL_DNA, HORDE_TUTORIAL_RAMP_DNA } from '../horde/hordeDna';
import { resolveHordeMap, getHordeMap } from '../horde/hordeMaps';
import { updateHorde, makeInitialState, resetHordeEngine, getHordeShieldAngle, type HordeEA } from '../horde/hordeEngine';
import { SHIELD_MOD_ID } from '../mods/shotEngine';
import { render, HC } from '../horde/hordeRender';
import { HordeDnaPanel, PANEL_W } from './HordeDnaPanel';
import { useInput }       from '../hooks/useInput';
import { useTutorialStep } from '../hooks/useTutorialStep';
import { useSettings }    from '../../../context/SettingsContext';
import type { PlayerStats } from '../shooter.types';
import { applyMods, MOD_POOL, isModOfferable, stackOfferLabel, type ModDefinition } from '../mods/modTypes';
import { runModsStore } from '../mods/runModsStore';
import { CompiBubble } from '../../../components/hints';
import { TutorialHordeExplainer } from './tutorialHordeContent';

// React wiring for Horde mode: game loop, overlays (start/choosing/dead),
// tutorial coachmarks. The pure game/EA logic lives in horde/hordeEngine.ts,
// the canvas drawing in horde/hordeRender.ts.

// Alle N Kills eine Mod-Auswahl anbieten (Vampire-Survivors-Stil) — N is now
// configurable via hordeSettings.killsPerUpgrade (see killsPerUpgradeRef below).
const MOD_CHOICE_COUNT  = 3;

// ---- Tutorial-feste Spielkonfiguration ----
// Einzige Übungsrunde: feste Map mit Deckung (Pillars), kleine Welle, inerte
// Gegner (siehe HORDE_TUTORIAL_DNA). Kills lösen hier KEINE Powerup-Auswahl
// aus — die kommt genau einmal, wenn der Button des 'mods'-Coachmarks das
// Auswahl-Overlay öffnet, damit sie nicht unvermittelt reinplatzt.
const TUTORIAL_WAVE_SIZE           = 8;

// Survival-Finale: bei diesem Kill-Stand meldet sich Compi zur Evolution, bei
// diesem Ziel ist das Tutorial geschafft.
const TUTORIAL_EVOLVE_NOTE_KILLS   = 35;
const TUTORIAL_SURVIVE_GOAL_KILLS  = 100;
// Bis hierhin sind die Dummies inert (HORDE_TUTORIAL_DNA); danach übernimmt
// HORDE_TUTORIAL_RAMP_DNA (Default-Werte + mehr Aggression), damit im Survival-
// Teil sichtbar etwas passiert und die Evolution überhaupt was zu tun hat.
const TUTORIAL_DNA_RAMP_KILLS      = 25;

type HordeTutorialStep = 'move' | 'aim' | 'shoot' | 'obstacles' | 'mods' | 'survive' | 'evolve' | 'done';

// Coachmark-Texte je Eingabegerät — auf Touch sind Zielen und Schießen dieselbe
// Geste (der rechte Stick zielt UND feuert, siehe MobileAimZone), daher ein
// zusammengefasster "Aim & shoot"-Schritt statt getrennt aim/shoot.
// Modul-Konstanten (kein Factory-Aufruf pro Render); ab 'obstacles' geräteunabhängig.
const HORDE_STEP_CONTENT_SHARED = {
    obstacles: { title: 'Cover',    body: "Those pillars block bullets — yours and theirs. Duck behind one to break line of sight." },
    mods:      { title: 'Powerups', body: "Time for a powerup — pick one and it boosts your stats for the rest of the run. In a real run you earn one every couple of kills." },
    survive:   { title: 'Now survive', body: `That's your toolkit. Now the real thing — hold out against the horde and rack up kills. Reach ${TUTORIAL_SURVIVE_GOAL_KILLS} to finish the tutorial.` },
    evolve:    { title: 'They evolve', body: `See how they keep coming? Every enemy you kill respawns at once — bred from the ones that survived and nudged at random, so the horde slowly gets better at hunting you. Push on to ${TUTORIAL_SURVIVE_GOAL_KILLS} kills.` },
    done:      { title: "You've got it!", body: `${TUTORIAL_SURVIVE_GOAL_KILLS} kills — nicely done! Hit the button and we'll break down how the horde actually evolves.` },
} as const;

const HORDE_STEP_CONTENT: Record<'touch' | 'desktop', Record<HordeTutorialStep, { title: string; body: string }>> = {
    touch: {
        move:  { title: 'Step 1 — Move',        body: 'Use the left stick to move around the arena.' },
        aim:   { title: 'Step 2 — Aim & shoot', body: 'Use the right stick to aim — it fires on its own while you hold it. Take out a dummy.' },
        // Auf Touch nie erreicht (aim → obstacles direkt), muss aber im Record stehen.
        shoot: { title: 'Step 2 — Aim & shoot', body: 'Use the right stick to aim — it fires on its own while you hold it.' },
        ...HORDE_STEP_CONTENT_SHARED,
    },
    desktop: {
        move:  { title: 'Step 1 — Move',  body: 'Use WASD or the arrow keys to move around the arena.' },
        aim:   { title: 'Step 2 — Aim',   body: 'Move your mouse — your reticle follows it wherever it goes.' },
        shoot: { title: 'Step 3 — Shoot', body: 'Left-click or press Space to fire at the dummies.' },
        ...HORDE_STEP_CONTENT_SHARED,
    },
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
    // Zone-Touch-Steuerung aktiv (Mobile-Landscape). Explizit statt aus einem
    // Nachbar-Prop abgeleitet: HordeGamePage setzt externalInputRef auch am
    // Desktop, das taugt hier — anders als in ShooterCanvas — nicht als Signal.
    // Steuert die geräteabhängigen Tutorial-Texte, den zusammengefassten
    // Aim-&-Shoot-Schritt und blendet das DNA-Panel aus (kein Platz).
    touchControls?:    boolean;
    tutorial?:         boolean;
}

export function HordeCanvas({ scale = 1, externalInputRef, touchControls = false, tutorial = false }: HordeCanvasProps) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const localInput = useInput();
    const inputRef   = externalInputRef ?? localInput;
    const navigate   = useNavigate();

    const { hordeSettings, shooterSettings } = useSettings();
    // Resume a saved run if there is one. A 'choosing' phase can't resume as-is —
    // the pending mod-choice prompt itself isn't persisted — so it downgrades to
    // 'playing' (the run continues, that one mod offer is simply skipped).
    // Tutorial: nie resumen und (siehe unten) nie in den Store schreiben — die
    // Übungsrunde darf nicht als "Continue Horde" ins echte Spiel durchsickern.
    const resumed: HordeGameState | null = !tutorial && hordeGameStore.state
        ? (hordeGameStore.state.phase === 'choosing' ? { ...hordeGameStore.state, phase: 'playing' } : hordeGameStore.state)
        : null;
    const stateRef       = useRef<HordeGameState | null>(resumed);
    const eaRef          = useRef<HordeEA>(hordeSettings);
    const playerStatsRef = useRef<PlayerStats>(shooterSettings.playerStats);
    const hordeSizeRef   = useRef(tutorial ? TUTORIAL_WAVE_SIZE : hordeSettings.waveSize);
    const starterDnaRef  = useRef(tutorial ? HORDE_TUTORIAL_DNA : hordeSettings.starterDna);
    // Tutorial: false — Kills bieten keine Mods an; das eine skriptgesteuerte
    // Angebot öffnet der Button des 'mods'-Coachmarks (openTutorialModChoice).
    const modChoiceEnabledRef = useRef(tutorial ? false : hordeSettings.modChoiceEnabled);
    const killsPerUpgradeRef  = useRef(hordeSettings.killsPerUpgrade);
    const mapRef         = useRef<HordeMap>(tutorial ? getHordeMap('pillars') : resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn));

    useEffect(() => { eaRef.current          = hordeSettings;               }, [hordeSettings]);
    useEffect(() => { playerStatsRef.current = shooterSettings.playerStats;  }, [shooterSettings]);
    useEffect(() => { hordeSizeRef.current   = tutorial ? TUTORIAL_WAVE_SIZE : hordeSettings.waveSize;     }, [hordeSettings, tutorial]);
    useEffect(() => { starterDnaRef.current  = tutorial ? HORDE_TUTORIAL_DNA : hordeSettings.starterDna;   }, [hordeSettings.starterDna, tutorial]);
    useEffect(() => { modChoiceEnabledRef.current = tutorial ? false : hordeSettings.modChoiceEnabled; }, [hordeSettings.modChoiceEnabled, tutorial]);
    useEffect(() => { killsPerUpgradeRef.current  = hordeSettings.killsPerUpgrade; }, [hordeSettings.killsPerUpgrade]);
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
    // ShooterCanvas. Der Hook besitzt das Pause/Gnadenfrist-Modell (advance
    // sperrt die Erkennung, dismiss startet die Grace-Frist) — siehe
    // useTutorialStep.ts.
    const isTouch = touchControls;
    const tutorialAimOriginRef = useRef<{ x: number; y: number } | null>(null);
    // Kill-Stand beim Betreten des 'obstacles'-Schritts — der Schritt gilt erst
    // als erledigt, wenn danach ein WEITERER Kill fällt (nicht schon einer aus
    // dem Schieß-Schritt).
    const obstaclesBaseScoreRef = useRef<number | null>(null);
    // Einmal-Flag: bei TUTORIAL_DNA_RAMP_KILLS werden die inerten Dummies auf
    // die aktivere Ramp-DNA umgestellt (siehe Loop).
    const dnaRampAppliedRef     = useRef(false);
    const {
        stepRef: tutorialStepRef,
        step: tutorialStep,
        bubbleClosed: tutorialBubbleClosed,
        advance: advanceStep,
        dismiss: dismissStep,
        graceOver: tutorialGraceOver,
        pausedRef: tutorialPausedRef,
        setPaused: setTutorialPaused,
    } = useTutorialStep<HordeTutorialStep>('move');

    // Tutorial-Abschluss = Übungsrunde + Horde-Explainer komplett — erst der
    // Explainer-Finish setzt das Flag, das den Lobby-Button aufs Auswahlfenster
    // umschaltet (wie ShooterCanvas' finishTutorial für Solo/Raidboss).
    const [hordeExplainerVisible, setHordeExplainerVisible] = useState(false);

    // Pause-Flag in den Hook-Ref spiegeln (der Loop liest nur Refs): solange ein
    // Coachmark offen ist, friert die Übungsrunde ein — Compi erscheint zentriert,
    // das Spiel wartet.
    const tutorialPaused = tutorial && uiPhase === 'playing' && !tutorialBubbleClosed;
    useEffect(() => { setTutorialPaused(tutorialPaused); }, [tutorialPaused, setTutorialPaused]);

    const finishTutorial = async () => {
        localStorage.setItem(HORDE_TUTORIAL_COMPLETED_KEY, '1');
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
            obstaclesBaseScoreRef.current = null;
            dnaRampAppliedRef.current = false;
            // advanceStep sperrt die Move-Erkennung bis der Hinweis weggeklickt ist.
            advanceStep('move');
        }
        // Base genes + movement loop + size/opacity are all jittered around the
        // player's Horde Starter DNA (±0.05 per gene — same bootstrap Solo Play's
        // initPopulation() uses), so none of it is a dead setting that always
        // gets overridden by pure randomness. Only the spawn-side weights have
        // no starter equivalent (see HORDE_STARTER_DNA_LENGTH) and stay fully
        // random every spawn, on purpose — not something to bias up front.
        //
        // Tutorial: KEIN Jitter — schon ±0.05 Movement-Speed lässt die inerten
        // Dummies langsam in Wände driften, wo die Stuck-Cull sie "einfach so"
        // sterben lässt (wirkt instabil). Exakte HORDE_TUTORIAL_DNA = wirklich
        // regungslose Zielscheiben.
        const pop: Population = {
            generation:  1,
            individuals: Array.from({ length: hordeSizeRef.current }, () => ({
                dna: [
                    ...(tutorial
                        ? [...starterDnaRef.current]
                        : starterDnaRef.current.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1)))),
                    ...Array.from({ length: 4 }, () => Math.random()), // spawn-side weights: top, right, bottom, left
                ],
                fitness: 0,
            })),
            bestFitness: 0,
            avgFitness:  0,
        };
        stateRef.current = makeInitialState(pop, mapRef.current);
        if (!tutorial) {
            hordeGameStore.state = stateRef.current;
            hordeGameStore.notify();
        }
        setUiPhase('playing');
        setUiGen(pop.individuals.length);
        setUiScore(0);
        setBestDna(null);
    };

    const chooseHordeMod = (mod: ModDefinition) => {
        runModsStore.addMod(mod.id);
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
            } else if (s.phase !== 'playing' || tutorialPausedRef.current) {
                // Nicht-spielende Phasen und offener Tutorial-Coachmark: Runde
                // eingefroren, nur den aktuellen Frame weiter rendern (kein
                // Update, keine Step-Erkennung).
                render(ctx, s, runModsStore.activeModIds.includes(SHIELD_MOD_ID) ? getHordeShieldAngle() : null);
            } else {
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
                    // Tutorial-Tode zählen nicht als "Last Run" — die
                    // Übungsrunde bleibt komplett außerhalb des echten Spiels.
                    if (!tutorial) hordeRunStore.record({ score: next.score, generation: next.generation });
                    // The run is over — nothing left to resume. "Last Run" above
                    // already has the score/generation via hordeRunStore.
                    hordeGameStore.state = null;
                    hordeGameStore.notify();
                } else if (modChoiceEnabledRef.current && Math.floor(next.score / killsPerUpgradeRef.current) > Math.floor(s.score / killsPerUpgradeRef.current)) {
                    // Kill-Meilenstein erreicht (Vampire-Survivors-Stil): Auswahl anbieten,
                    // falls noch nicht unlockte Mods übrig sind — sonst einfach weiterspielen.
                    const available = MOD_POOL.filter(m => isModOfferable(m, runModsStore.activeModIds));
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
                    // Erkennung läuft nur bei weggeklicktem Coachmark (sonst
                    // pausiert). Nach der Grace-Frist schaltet die erledigte
                    // Aktion SOFORT weiter (siehe useTutorialStep).
                    const graceOver = tutorialGraceOver();
                    if (graceOver && step === 'move' && (inp.up || inp.down || inp.left || inp.right)) {
                        advanceStep('aim');
                    } else if (graceOver && step === 'aim') {
                        if (isTouch) {
                            // Touch: der Ziel-Stick zielt UND feuert — eine Geste,
                            // also direkt weiter (aim & shoot zusammengefasst).
                            if (inp.shoot) advanceStep('obstacles');
                        } else if (tutorialAimOriginRef.current === null) {
                            tutorialAimOriginRef.current = { x: inp.mouseX, y: inp.mouseY };
                        } else {
                            const dx = inp.mouseX - tutorialAimOriginRef.current.x;
                            const dy = inp.mouseY - tutorialAimOriginRef.current.y;
                            if (dx * dx + dy * dy > 40 * 40) advanceStep('shoot');
                        }
                    } else if (graceOver && step === 'shoot' && inp.shoot) {
                        advanceStep('obstacles');
                    } else if (step === 'obstacles') {
                        // "Erledigt" = ein NEUER Kill, nachdem der Cover-Hinweis
                        // gelesen wurde — nicht ein Kill, der schon im Schieß-
                        // Schritt fiel. Basiswert beim ersten freigegebenen Frame
                        // merken, dann auf einen Anstieg warten.
                        if (obstaclesBaseScoreRef.current === null) {
                            obstaclesBaseScoreRef.current = next.score;
                        } else if (next.score > obstaclesBaseScoreRef.current) {
                            advanceStep('mods');
                        }
                    } else if (step === 'survive' && next.score >= TUTORIAL_EVOLVE_NOTE_KILLS) {
                        // Mitten im Survival: Compi merkt die Evolution an.
                        advanceStep('evolve');
                    } else if (step === 'evolve' && next.score >= TUTORIAL_SURVIVE_GOAL_KILLS) {
                        // Ziel erreicht → Abschluss.
                        advanceStep('done');
                    }
                    // 'mods' → das Overlay öffnet der Button der Powerup-Bubble
                    // (openTutorialModChoice), 'done' der Button darunter.

                    // Ab TUTORIAL_DNA_RAMP_KILLS die inerten Dummies auf die
                    // aktivere Ramp-DNA (Default + mehr Aggression) umstellen —
                    // sowohl die lebenden Agenten (sofort sichtbar) als auch die
                    // Population-Slots (damit Respawns/Evolution damit weiterlaufen).
                    // Spawn-Side-Gewichte (letzte 4 Gene je Individuum) bleiben,
                    // nur der Starter-Teil wird ersetzt (siehe HORDE_TUTORIAL_RAMP_DNA).
                    if (!dnaRampAppliedRef.current && next.score >= TUTORIAL_DNA_RAMP_KILLS) {
                        dnaRampAppliedRef.current = true;
                        const applyRamp = (dna: DNA): DNA => [
                            ...HORDE_TUTORIAL_RAMP_DNA,
                            ...dna.slice(HORDE_TUTORIAL_RAMP_DNA.length),
                        ];
                        next = {
                            ...next,
                            agents: next.agents.map(a => ({ ...a, dna: applyRamp(a.dna) })),
                            population: {
                                ...next.population,
                                individuals: next.population.individuals.map(ind => ({
                                    ...ind,
                                    dna: applyRamp(ind.dna),
                                })),
                            },
                        };
                    }
                }

                stateRef.current = next;
                // Tutorial läuft nur im lokalen stateRef — nichts zu resumen.
                if (!tutorial && next.phase !== 'dead') hordeGameStore.state = next;
                render(ctx, next, activeModIds.includes(SHIELD_MOD_ID) ? getHordeShieldAngle() : null);
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

    // Tutorial: kein DNA-Panel — es poppte unvermittelt beim ersten Kill auf
    // und lenkt vom eigentlichen Gameplay-Lernen ab; die DNA erklärt danach
    // der Horde-Explainer. Compi übernimmt stattdessen die rechte Seite.
    // Touch (Mobile-Landscape): kein Platz neben dem Canvas.
    const showDnaPanel = !touchControls && !tutorial;

    // Coachmark schließen → Runde läuft weiter, Gnadenfrist beginnt (Hook).
    const dismissHordeStep = () => {
        // Aim-Bezugspunkt frisch ab dem nächsten Zielen erfassen.
        tutorialAimOriginRef.current = null;
        dismissStep();
    };

    // 'mods'-Schritt: der Button öffnet direkt die (selbst modale) Powerup-Auswahl
    // und schaltet auf den Survival-Schritt weiter — nach der Wahl (chooseHordeMod
    // setzt phase='playing') erscheint die 'survive'-Bubble.
    const openTutorialModChoice = () => {
        const available = MOD_POOL.filter(m => isModOfferable(m, runModsStore.activeModIds));
        const shuffled  = [...available].sort(() => Math.random() - 0.5);
        setPendingModChoices(shuffled.slice(0, Math.min(MOD_CHOICE_COUNT, available.length)));
        setUiPhase('choosing');
        if (stateRef.current) stateRef.current = { ...stateRef.current, phase: 'choosing' };
        advanceStep('survive');
    };

    // Zentrierter, blockierender Coachmark je Schritt (Text geräteabhängig).
    // Der Button-Klick ist zugleich das onClose der Bubble (außer 'done', das
    // sich nicht wegklicken lässt) — eine Stelle für beide Entscheidungen.
    const hordeStepContent = HORDE_STEP_CONTENT[isTouch ? 'touch' : 'desktop'];
    const hordeStepAction = (() => {
        switch (tutorialStep) {
            case 'done':    return { label: 'Learn the Evolution →', onClick: () => setHordeExplainerVisible(true), variant: 'primary' as const };
            case 'mods':    return { label: 'Choose a powerup →',    onClick: openTutorialModChoice,               variant: 'primary' as const };
            case 'survive': return { label: "Let's go →",            onClick: dismissHordeStep,                    variant: 'primary' as const };
            case 'evolve':  return { label: 'Keep going',            onClick: dismissHordeStep,                    variant: 'primary' as const };
            default:        return { label: "Got it — let's try",    onClick: dismissHordeStep,                    variant: 'primary' as const };
        }
    })();

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
        {/* Mirrors the DNA panel's width on the other side so the canvas itself
            stays centered instead of being pushed left by the panel. */}
        {showDnaPanel && <div style={{ width: PANEL_W, flexShrink: 0 }} />}
        <div className="arena-frame" style={{
            width:      ARENA.WIDTH * scale,
            height:     ARENA.HEIGHT * scale,
            position:   'relative',
            flexShrink: 0,
        }}>
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
                                    {mod.repeatable && (
                                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: HC }}>
                                            {stackOfferLabel(runModsStore.activeModIds, mod.id)}
                                        </span>
                                    )}
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
                        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <button style={BTN} onClick={startGame}>Try Again →</button>
                            {/* Tutorial-Tod ist kein Sackgassen-Zustand: statt es erneut
                              * schaffen zu müssen, darf man direkt zum technischen Teil
                              * (Horde-Explainer) weitergehen. */}
                            {tutorial && (
                                <button style={BTN} onClick={() => setHordeExplainerVisible(true)}>
                                    Continue to tutorial →
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Portalled: der Wrapper oben hat `transform: scale(...)` und
                  * wäre sonst der Containing Block — Compi klebte mitten auf
                  * dem Canvas statt rechts daneben im echten Viewport (gleiche
                  * Fix-Klasse wie ShooterCanvas' tutorialCoachmark). */}
                {tutorial && uiPhase === 'playing' && !tutorialBubbleClosed && createPortal(
                    <CompiBubble
                        blocking
                        title={hordeStepContent[tutorialStep].title}
                        body={hordeStepContent[tutorialStep].body}
                        actions={[hordeStepAction]}
                        onClose={tutorialStep === 'done' ? undefined : hordeStepAction.onClick}
                    />,
                    document.body,
                )}

                {/* Fullscreen-Takeover wie ShooterCanvas' Explainer: portalled,
                  * weil der Wrapper oben `transform: scale(...)` hat und fixe
                  * Positionierung sonst im Canvas-Kasten gefangen wäre. */}
                {tutorial && hordeExplainerVisible && createPortal(
                    <div className="explainer-takeover">
                        <button className="btn btn--ghost btn--sm explainer-takeover__back" onClick={finishTutorial}>
                            ← Back to Lobby
                        </button>
                        <TutorialHordeExplainer
                            onFinish={finishTutorial}
                            finishLabel="Finish Tutorial → Lobby"
                        />
                    </div>,
                    document.body,
                )}
            </div>
        </div>
        {showDnaPanel && <HordeDnaPanel bestDna={bestDna} height={ARENA.HEIGHT * scale} />}
        </div>
    );
}
