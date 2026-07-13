import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useHints, HINTS, TourSpotlight } from '../../../components/hints';
import type { HintId } from '../../../components/hints';
import { HelpButton } from '../../../components/help';
import { ShooterPlayerSection, ShooterRoundSection, ShooterDnaSection } from '../settings/ShooterSettings';
import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { EASettingsPanel } from '../../../components/settings/EASettings';
import { gameStore } from '../game/gameStore';
import { initPopulation } from '../game/ga/population';
import { useMobile, useZoom, enterGameFullscreen } from './lobbyHooks';
import { lobbyStyles, tabStyles, mobilePageStyle, mobileBtnsStyle } from './lobbyStyles';
import { PRESETS, LOBBY_TABS, LOBBY_TAB_LABELS, type PresetId, type LobbyTab } from './lobbyConstants';
import { ShooterPreview } from './previews/ShooterPreview';
import { SoloPlayOverview } from './SoloPlayOverview';
import { TutorialChooserModal } from './TutorialChooserModal';
import { TutorialEvolutionExplainer } from '../components/tutorialEvolutionContent';
import { TUTORIAL_COMPLETED_KEY } from '../shooter.types';

// ---- Normal Lobby ----

export function NormalLobby() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<LobbyTab>('Overview');
    const [hasActiveGame, setHasActiveGame] = useState(!!gameStore.state);
    // The live agent's DNA once a game exists — there's no separate "starter vs
    // current" concept in the UI, just "DNA": this is it whenever a game is
    // running, falling back to the starter setting otherwise (see dna={} below).
    const [liveDna, setLiveDna] = useState<number[] | null>(gameStore.state?.agent?.dna ?? null);
    const { shooterSettings, eaSettings, setShooterSettings } = useSettings();
    const { showHint, dismiss } = useHints();
    const [selectedPreset, setSelectedPreset] = useState<PresetId>(() => {
        const match = PRESETS.find(p =>
            p.dna.every((v, i) => Math.abs(v - shooterSettings.starterDna[i]) < 0.001) &&
            Math.abs(p.mutation - eaSettings.mutationRate) < 0.001 &&
            Math.abs(p.strength - eaSettings.mutationStrength) < 0.001 &&
            p.presim === eaSettings.presimGenerations &&
            p.modInterval === shooterSettings.modChoiceInterval
        );
        return match?.id ?? 'custom';
    });
    const isMobile = useMobile();
    const zoom = useZoom();

    useEffect(() => {
        const sync = () => {
            setHasActiveGame(!!gameStore.state);
            setLiveDna(gameStore.state?.agent?.dna ?? null);
        };
        sync();
        return gameStore.subscribe(sync);
    }, []);

    // Wenn Settings manuell geändert werden → zurück zu Custom.
    // Lives here (not in a single tab) since DNA/round settings can now be
    // edited from the Algorithm and Player tabs, not just Overview.
    useEffect(() => {
        if (selectedPreset === 'custom') return;
        const active = PRESETS.find(p => p.id === selectedPreset);
        if (!active) return;
        const dnaMatch = active.dna.every((v, i) => Math.abs(v - (shooterSettings.starterDna[i] ?? 0)) < 0.001);
        const mutMatch = Math.abs(active.mutation - eaSettings.mutationRate) < 0.001 &&
                         Math.abs(active.strength  - eaSettings.mutationStrength) < 0.001;
        const presimMatch = active.presim === eaSettings.presimGenerations;
        const intervalMatch = active.modInterval === shooterSettings.modChoiceInterval;
        if (!dnaMatch || !mutMatch || !presimMatch || !intervalMatch) setSelectedPreset('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shooterSettings.starterDna, shooterSettings.modChoiceInterval, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.presimGenerations]);

    const warnIfMidRound = () => { if (hasActiveGame) showHint('shooter.dnaChangeDuringRound'); };

    // Guided lobby tour: a spotlight dims the screen except the one real UI
    // element each step is about (tab bar → difficulty presets → DNA panel →
    // Play button) instead of a corner-pinned bubble — see TourSpotlight.
    // Wording still comes from hintContent.ts; the Next/Skip chain lives here
    // since HintDef has no action field and only the call site knows "next".
    const tabBarRef   = useRef<HTMLDivElement>(null);
    const presetsRef  = useRef<HTMLDivElement>(null);
    const dnaPanelRef = useRef<HTMLDivElement>(null);
    const playBtnRef  = useRef<HTMLButtonElement>(null);
    // `tab` = which tab must be active for this step's target to actually be
    // mounted. Steps advance by clicking straight through the highlight (see
    // TourSpotlight) — if that click (or any other settings change) left a
    // different tab active, the next step re-selects whatever it needs.
    const TOUR_STEPS: { id: HintId; ref: RefObject<HTMLElement | null>; tab?: LobbyTab }[] = [
        { id: 'shooter.tour.modes',      ref: tabBarRef },
        { id: 'shooter.tour.difficulty', ref: presetsRef,  tab: 'Overview' },
        { id: 'shooter.tour.dna',        ref: dnaPanelRef, tab: 'Overview' },
        { id: 'shooter.tour.start',      ref: playBtnRef },
    ];
    const [tourStep, setTourStep] = useState<number | null>(null);
    const goToTourStep = (i: number) => {
        const step = TOUR_STEPS[i];
        if (step.tab) setTab(step.tab);
        setTourStep(i);
    };
    const startTour = () => {
        dismiss(); // close the "New here?" welcome bubble — it'd otherwise stay
        goToTourStep(0);
    };
    const stopTour  = () => setTourStep(null);

    const tourOverlay = tourStep !== null && (() => {
        const step    = TOUR_STEPS[tourStep];
        const def     = HINTS[step.id];
        const isLast  = tourStep === TOUR_STEPS.length - 1;
        const goNext  = () => (isLast ? stopTour() : goToTourStep(tourStep + 1));
        return (
            <TourSpotlight
                key={step.id}
                targetRef={step.ref}
                title={def.title}
                body={def.body}
                actions={[
                    { label: isLast ? 'Got it' : 'Next', onClick: goNext, variant: 'primary' },
                    ...(isLast ? [] : [{ label: 'Skip', onClick: stopTour, variant: 'ghost' as const }]),
                ]}
                onAdvance={goNext}
                onSkip={stopTour}
            />
        );
    })();

    // First visit to the Solo lobby this session → offer the tour once.
    useEffect(() => {
        showHint('shooter.tour.welcome', {
            actions: [
                { label: 'Show me around', onClick: startTour, variant: 'primary' },
                { label: 'No thanks', onClick: dismiss, variant: 'ghost' },
            ],
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startPractice = async () => {
        await enterGameFullscreen();
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        navigate('/ShooterGame', { state: { tutorial: true } });
    };

    // Tutorial-Button: erster Durchlauf startet direkt die Übungsrunde (die am
    // Ende in den DNA/EA-Explainer mündet). Sobald das einmal abgeschlossen
    // wurde (Flag gesetzt in ShooterCanvas' finishTutorial), öffnet der Button
    // stattdessen ein Auswahlfenster, um gezielt einen Teil zu wiederholen.
    const [tutorialChooserOpen, setTutorialChooserOpen] = useState(false);
    const [explainerOpen, setExplainerOpen]             = useState(false);
    const openTutorial = () => {
        if (localStorage.getItem(TUTORIAL_COMPLETED_KEY)) setTutorialChooserOpen(true);
        else void startPractice();
    };

    const tutorialOverlays = (
        <>
            {tutorialChooserOpen && (
                <TutorialChooserModal
                    onClose={() => setTutorialChooserOpen(false)}
                    onPractice={() => { setTutorialChooserOpen(false); void startPractice(); }}
                    onExplainer={() => { setTutorialChooserOpen(false); setExplainerOpen(true); }}
                />
            )}
            {/* Portal: der Desktop-Wrapper hat `zoom` — als echtes Fullscreen-
              * Takeover gehört der Explainer in den unskalierten Viewport. */}
            {explainerOpen && createPortal(
                <div className="explainer-takeover">
                    <button className="btn btn--ghost btn--sm explainer-takeover__back" onClick={() => setExplainerOpen(false)}>
                        ← Back to Lobby
                    </button>
                    <TutorialEvolutionExplainer
                        onFinish={() => setExplainerOpen(false)}
                        finishLabel="Back to Lobby"
                    />
                </div>,
                document.body,
            )}
        </>
    );

    const tabBar = (
        <div ref={tabBarRef} style={{ ...tabStyles.bar, overflowX: 'auto', flexWrap: 'nowrap' as const, flexShrink: 0 }}>
            {LOBBY_TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                    style={{ ...(tab === t ? tabStyles.tabActive : tabStyles.tabInactive), flexShrink: 0 }}>
                    {LOBBY_TAB_LABELS[t]}
                </button>
            ))}
        </div>
    );

    const tabContent = (
        <div style={{ ...tabStyles.panel, overflowY: isMobile ? 'visible' : 'auto' }}>
            {tab === 'Overview' && (
                <SoloPlayOverview
                    selectedPreset={selectedPreset}
                    setSelectedPreset={setSelectedPreset}
                    onNavigateTab={setTab}
                    presetsRef={presetsRef}
                    dnaPanelRef={dnaPanelRef}
                />
            )}
            {tab === 'Algorithm' && <EASettingsPanel />}
            {tab === 'DnaRound' && (
                <>
                    <div className="panel panel--md" style={{ marginBottom: 12 }}>
                        <p style={tabStyles.sectionLabel}>DNA</p>
                        <ShooterDnaSection
                            dna={liveDna ?? shooterSettings.starterDna}
                            onChange={(i, v) => {
                                warnIfMidRound();
                                // Not "starter vs current" — just DNA. This always updates
                                // the setting (so it's what the next reset starts from),
                                // and if a game is actually running right now, it also
                                // patches the live agent so the edit takes effect immediately
                                // instead of silently doing nothing until you reset.
                                const newDna = [...(liveDna ?? shooterSettings.starterDna)];
                                newDna[i] = v;
                                setShooterSettings({ ...shooterSettings, starterDna: newDna });
                                if (gameStore.state) {
                                    const newPop  = initPopulation(newDna);
                                    const prevGen = gameStore.state.population?.generation ?? 1;
                                    gameStore.state = {
                                        ...gameStore.state,
                                        population: { ...newPop, generation: prevGen },
                                        agent:      { ...gameStore.state.agent, dna: newDna },
                                    };
                                    gameStore.notify();
                                }
                            }}
                        />
                    </div>
                    <div className="panel panel--md">
                        <p style={tabStyles.sectionLabel}>Round Settings</p>
                        <ShooterRoundSection
                            locked={selectedPreset !== 'custom'}
                            onBeforeChange={warnIfMidRound}
                        />
                    </div>
                </>
            )}
            {tab === 'Player' && (
                <>
                    <div className="panel panel--md">
                        <ShooterPlayerSection />
                    </div>
                    <button style={tabStyles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>Reset</button>
                </>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, margin: 0 }}>Solo Play</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {tabBar}
                    {tabContent}
                </div>
                <div style={mobileBtnsStyle}>
                    <HelpButton topic="shooter.solo" onTakeTour={startTour} />
                    <button className="btn btn--outline btn--sm" onClick={openTutorial}>Tutorial</button>
                    <button ref={playBtnRef} className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={async () => { await enterGameFullscreen(); navigate('/ShooterGame'); }}>
                        {hasActiveGame ? 'Continue →' : 'Play →'}
                    </button>
                </div>
                {tourOverlay}
                {tutorialOverlays}
            </div>
        );
    }

    return (
        <div style={{ ...lobbyStyles.page, zoom }}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.leftTopPreview}>
                    <div style={lobbyStyles.brand}>
                        <div style={lobbyStyles.brandLogo}>SG</div>
                        <span style={lobbyStyles.brandName}>Shooter Game</span>
                    </div>
                    <ShooterPreview />
                    <div style={lobbyStyles.previewLabel}>Live Preview</div>
                </div>
                <div style={{ ...lobbyStyles.leftTopHelpSlot, flexDirection: 'column', gap: 8 }}>
                    <HelpButton topic="shooter.solo" className="btn btn--outline btn--block help-button" onTakeTour={startTour} />
                </div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={lobbyStyles.title}>Solo Play</h1>
                </div>
                <div style={tabStyles.shell}>
                    {tabBar}
                    {tabContent}
                </div>
            </div>

            <div style={{ ...lobbyStyles.rightBottom, gap: 10 }}>
                <button className="btn btn--outline btn--lg" onClick={openTutorial}>Tutorial</button>
                <button ref={playBtnRef} className="btn btn--primary btn--lg" onClick={async () => { await enterGameFullscreen(); navigate('/ShooterGame'); }}>
                    {hasActiveGame ? 'Continue →' : 'Play →'}
                </button>
            </div>
            {tourOverlay}
            {tutorialOverlays}
        </div>
    );
}
