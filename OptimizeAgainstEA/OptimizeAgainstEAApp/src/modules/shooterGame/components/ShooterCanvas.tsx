import { useRef, useCallback, useState, useEffect, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    ARENA,
    GAME_CONFIG,
    DNA_LENGTH,
    DNA_NAMES,
    TUTORIAL_DNA,
    TUTORIAL_COMPLETED_KEY,
    RAIDBOSS_TUTORIAL_COMPLETED_KEY,
    type GameState,
    type GamePhase,
    type InputState,
    type PlayerGhost,
    type AgentGhostFrame,
    type PlayerGhostFrame,
    type Population,
    type CrossoverExample,
} from '../shooter.types';
import { CompiBubble } from '../../../components/hints';
import { TutorialEvolutionExplainer } from './tutorialEvolutionContent';
import { TutorialRaidbossExplainer } from './tutorialRaidbossContent';
import { useTutorialStep } from '../hooks/useTutorialStep';
import { makeInitialGameState } from '../game/makeGameState';

import { evolve, getNextAgent } from '../game/ga/evolution';
import type { EvolutionWorkerIn, EvolutionWorkerOut } from '../game/ga/evolution.worker';
import { initPopulation } from '../game/ga/population';
import { consumePendingSlot, submitRaidbossFitness, claimRaidbossSlot, setRaidbossActive } from '../game/raidbossStore';
import type { RaidbossSlot } from '../game/raidbossStore';
import { useInput }          from '../hooks/useInput';
import { useTouchControls } from '../hooks/useTouchControls';
import { useGameLoop }       from '../hooks/useGameLoop';
import { update, resetGameLoop } from '../game/core/gameLoop';
import { renderer }          from '../game/core/renderer';
import { calculateFitness, calculateRaidbossFitness } from '../game/ga/fitness';
import { gameStore }         from '../game/gameStore';
import { analyticsStore }    from '../game/analyticsStore';
import { applyMods, MOD_POOL, isModOfferable, stackOfferLabel, type ModDefinition } from '../mods/modTypes';
import { runModsStore }      from '../mods/runModsStore';
import { useSettings }       from '../../../context/SettingsContext.tsx';
import type { ShooterSettings } from '../../../context/SettingsContext.tsx';
import styles                from './ShooterCanvas.module.css';

// ---- Crossover Visualization ----

const COL_A = '#60a5fa';
const COL_B = '#f97316';

// ---- Tug of War Bar ----

const BAR_HEIGHT = 44;

// modProgress: null blendet den Balken aus (Raidboss); sonst 0–1, Fortschritt
// zur nächsten Mod-Auswahl (alle ShooterSettings.modChoiceInterval Runden) — läuft als
// dünner Akzentstreifen am unteren Rand der Score-Leiste selbst mit, statt als
// eigene zusätzliche Zeile.
function TugOfWarBar({ score, threshold, modProgress }: { score: number; threshold: number; modProgress: number | null }) {
    const pct         = (score / threshold) * 50 + 50; // 0–100 %
    const playerWins  = score > 0;
    const fillWidth   = Math.abs(score / threshold) * 50;

    return (
        <div className={styles.tugBar}>
            <span className={styles.tugLabelEA}>EA</span>
            <div className={styles.tugTrack}>
                {score !== 0 && (
                    <div
                        className={styles.tugFill}
                        style={{
                            left:       playerWins ? '50%' : `${50 - fillWidth}%`,
                            width:      `${fillWidth}%`,
                            background: playerWins ? '#60a5fa' : '#f97316',
                        }}
                    />
                )}
                <div className={styles.tugCenter} />
                <div className={styles.tugKnot} style={{ left: `${pct}%` }} />
            </div>
            <span className={styles.tugLabelPlayer}>YOU</span>
            {modProgress !== null && (
                <div className={styles.tugModTrack} title="Progress to next mod choice">
                    <div className={styles.tugModFill} style={{ width: `${modProgress * 100}%` }} />
                </div>
            )}
        </div>
    );
}

// ---- Raidboss-feste Spielkonfiguration ----
// Unabhängig von den Spielereinstellungen, damit Fitness-Werte verschiedener Spieler vergleichbar sind
const RAIDBOSS_ROUND_DURATION = 30;
const RAIDBOSS_TUG_THRESHOLD  = 15;

// ---- Tutorial-feste Spielkonfiguration ----
// Einzige Runde, keine Evolution danach — läuft etwas länger als eine normale
// Runde, damit genug Zeit für alle drei Schritte (Bewegen/Zielen/Schießen) bleibt.
const TUTORIAL_ROUND_DURATION = 40;

type TutorialStep = 'move' | 'aim' | 'shoot' | 'done';

// Coachmark-Texte je Eingabegerät. Auf Touch sind Zielen und Schießen dieselbe
// Geste (der rechte Stick zielt UND feuert, siehe MobileAimZone) — deshalb dort
// nur ein zusammengefasster "Aim & shoot"-Schritt statt getrennt aim/shoot.
// Modul-Konstanten (kein Factory-Aufruf pro Render).
const TUTORIAL_STEP_CONTENT: Record<'touch' | 'desktop', Record<TutorialStep, { title: string; body: string }>> = {
    touch: {
        move:  { title: 'Step 1 — Move',        body: 'Use the left stick to move around the arena.' },
        aim:   { title: 'Step 2 — Aim & shoot', body: 'Use the right stick to aim — it fires on its own while you hold it. Give it a go.' },
        // Wird auf Touch nie erreicht (aim → done direkt), muss aber im
        // Record stehen.
        shoot: { title: 'Step 2 — Aim & shoot', body: 'Use the right stick to aim — it fires on its own while you hold it.' },
        done:  { title: "You've got it!",       body: "Take out a few dummies, then let the round finish — we'll show you what happens next." },
    },
    desktop: {
        move:  { title: 'Step 1 — Move',  body: 'Use WASD or the arrow keys to move around the arena.' },
        aim:   { title: 'Step 2 — Aim',   body: 'Move your mouse — your reticle follows it wherever it goes.' },
        shoot: { title: 'Step 3 — Shoot', body: 'Left-click or press Space to fire at the dummy.' },
        done:  { title: "You've got it!", body: "Land a few hits on the dummy, then let the round finish — we'll show you what happens next." },
    },
};

// Fires once, on the first hit landed or taken — see scoreCoachmarkShownRef.
const TUTORIAL_SCORE_CONTENT = {
    title: 'The score bar',
    body:  "See the bar at the top? Hits you land push it toward you (blue); hits you take push it toward the EA (orange). Push it all the way to your side to win the round.",
};

// Shown once the practice round ends, pointing the player at the explainer
// button rather than leaving them to guess what to click next. The raidboss
// variant leads into the community-population explainer instead of the DNA one.
const TUTORIAL_ROUND_END_CONTENT = {
    solo: {
        title: 'Round complete!',
        body: "That's it for the practice round. Next, let's break down what those DNA numbers actually mean — hit the button below.",
    },
    raidboss: {
        title: 'Round complete!',
        body: "That's it for the practice round — the controls are exactly the same against the boss. Next, let's see who that boss actually is — hit the button below.",
    },
} as const;

// ---- Tutorial: DNA-meaning + "how the EA evolves" explainer ----
// The practice round is a single round with no real population, so there's
// nothing to actually evolve — this walks through the shooter's DNA genes
// (grounded in the dummy the player just fought) and then a mocked,
// illustrative Selection -> Crossover -> Mutation story, built on the same
// shared ExplainerFlow used by the Dashboard's "EA Explained" tab. See
// tutorialEvolutionContent.tsx.

// Wie viele Mods pro Auswahl-Overlay angeboten werden. Das Intervall selbst
// (alle N Runden) ist konfigurierbar via ShooterSettings.modChoiceInterval —
// siehe difficulty presets in ShooterLobbyPage.tsx (Easy 4 / Medium 5 / Hard 6).
const MOD_CHOICE_COUNT = 3;

// ---- Komponente ----

interface ShooterCanvasProps {
    scale?:            number;
    externalInputRef?: RefObject<InputState>;           // von ShooterGamePage; wenn gesetzt → Zone-Touch-Modus
    leaveHandlerRef?:  RefObject<(() => Promise<void>) | undefined>;  // ShooterGamePage registriert sich hier für sauberes Verlassen
    tutorial?:         boolean;  // Practice round: passive Zielscheibe statt echter GA-Gegner, einzige Runde
    // Woher die Übungsrunde gestartet wurde: steuert nur, welcher Explainer am
    // Rundenende kommt und in welche Lobby es zurückgeht — das Gameplay der
    // Übungsrunde selbst ist identisch.
    tutorialMode?:     'solo' | 'raidboss';
}

export const ShooterCanvas = ({ scale = 1, externalInputRef, leaveHandlerRef, tutorial = false, tutorialMode = 'solo' }: ShooterCanvasProps) => {
    const { eaSettings, shooterSettings } = useSettings();
    const navigate = useNavigate();
    // Zone-Touch-Steuerung aktiv (Mobile-Landscape) → externalInputRef gesetzt.
    // Steuert die geräteabhängigen Tutorial-Texte und den zusammengefassten
    // Aim-&-Shoot-Schritt.
    const isTouch = externalInputRef != null;

    const canvasRef            = useRef<HTMLCanvasElement>(null);
    const nullCanvasRef        = useRef<HTMLCanvasElement | null>(null);  // immer null → deaktiviert Canvas-Touch
    const gameStateRef         = useRef<GameState | null>(null);
    const agentFramesRef       = useRef<AgentGhostFrame[]>([]);
    const playerFramesRef      = useRef<PlayerGhostFrame[]>([]);
    const matchScoreRef        = useRef(0);
    const prevHitsRef          = useRef({ landed: 0, received: 0 });
    const analyticsLoggedRef   = useRef(false);
    const hallOfFameGhostRef   = useRef<PlayerGhost | null>(null);
    const hallOfFameHitsRef    = useRef<number>(-1);
    const evolutionWorkerRef   = useRef<Worker | null>(null);
    const pendingRoundDataRef  = useRef<{
        nextRound:        number;
        crossoverExample: CrossoverExample | null;
        overrideDna:      number[] | null;
        settings:         typeof shooterSettings;
    } | null>(null);
    const _internalInputRef     = useInput();
    const inputRef              = externalInputRef ?? _internalInputRef;
    const shooterSettingsRef    = useRef(shooterSettings);
    // Wenn externe Input-Refs (Zone-Touch) aktiv: Canvas-Touch deaktivieren
    const touchCanvasRef       = externalInputRef ? nullCanvasRef : canvasRef;
    const touchVisualRef       = useTouchControls(inputRef, touchCanvasRef);

    const [matchScore, setMatchScore]                     = useState(0);
    const [isRaidbossRound, setIsRaidbossRound]           = useState(false);
    const [trainNextLoading, setTrainNextLoading]         = useState(false);
    const [revealDna, setRevealDna]                       = useState<number[] | null>(null);
    const [displayedRevealDna, setDisplayedRevealDna]     = useState<number[]>([]);
    const [revealGeneration, setRevealGeneration]         = useState<number | null>(null);
    const [revealCrossoverExample, setRevealCrossoverExample] = useState<CrossoverExample | null>(null);
    // Tutorial's DNA/evolution explainer — decoupled from `revealDna` (which
    // stays purely for real gameplay's DNA reveal) since the tutorial's
    // content is a fixed step list, not an animated bar reveal.
    const [tutorialEvolutionVisible, setTutorialEvolutionVisible] = useState(false);
    const [roundEndBubbleClosed, setRoundEndBubbleClosed]  = useState(false);
    // Tug-of-war score coachmark — fires once on the first hit either way
    // (landing one is far more likely than the near-passive dummy landing
    // one on the player), explains both directions so it teaches the whole
    // mechanic regardless of which happened first. scoreCoachmarkShownRef
    // gates the one-shot trigger inside onUpdate (a memoized callback that
    // never sees fresh state — see tutorialStepRef for the same pattern).
    const scoreCoachmarkShownRef = useRef(false);
    const [showScoreCoachmark, setShowScoreCoachmark]     = useState(false);
    const [scoreCoachmarkClosed, setScoreCoachmarkClosed] = useState(false);
    const [pendingModChoices, setPendingModChoices]       = useState<ModDefinition[] | null>(null);
    const raidbossSlotRef    = useRef<RaidbossSlot | null>(null);
    const raidbossInfoRef    = useRef<{ generation: number; index: number; total: number } | null>(null);
    const pendingSubmitRef   = useRef<Promise<void>>(Promise.resolve());
    const pendingNewStateRef = useRef<GameState | null>(null);
    const revealAnimTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

    // Im Raidboss-Modus feste Spielwerte verwenden damit Fitness-Vergleiche zwischen Spielern fair sind
    const gameShooterSettings: ShooterSettings = isRaidbossRound
        ? {
            ...shooterSettings,
            roundDuration:   RAIDBOSS_ROUND_DURATION,
            tugWinThreshold: RAIDBOSS_TUG_THRESHOLD,
            playerStats: {
                bulletSpeed:   GAME_CONFIG.BULLET_SPEED,
                moveSpeed:     GAME_CONFIG.PLAYER_SPEED,
                shootCooldown: GAME_CONFIG.SHOOT_COOLDOWN,
            },
        }
        : tutorial
            ? { ...shooterSettings, roundDuration: TUTORIAL_ROUND_DURATION, modChoiceEnabled: false }
            : shooterSettings;

    // Tutorial step coachmarks — advanced live from `onUpdate` (refs, since that
    // callback is memoized and must not go stale), mirrored into state to
    // render. Der Hook besitzt das Pause/Gnadenfrist-Modell (advance sperrt die
    // Erkennung, dismiss startet die Grace-Frist) — siehe useTutorialStep.ts.
    const tutorialAimOriginRef = useRef<{ x: number; y: number } | null>(null);
    const {
        stepRef: tutorialStepRef,
        step: tutorialStep,
        bubbleClosed: tutorialBubbleClosed,
        setBubbleClosed: setTutorialBubbleClosed,
        advance: advanceStep,
        dismiss: dismissStep,
        graceOver: tutorialGraceOver,
        pausedRef: tutorialPausedRef,
        setPaused: setTutorialPaused,
    } = useTutorialStep<TutorialStep>('move');

    useEffect(() => {
        const slot = consumePendingSlot();
        if (slot) {
            raidbossSlotRef.current = slot;
            setIsRaidbossRound(true);
            setRaidbossActive(true);
            raidbossInfoRef.current = {
                generation: slot.doc.generation,
                index:      slot.index + 1,
                total:      slot.doc.populationSize,
            };
            // Idle-DNA auf Slot-DNA setzen, damit DNADisplay beim Rundenstart keine Änderung zeigt
            const current = gameStateRef.current!;
            const withSlotDna = { ...current, agent: { ...current.agent, dna: slot.dna } };
            gameStateRef.current = withSlotDna;
            gameStore.state      = withSlotDna;
            gameStore.notify();
        }
        return () => { setRaidbossActive(false); };
    }, []);

    useEffect(() => {
        shooterSettingsRef.current = gameShooterSettings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isRaidbossRound, shooterSettings]);

    useEffect(() => {
        return () => {
            evolutionWorkerRef.current?.terminate();

            // Raidboss-Fitness beim Verlassen einreichen falls noch nicht geschehen.
            // Deckt alle Exit-Pfade ab (Overlay-Button, Mobile-Nav-Button, Browser-Back).
            const slot  = raidbossSlotRef.current;
            const state = gameStateRef.current;
            if (slot && state && state.roundNumber > 0) {
                const fitness = calculateRaidbossFitness(
                    state.agent.stats,
                    shooterSettingsRef.current.roundDuration,
                );
                submitRaidbossFitness(slot.index, fitness, slot.doc).catch(console.error);
                setRaidbossActive(false);
            }
        };
    }, []);

    // Wird aufgerufen sobald die Evolution (Worker oder sync) eine neue Population hat
    const completeRound = useCallback((evolvedPopulation: Population) => {
        const pending = pendingRoundDataRef.current;
        if (!pending) return;
        pendingRoundDataRef.current = null;

        const nextDna = pending.overrideDna ?? getNextAgent(evolvedPopulation);
        const base    = makeInitialGameState(pending.settings);
        const newState: GameState = {
            ...base,
            phase:            'playing',
            roundNumber:      pending.nextRound,
            population:       evolvedPopulation,
            lastPlayerFrame:  null,
            lastAgentFrame:   null,
            crossoverExample: pending.crossoverExample,
            agent: { ...base.agent, dna: nextDna },
        };

        playerFramesRef.current = [];
        agentFramesRef.current  = [];

        // Kein DNA-Reveal für Runde 1 oder Raidboss (DNA hat sich nicht durch Evolution geändert)
        if (pending.overrideDna !== null) {
            gameStateRef.current = newState;
            gameStore.state      = newState;
            gameStore.notify();
            setPhase('playing');
            return;
        }

        // DNA-Reveal: neue evolved DNA animiert zeigen, bevor nächste Runde startet
        const oldDna = gameStateRef.current?.agent.dna ?? nextDna;
        setDisplayedRevealDna([...oldDna]);

        // gameStore schon jetzt mit neuer DNA updaten → DNADisplay rechts aktualisiert sich sofort
        const revealState: GameState = { ...newState, phase: gameStateRef.current?.phase ?? 'roundEnd' };
        gameStateRef.current = revealState;
        gameStore.state      = revealState;
        gameStore.notify();

        pendingNewStateRef.current = newState;
        setRevealGeneration(evolvedPopulation.generation);
        setRevealCrossoverExample(pending.crossoverExample);
        setRevealDna([...nextDna]);
    }, []);

    useEffect(() => {
        if (!revealDna) return;

        revealAnimTimersRef.current.forEach(clearTimeout);
        revealAnimTimersRef.current = [];

        revealDna.forEach((target, i) => {
            const t = setTimeout(() => {
                setDisplayedRevealDna(prev => {
                    const next = [...prev];
                    next[i] = target;
                    return next;
                });
            }, Math.floor(i / 2) * 200 + 150);
            revealAnimTimersRef.current.push(t);
        });

        return () => {
            revealAnimTimersRef.current.forEach(clearTimeout);
            revealAnimTimersRef.current = [];
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealDna]);

    const saved = gameStore.state;
    const restoredPhase: GamePhase =
        saved?.roundNumber > 0
            ? (saved.phase === 'playing' ? 'roundEnd' : saved.phase)
            : 'idle';
    const [phase, setPhase] = useState<GamePhase>(restoredPhase);

    // Lazy initialisieren – vorherigen State wiederherstellen falls vorhanden
    if (!gameStateRef.current) {
        const state =
            saved?.roundNumber > 0
                ? { ...saved, phase: restoredPhase }
                : makeInitialGameState(gameShooterSettings);
        gameStateRef.current = state;
        gameStore.state      = state;
    }

    const pushRoundAnalytics = useCallback((roundState: GameState) => {
        // Übungsrunde taucht nicht in /Analytics auf — sie ist kein echter Run.
        if (tutorial) return;
        if (analyticsLoggedRef.current || roundState.roundNumber === 0) return;
        analyticsLoggedRef.current = true;
        const s = roundState.agent.stats;
        analyticsStore.push({
            round:        roundState.roundNumber,
            hitsLanded:   s.hitsLanded,
            hitsReceived: s.hitsReceived,
            bulletsFired: s.bulletsFired,
            accuracy:     s.bulletsFired > 0 ? s.hitsLanded / s.bulletsFired : 0,
            dodged:       s.dodgedBullets,
            fitness:      calculateFitness(s),
            generation:   roundState.population?.generation ?? 1,
            bestFitness:  roundState.population?.bestFitness ?? 0,
            playerFrames: playerFramesRef.current,
            agentFrames:  agentFramesRef.current,
            agentDna:     roundState.agent.dna,
        }, eaSettings.maxAnalyticsRounds);
    }, [eaSettings.maxAnalyticsRounds]);

    // Raidboss-Fitness beim Rundenende einreichen (fire-and-forget, idempotent via slot=null).
    // Slot wird sofort auf null gesetzt → kein Doppel-Submit egal welcher Exit-Pfad folgt.
    const submitRaidbossOnRoundEnd = (endState: GameState) => {
        const slot = raidbossSlotRef.current;
        if (!slot || endState.roundNumber <= 0) return;
        const fitness = calculateRaidbossFitness(
            endState.agent.stats,
            shooterSettingsRef.current.roundDuration,
        );
        // Speichert die Promise damit submitCurrentRaidbossFitness sie awaiten kann
        pendingSubmitRef.current = submitRaidbossFitness(slot.index, fitness, slot.doc)
            .catch(console.error)
            .then(() => undefined);
        raidbossSlotRef.current = null;  // verhindert Doppel-Submit
    };

    // Tutorial-Coachmarks pausieren die Runde: solange ein zentrierter Hinweis
    // (Move/Aim/Shoot/Score) offen ist, friert das Spiel ein — so verdeckt Compi
    // nie Spielfeld oder Controls, sondern erscheint mittig, das Spiel wartet.
    // Muss exakt der Sichtbarkeitsbedingung von `tutorialCoachmark` (unten)
    // entsprechen. In den Hook-Ref gespiegelt, weil onUpdate memoisiert ist und
    // sonst nur den Wert vom ersten Render sähe.
    const tutorialPaused =
        tutorial && phase === 'playing' &&
        (!tutorialBubbleClosed || (showScoreCoachmark && !scoreCoachmarkClosed));
    useEffect(() => { setTutorialPaused(tutorialPaused); }, [tutorialPaused, setTutorialPaused]);

    // onUpdate: Spiellogik – gibt neuen State zurück
    const onUpdate = useCallback((
        state: GameState,
        dt:    number,
        input: InputState,
    ): GameState => {
        // Pausiert: Physik + Step-Erkennung aus, State unverändert zurückgeben.
        // Der Loop rendert den eingefrorenen Frame weiter (kein leeres Canvas
        // hinter dem Backdrop), erst nach dem Schließen des Hinweises geht's
        // weiter — dann erkennt onUpdate die Bewegung/das Zielen/den Schuss.
        if (tutorialPausedRef.current) return state;

        // Mods gelten nur außerhalb von Raidboss-Runden (feste Stats für faire Fitness-Vergleiche)
        const effectivePlayerStats = isRaidbossRound
            ? gameShooterSettings.playerStats
            : applyMods(gameShooterSettings.playerStats, runModsStore.activeModIds);
        const activeModIds = isRaidbossRound ? [] : runModsStore.activeModIds;
        const next = update(state, dt, input, effectivePlayerStats, activeModIds);

        if (tutorial && state.phase === 'playing') {
            // Gnadenfrist: erst einen kurzen Moment spielen lassen, bevor die
            // Aktion den Schritt weiterschaltet — inkl. der Aim-Origin-Erfassung,
            // damit eine Mausbewegung während der Frist nicht schon zählt.
            // Nur wenn der aktuelle Schritt-Coachmark schon weggeklickt ist,
            // läuft überhaupt Erkennung (sonst ist die Runde pausiert). Nach der
            // Grace-Frist schaltet die erledigte Aktion SOFORT und deterministisch
            // zum nächsten Schritt weiter.
            if (tutorialGraceOver()) {
                const step = tutorialStepRef.current;
                if (step === 'move' && (input.up || input.down || input.left || input.right)) {
                    advanceStep('aim');
                } else if (step === 'aim') {
                    if (isTouch) {
                        // Touch: der Ziel-Stick zielt UND feuert — eine Geste
                        // erledigt Zielen und Schießen, also direkt zu 'done'.
                        if (input.shoot) advanceStep('done');
                    } else if (tutorialAimOriginRef.current === null) {
                        tutorialAimOriginRef.current = { x: input.mouseX, y: input.mouseY };
                    } else {
                        const dx = input.mouseX - tutorialAimOriginRef.current.x;
                        const dy = input.mouseY - tutorialAimOriginRef.current.y;
                        if (dx * dx + dy * dy > 40 * 40) advanceStep('shoot');
                    }
                } else if (step === 'shoot' && input.shoot) {
                    advanceStep('done');
                }
            }
        }

        if (next.lastPlayerFrame) playerFramesRef.current.push(next.lastPlayerFrame);
        if (next.lastAgentFrame)  agentFramesRef.current.push(next.lastAgentFrame);

        if (next.phase !== state.phase) {
            setPhase(next.phase);
            if (next.phase === 'roundEnd') {
                pushRoundAnalytics(next);
                submitRaidbossOnRoundEnd(next);
            }
        }

        // Tug of war: live hit tracking
        const landedDelta   = next.agent.stats.hitsLanded   - prevHitsRef.current.landed;
        const receivedDelta = next.agent.stats.hitsReceived  - prevHitsRef.current.received;
        if (landedDelta > 0 || receivedDelta > 0) {
            prevHitsRef.current = { landed: next.agent.stats.hitsLanded, received: next.agent.stats.hitsReceived };
            const threshold = gameShooterSettings.tugWinThreshold;
            const newScore = Math.max(-threshold,
                Math.min(threshold, matchScoreRef.current + receivedDelta - landedDelta));
            matchScoreRef.current = newScore;
            setMatchScore(newScore);
            // Score-Bar-Coachmark erst NACH dem 'done'-Schritt: sonst kann ein
            // Treffer, der schon während move/aim/shoot fällt, ihn vor "You've
            // got it" auslösen. Live-Check auf den aktuellen Schritt (kein
            // Latch) — er feuert, sobald im freien Spiel nach 'done' der erste
            // Treffer fällt, danach nie wieder (scoreCoachmarkShownRef).
            if (tutorial && tutorialStepRef.current === 'done' && !scoreCoachmarkShownRef.current) {
                scoreCoachmarkShownRef.current = true;
                setShowScoreCoachmark(true);
            }
            // Getting close to actually winning → the "You've got it" step has
            // clearly served its purpose; move on to the score-bar coachmark
            // automatically instead of making the player dismiss it by hand.
            if (tutorial && tutorialStepRef.current === 'done' && newScore >= Math.max(1, threshold - 5)) {
                setTutorialBubbleClosed(true);
            }
            if (Math.abs(newScore) >= threshold) {
                setPhase('roundEnd');
                pushRoundAnalytics(next);
                submitRaidbossOnRoundEnd(next);
            }
        }

        gameStore.state = next;
        return next;
    }, []);

    // onRender: Canvas zeichnen
    const onRender = useCallback((state: GameState) => {
        // Touch-Overlay nur für Canvas-basierte Steuerung (nicht im Zone-Modus)
        const touch = (!externalInputRef && state.phase === 'playing')
            ? touchVisualRef.current
            : null;
        // Ziellaser im Mobile-Zone-Modus (externalInputRef gesetzt)
        const aimLaser = (externalInputRef && state.phase === 'playing')
            ? { mouseX: externalInputRef.current.mouseX, mouseY: externalInputRef.current.mouseY }
            : null;
        renderer.render(
            canvasRef.current, state, raidbossInfoRef.current ?? undefined, touch, aimLaser,
            // Raidboss-Übungsrunde: Dummy in Boss-Optik, aber ohne Raidboss-HUD.
            tutorial && tutorialMode === 'raidboss',
        );
    }, [externalInputRef, tutorial, tutorialMode]);

    useGameLoop({
        gameState:  gameStateRef as RefObject<GameState>,
        inputState: inputRef,
        onUpdate,
        onRender,
        isRunning: phase === 'playing',
    });

    const submitCurrentRaidbossFitness = (): Promise<void> => {
        const slot  = raidbossSlotRef.current;
        const state = gameStateRef.current;
        if (slot && state && state.roundNumber > 0) {
            const fitness = calculateRaidbossFitness(state.agent.stats, gameShooterSettings.roundDuration);
            const p = submitRaidbossFitness(slot.index, fitness, slot.doc)
                .catch(console.error)
                .then(() => undefined);
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setRaidbossActive(false);
            pendingSubmitRef.current = p;
            return p;
        }
        // Slot bereits durch submitRaidbossOnRoundEnd geleert → auf laufende Transaktion warten
        return pendingSubmitRef.current;
    };

    // leaveHandlerRef immer aktuell halten damit ShooterGamePage awaiten kann
    if (leaveHandlerRef) leaveHandlerRef.current = submitCurrentRaidbossFitness;

    // Tutorial ist eine einzige Runde ohne Evolution/Fortsetzung — Store leeren
    // damit ein späteres echtes "Play" nicht in dieser Runde landet.
    const finishTutorial = async () => {
        // Ab jetzt bietet der Tutorial-Button in der jeweiligen Lobby das
        // Auswahlfenster (Übungsrunde / Explainer einzeln) statt des kompletten
        // Durchlaufs an — pro Modus ein eigenes Flag.
        localStorage.setItem(tutorialMode === 'raidboss' ? RAIDBOSS_TUTORIAL_COMPLETED_KEY : TUTORIAL_COMPLETED_KEY, '1');
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        navigate('/lobby/shooter', { state: { mode: tutorialMode === 'raidboss' ? 'raidboss' : 'normal' } });
    };

    const showTutorialEvolutionExplainer = () => setTutorialEvolutionVisible(true);

    const handleTrainNext = async () => {
        if (trainNextLoading) return;
        setTrainNextLoading(true);

        try {
            await submitCurrentRaidbossFitness();
            await claimRaidbossSlot();
            const slot = consumePendingSlot();
            raidbossSlotRef.current = slot;
            raidbossInfoRef.current = slot
                ? { generation: slot.doc.generation, index: slot.index + 1, total: slot.doc.populationSize }
                : null;
            setIsRaidbossRound(!!slot);
            setRaidbossActive(!!slot);

            const baseReset  = makeInitialGameState(shooterSettings);
            const resetState = slot
                ? { ...baseReset, agent: { ...baseReset.agent, dna: slot.dna } }
                : baseReset;
            gameStateRef.current = resetState;
            gameStore.state      = resetState;
            gameStore.notify();
            matchScoreRef.current = 0;
            setMatchScore(0);
            setPhase('idle');
        } catch (err) {
            console.error('[Raidboss] Slot claim fehlgeschlagen:', err);
            // Fallback: normaler Modus
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setIsRaidbossRound(false);
        } finally {
            setTrainNextLoading(false);
        }
    };

    const startRound = () => {
        resetGameLoop();
        prevHitsRef.current   = { landed: 0, received: 0 };
        matchScoreRef.current = 0;
        setMatchScore(0);

        if (tutorial) {
            tutorialAimOriginRef.current = null;
            // advanceStep sperrt die Move-Erkennung, bis der Move-Hinweis
            // weggeklickt ist — sonst könnte ein gehaltener Stick sie im Frame
            // vor dem Pausieren schon auslösen.
            advanceStep('move');
        }

        const currentState = gameStateRef.current!;
        const nextRound    = currentState.roundNumber + 1;

        if (currentState.roundNumber === 0) {
            // Tutorial: Analytics des letzten echten Runs nicht wegwerfen —
            // die Übungsrunde loggt selbst auch nichts (siehe pushRoundAnalytics).
            if (!tutorial) analyticsStore.clear();
            runModsStore.reset();
        }
        analyticsLoggedRef.current = false;

        const population = currentState.population
            ?? initPopulation(shooterSettings.starterDna, eaSettings.populationSize);

        const crossoverExample: CrossoverExample | null =
            currentState.roundNumber > 0 && population.individuals.length >= 2
                ? {
                    parentA:     population.individuals[0].dna,
                    parentB:     population.individuals[1].dna,
                    type:        eaSettings.crossoverType,
                    geneOrigins: eaSettings.crossoverType === 'single-point'
                        ? (() => {
                            const point = Math.floor(Math.random() * (DNA_LENGTH - 1)) + 1;
                            return Array.from({ length: DNA_LENGTH }, (_, i) => i < point);
                        })()
                        : Array.from({ length: DNA_LENGTH }, () => Math.random() < 0.5),
                }
                : null;

        // Raidboss: Fitness einreichen und Slot leeren
        const slot = raidbossSlotRef.current;
        const useRaidbossDna = slot !== null && currentState.roundNumber === 0;
        if (slot && currentState.roundNumber > 0) {
            const raidbossFitness = calculateRaidbossFitness(currentState.agent.stats, gameShooterSettings.roundDuration);
            submitRaidbossFitness(slot.index, raidbossFitness, slot.doc).catch(console.error);
            raidbossSlotRef.current = null;
            raidbossInfoRef.current = null;
            setIsRaidbossRound(false);
            setRaidbossActive(false);
        }

        pendingRoundDataRef.current = {
            nextRound,
            crossoverExample,
            overrideDna: useRaidbossDna
                ? slot!.dna
                : currentState.roundNumber === 0
                    ? [...(tutorial ? TUTORIAL_DNA : shooterSettings.starterDna)]
                    : null,
            settings: gameShooterSettings,
        };

        // Runde 0 oder kein Presim → direkt synchron
        if (currentState.roundNumber === 0) {
            completeRound(population);
            return;
        }

        const realFitness = calculateFitness(currentState.agent.stats);

        if (eaSettings.presimGenerations === 0 || playerFramesRef.current.length === 0) {
            completeRound(evolve(population, realFitness, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.crossoverType, eaSettings.injectionDeviation));
            return;
        }

        // Schwere Arbeit → Web Worker
        const ghost: PlayerGhost = {
            frames:        playerFramesRef.current,
            roundDuration: gameShooterSettings.roundDuration,
        };

        const playerHitsThisRound = currentState.agent.stats.hitsReceived;
        if (playerHitsThisRound > hallOfFameHitsRef.current) {
            hallOfFameHitsRef.current  = playerHitsThisRound;
            hallOfFameGhostRef.current = ghost;
        }

        const hofGhost = eaSettings.useHallOfFame && hallOfFameGhostRef.current !== ghost
            ? hallOfFameGhostRef.current ?? undefined
            : undefined;

        setPhase('evolving');

        evolutionWorkerRef.current?.terminate();
        const worker = new Worker(
            new URL('../game/ga/evolution.worker.ts', import.meta.url),
            { type: 'module' },
        );
        worker.onmessage = (e: MessageEvent<EvolutionWorkerOut>) => {
            if (e.data.type === 'DONE') {
                completeRound(e.data.population);
            } else {
                console.error('[EvolutionWorker]', (e.data as { message: string }).message);
                // Fallback: synchron ohne Presim
                completeRound(evolve(population, realFitness, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.crossoverType, eaSettings.injectionDeviation));
            }
            worker.terminate();
            evolutionWorkerRef.current = null;
        };
        evolutionWorkerRef.current = worker;
        worker.postMessage({
            type: 'PRESIM',
            ghost,
            hofGhost,
            population,
            realFitness,
            generations:         eaSettings.presimGenerations,
            mutationRate:        eaSettings.mutationRate,
            mutationStrength:    eaSettings.mutationStrength,
            crossoverType:       eaSettings.crossoverType,
            injectionDeviation:  eaSettings.injectionDeviation,
        } satisfies EvolutionWorkerIn);
    };

    // Alle MOD_CHOICE_INTERVAL gespielten Runden (bewusst nicht Generationen —
    // presimGenerations lässt population.generation pro Runde um mehr als 1 springen,
    // wodurch Powerups viel zu oft und dicht getaktet kämen und nur noch ablenken):
    // 2-3 noch nicht aktive Mods als Bonus-Auswahl anbieten. Sonst direkt weiter zur
    // nächsten Runde. Alle Mods bleiben davon unabhängig jederzeit frei im Player-Tab
    // togglebar.
    const maybeOfferModChoice = () => {
        if (!gameShooterSettings.modChoiceEnabled) { startRound(); return; }
        const roundJustEnded = gameStateRef.current?.roundNumber ?? 0;
        const interval  = gameShooterSettings.modChoiceInterval;
        const available = MOD_POOL.filter(m => isModOfferable(m, runModsStore.activeModIds));
        if (roundJustEnded % interval !== 0 || available.length === 0) { startRound(); return; }
        const shuffled = [...available].sort(() => Math.random() - 0.5);
        setPendingModChoices(shuffled.slice(0, Math.min(MOD_CHOICE_COUNT, available.length)));
    };

    const chooseMod = (mod: ModDefinition) => {
        runModsStore.addMod(mod.id);
        setPendingModChoices(null);
        startRound();
    };

    const applyAndPlay = () => {
        const newState = pendingNewStateRef.current;
        if (!newState) return;
        pendingNewStateRef.current = null;
        setRevealDna(null);
        setRevealGeneration(null);
        setRevealCrossoverExample(null);
        gameStateRef.current = newState;
        gameStore.state      = newState;
        gameStore.notify();
        setPhase('playing');
    };

    // Only ever one Compi bubble on screen at a time — the score coachmark
    // waits its turn until the move/aim/shoot chain is dismissed, rather
    // than stacking on top of it.
    // Distinct keys: both branches are a CompiBubble at the same tree
    // position, so without them React reuses the mounted DOM node across the
    // swap — the old bubble visibly teleports bottom-right → top-right with
    // hard-swapped text instead of leaving and letting the new one pop in.
    // Closing a step bubble un-pauses the round and starts the grace window
    // (see useTutorialStep) so the next step doesn't fire on the very first
    // twitch of input.
    const dismissTutorialStep = () => {
        // Aim-Bezugspunkt erst nach dem Wegklicken frisch erfassen (siehe onUpdate),
        // damit ein vorher stehen gebliebener Origin nicht sofort 40px "Bewegung"
        // meldet.
        tutorialAimOriginRef.current = null;
        dismissStep();
    };

    const stepContent = TUTORIAL_STEP_CONTENT[isTouch ? 'touch' : 'desktop'];

    // Both coachmarks render `blocking`: a dimmed backdrop centers them in the
    // viewport and the round is frozen (see tutorialPaused) while they show —
    // so Compi never sits on top of the arena or the touch controls. Each step
    // gets a primary button because the player now must dismiss to un-pause and
    // then perform the action (which advances to the next step, re-pausing).
    const tutorialCoachmark = (tutorial && phase === 'playing')
        ? (!tutorialBubbleClosed ? (
            <CompiBubble
                key="tutorial-step"
                blocking
                title={stepContent[tutorialStep].title}
                body={stepContent[tutorialStep].body}
                actions={[{
                    label:   tutorialStep === 'done' ? 'Got it' : "Got it — let's try",
                    onClick: dismissTutorialStep,
                    variant: 'primary',
                }]}
                onClose={dismissTutorialStep}
            />
        ) : (showScoreCoachmark && !scoreCoachmarkClosed) ? (
            <CompiBubble
                key="score-coachmark"
                blocking
                title={TUTORIAL_SCORE_CONTENT.title}
                body={TUTORIAL_SCORE_CONTENT.body}
                actions={[{ label: 'Got it', onClick: () => setScoreCoachmarkClosed(true), variant: 'primary' }]}
                onClose={() => setScoreCoachmarkClosed(true)}
            />
        ) : null)
        : null;

    return (
        <div style={{
            width:    ARENA.WIDTH  * scale,
            height:   (ARENA.HEIGHT + BAR_HEIGHT) * scale,
            position: 'relative',
        }}>
            <div
                className={`${styles.wrapper} arena-frame`}
                style={{
                    transform:       `scale(${scale})`,
                    transformOrigin: 'top left',
                    position:        'absolute',
                    top:  0,
                    left: 0,
                }}
            >
                <TugOfWarBar
                    score={matchScore}
                    threshold={gameShooterSettings.tugWinThreshold}
                    modProgress={(isRaidbossRound || !gameShooterSettings.modChoiceEnabled) ? null : (((gameStateRef.current?.roundNumber ?? 0) - 1) % gameShooterSettings.modChoiceInterval + 1) / gameShooterSettings.modChoiceInterval}
                />

                <canvas
                    ref={canvasRef}
                    width={ARENA.WIDTH}
                    height={ARENA.HEIGHT}
                    className={styles.canvas}
                />

                {revealDna !== null ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>New DNA</h2>
                        <p className={styles.subtitle}>Generation {revealGeneration ?? '—'}</p>
                        <div style={{
                            display:       'flex',
                            flexDirection: 'column',
                            gap:           16,
                            width:         'min(560px, 90%)',
                        }}>
                            {DNA_NAMES.map((name, i) => {
                                const cx    = revealCrossoverExample;
                                const color = cx ? (cx.geneOrigins[i] ? COL_A : COL_B) : COL_B;
                                const val   = displayedRevealDna[i] ?? 0;
                                return (
                                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                            <span style={{
                                                fontFamily:    'var(--font-mono)',
                                                fontSize:      15,
                                                color:         'rgba(255,255,255,0.5)',
                                                textTransform: 'uppercase' as const,
                                                letterSpacing: '0.06em',
                                            }}>{name}</span>
                                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color }}>{val.toFixed(2)}</span>
                                        </div>
                                        <div style={{ height: 10, background: 'rgba(255,255,255,0.07)', borderRadius: 5, overflow: 'hidden' }}>
                                            <div style={{ width: `${val * 100}%`, height: '100%', background: color, borderRadius: 5, opacity: 0.75, transition: 'width 0.15s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button className="btn btn--primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={applyAndPlay}>
                            Next Round →
                        </button>
                    </div>
                ) : pendingModChoices !== null ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>Choose a Mod</h2>
                        <p className={styles.subtitle}>Stays active for the rest of this run</p>
                        <div className={styles.modChoiceGrid}>
                            {pendingModChoices.map(mod => (
                                <button key={mod.id} className={styles.modCard} onClick={() => chooseMod(mod)}>
                                    <span className={styles.modCardIcon}>{mod.icon}</span>
                                    <span className={styles.modCardName}>{mod.name}</span>
                                    <span className={styles.modCardDesc}>{mod.description}</span>
                                    {mod.repeatable && (
                                        <span style={{ marginTop: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--accent)' }}>
                                            {stackOfferLabel(runModsStore.activeModIds, mod.id)}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : phase === 'idle' ? (
                    <div className={styles.overlay}>
                        {tutorial ? (
                            <>
                                <h2 className={styles.title} style={{ color: '#34d399' }}>Tutorial</h2>
                                <p className={styles.subtitle}>Learn to move, aim and shoot — the dummy barely fights back.</p>
                                <p className={styles.subtitle}>WASD to move · Mouse to aim · Left-click to shoot</p>
                            </>
                        ) : isRaidbossRound && raidbossInfoRef.current ? (
                            <>
                                <h2 className={styles.title} style={{ color: '#a855f7' }}>Community Raidboss</h2>
                                <p className={styles.subtitle} style={{ color: 'rgba(168,85,247,0.7)' }}>
                                    Generation {raidbossInfoRef.current.generation} · Individual {raidbossInfoRef.current.index}/{raidbossInfoRef.current.total}
                                </p>
                                <p className={styles.subtitle}>WASD to move · Mouse to aim · Left-click to shoot</p>
                            </>
                        ) : (
                            <>
                                <h2 className={styles.title}>Shooter vs EA</h2>
                                <p className={styles.subtitle}>WASD to move · Mouse to aim · Left-click to shoot</p>
                            </>
                        )}
                        <button className="btn btn--primary btn--lg" onClick={() => startRound()}>
                            {tutorial ? 'Start Tutorial' : 'Start Round'}
                        </button>
                    </div>
                ) : phase === 'roundEnd' ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>Round Over</h2>
                        <div className={styles.roundStats}>
                            <div className={styles.roundStatSide}>
                                <span className={styles.roundStatLabel} style={{ color: '#f97316' }}>EA</span>
                                <span className={styles.roundStatCount} style={{ color: '#f97316' }}>
                                    {gameStateRef.current?.agent.stats.hitsLanded ?? 0}
                                </span>
                                <span className={styles.roundStatSub}>Hits</span>
                            </div>
                            <span className={styles.roundStatDivider}>:</span>
                            <div className={styles.roundStatSide}>
                                <span className={styles.roundStatLabel} style={{ color: '#60a5fa' }}>YOU</span>
                                <span className={styles.roundStatCount} style={{ color: '#60a5fa' }}>
                                    {gameStateRef.current?.agent.stats.hitsReceived ?? 0}
                                </span>
                                <span className={styles.roundStatSub}>Hits</span>
                            </div>
                        </div>

                        {tutorial && !roundEndBubbleClosed && (
                            <CompiBubble
                                inline
                                title={TUTORIAL_ROUND_END_CONTENT[tutorialMode].title}
                                body={TUTORIAL_ROUND_END_CONTENT[tutorialMode].body}
                                actions={[]}
                                onClose={() => setRoundEndBubbleClosed(true)}
                            />
                        )}

                        {tutorial ? (
                            <button className="btn btn--primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={showTutorialEvolutionExplainer}>
                                {tutorialMode === 'raidboss' ? 'Meet the Raidboss →' : 'Learn the DNA →'}
                            </button>
                        ) : isRaidbossRound ? (
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button
                                    className="btn btn--soft"
                                    style={{ '--btn-color': '#a855f7' } as CSSProperties}
                                    onClick={async () => {
                                        setTrainNextLoading(true);
                                        try { await submitCurrentRaidbossFitness(); } finally { setTrainNextLoading(false); }
                                        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                                        navigate('/lobby/shooter', { state: { mode: 'raidboss' } });
                                    }}
                                    disabled={trainNextLoading}
                                >
                                    {trainNextLoading ? 'Saving...' : '← Lobby'}
                                </button>
                                <button
                                    className="btn btn--outline"
                                    style={{ '--btn-color': '#a855f7' } as CSSProperties}
                                    onClick={handleTrainNext}
                                    disabled={trainNextLoading}
                                >
                                    {trainNextLoading ? 'Loading...' : 'Contribute more →'}
                                </button>
                            </div>
                        ) : (
                            <button className="btn btn--primary" style={{ fontSize: 16, padding: '14px 32px' }} onClick={maybeOfferModChoice}>
                                Continue →
                            </button>
                        )}
                    </div>
                ) : phase === 'evolving' ? (
                    <div className={styles.overlay}>
                        <h2 className={styles.title}>EA is evolving...</h2>
                        <p className={styles.subtitle}>
                            Generation {(gameStateRef.current?.population?.generation ?? 0) + 1}
                        </p>
                    </div>
                ) : null}

                {/* Portalled to document.body: `.wrapper` above has `transform:
                 * scale(...)`, which per spec makes it the containing block for
                 * `position: fixed` descendants — without the portal, Compi's
                 * "fixed to viewport corner" is actually fixed *inside the
                 * canvas's own box*, sitting on top of the arena instead of in
                 * the real page space beside it (see HintPopover for the same
                 * fix applied elsewhere on the site). */}
                {tutorialCoachmark && createPortal(tutorialCoachmark, document.body)}

                {/* Same reasoning as above — a full walkthrough deserves the
                 * whole screen, not the cramped 800px canvas. */}
                {tutorial && tutorialEvolutionVisible && createPortal(
                    <div className="explainer-takeover">
                        <button className="btn btn--ghost btn--sm explainer-takeover__back" onClick={finishTutorial}>
                            ← Back to Lobby
                        </button>
                        {tutorialMode === 'raidboss' ? (
                            <TutorialRaidbossExplainer
                                onFinish={finishTutorial}
                                finishLabel="Finish Tutorial → Lobby"
                            />
                        ) : (
                            <TutorialEvolutionExplainer
                                onFinish={finishTutorial}
                                finishLabel="Finish Tutorial → Lobby"
                            />
                        )}
                    </div>,
                    document.body,
                )}

            </div>
        </div>
    );
};