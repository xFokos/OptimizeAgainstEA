import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useHints, HINTS, TourSpotlight } from '../../../components/hints';
import type { HintId } from '../../../components/hints';
import { HelpButton } from '../../../components/help';
import { ShooterPlayerSection, ShooterDnaSection, HordeWaveSection } from '../settings/ShooterSettings';
import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { HordeEASettingsPanel } from '../../../components/settings/EASettings';
import { HORDE_MAPS, CUSTOM_MAP_ID, resolveHordeMap } from '../horde/hordeMaps';
import { hordeGameStore } from '../horde/hordeGameStore';
import { useMobile, useZoom, enterGameFullscreen } from './lobbyHooks';
import { lobbyStyles, tabStyles, ovStyles, mobilePageStyle, mobileBtnsStyle } from './lobbyStyles';
import { HORDE_TABS, HORDE_TAB_LABELS, HORDE_EDITABLE_GENES, type HordeTab } from './lobbyConstants';
import { HordePreview } from './previews/HordePreview';
import { HordeMapPreview } from './previews/HordeMapPreview';
import { HordeOverview } from './HordeOverview';
import { TutorialChooserModal } from './TutorialChooserModal';
import { TutorialHordeExplainer } from '../components/tutorialHordeContent';
import { hasCompletedAnyTutorial } from '../shooter.types';

function HordeMapSection() {
    const navigate = useNavigate();
    const { hordeSettings, setHordeSettings } = useSettings();
    const customCount = hordeSettings.customObstacles.length;

    const btnStyle = (active: boolean): React.CSSProperties => ({
        ...ovStyles.presetBtn,
        flex:        'none',
        textAlign:   'left',
        padding:     '10px 14px',
        borderColor: active ? '#fb923c' : 'var(--border)',
        color:       active ? '#fb923c' : 'var(--text-dim)',
        background:  active ? 'rgba(251,146,60,0.09)' : 'transparent',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={ovStyles.placeholderHeading}>Map</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {HORDE_MAPS.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setHordeSettings({ ...hordeSettings, mapId: m.id })}
                        style={btnStyle(hordeSettings.mapId === m.id)}
                    >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>
                            {m.description}
                        </div>
                    </button>
                ))}
                <button
                    onClick={() => {
                        setHordeSettings({ ...hordeSettings, mapId: CUSTOM_MAP_ID });
                        navigate('/HordeMapEditor');
                    }}
                    style={btnStyle(hordeSettings.mapId === CUSTOM_MAP_ID)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Custom</span>
                        <span style={{ fontSize: 11, opacity: 0.6 }}>Edit →</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>
                        {customCount === 0
                            ? 'Build your own layout in the map editor.'
                            : `${customCount} obstacle${customCount === 1 ? '' : 's'} placed — click to keep editing.`}
                    </div>
                </button>
            </div>
        </div>
    );
}

export function HordeLobby({ initialTab }: { initialTab?: HordeTab }) {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const zoom     = useZoom();
    const HO       = '#fb923c';
    const [tab, setTab] = useState<HordeTab>(initialTab ?? 'Overview');
    const { hordeSettings, setHordeSettings, setShooterSettings } = useSettings();
    const { showHint, dismiss } = useHints();
    const selectedMap = resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn);

    const [activeRun, setActiveRun] = useState(hordeGameStore.state);
    useEffect(() => hordeGameStore.subscribe(() => setActiveRun(hordeGameStore.state)), []);
    const hasActiveRun = !!activeRun;
    // While a run is in progress, show the map it actually started with — the
    // player may have changed the map setting since without restarting.
    const previewMap = activeRun?.map ?? selectedMap;

    // No "starter vs current" distinction in the UI — just DNA. While a run is
    // active this is the best-performing individual's actual genome (editing
    // it patches that individual directly); otherwise it's the starter setting.
    const bestIndex = activeRun
        ? activeRun.population.individuals.reduce((bestI, cur, i, arr) => cur.fitness > arr[bestI].fitness ? i : bestI, 0)
        : -1;
    const bestIndividual = activeRun && bestIndex >= 0 ? activeRun.population.individuals[bestIndex] : null;
    const displayDna = bestIndividual ? bestIndividual.dna : hordeSettings.starterDna;

    const handlePlay = async () => {
        await enterGameFullscreen();
        navigate('/HordeGame');
    };

    const startHordeTutorial = async () => {
        await enterGameFullscreen();
        hordeGameStore.state = null;
        hordeGameStore.notify();
        navigate('/HordeGame', { state: { tutorial: true } });
    };

    // Wie in der Solo-Lobby: nur komplett neue Spieler bekommen den vollen
    // Erstlauf (Übungsrunde → Horde-Explainer) — wer irgendwo schon ein
    // Gameplay-Tutorial gemacht hat, kriegt direkt das Auswahlfenster.
    const [tutorialChooserOpen, setTutorialChooserOpen] = useState(false);
    const [explainerOpen, setExplainerOpen]             = useState(false);
    const openTutorial = () => {
        if (hasCompletedAnyTutorial()) setTutorialChooserOpen(true);
        else void startHordeTutorial();
    };

    const tutorialOverlays = (
        <>
            {tutorialChooserOpen && (
                <TutorialChooserModal
                    accent={HO}
                    onClose={() => setTutorialChooserOpen(false)}
                    onPractice={() => { setTutorialChooserOpen(false); void startHordeTutorial(); }}
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
                    <TutorialHordeExplainer
                        onFinish={() => setExplainerOpen(false)}
                        finishLabel="Back to Lobby"
                    />
                </div>,
                document.body,
            )}
        </>
    );

    // Guided lobby tour — same spotlight mechanism as Solo's (see NormalLobby):
    // highlights one real element per step instead of a corner-pinned bubble.
    const tabBarRef      = useRef<HTMLDivElement>(null);
    const presetsRef     = useRef<HTMLDivElement>(null);
    const dnaPanelRef    = useRef<HTMLDivElement>(null);
    const mapPreviewRef  = useRef<HTMLDivElement>(null);
    const playBtnRef     = useRef<HTMLButtonElement>(null);
    // `tab` = which tab must be active for this step's target to actually be
    // mounted. Steps advance by clicking straight through the highlight (see
    // TourSpotlight) — if that click (or any other settings change) left a
    // different tab active, the next step re-selects whatever it needs.
    const TOUR_STEPS: { id: HintId; ref: RefObject<HTMLElement | null>; tab?: HordeTab }[] = [
        { id: 'horde.tour.modes',      ref: tabBarRef },
        { id: 'horde.tour.difficulty', ref: presetsRef,  tab: 'Overview' },
        { id: 'horde.tour.dna',        ref: dnaPanelRef, tab: 'Overview' },
        // Map preview panel only exists in the desktop layout — skip this
        // step on mobile rather than pointing at an element that isn't there.
        ...(isMobile ? [] : [{ id: 'horde.tour.map' as HintId, ref: mapPreviewRef }]),
        { id: 'horde.tour.start',      ref: playBtnRef },
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

    // First visit to the Horde lobby this session → offer the tour once.
    useEffect(() => {
        showHint('horde.tour.welcome', {
            actions: [
                { label: 'Show me around', onClick: startTour, variant: 'primary' },
                { label: 'No thanks', onClick: dismiss, variant: 'ghost' },
            ],
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const playBtn = (
        <button
            ref={playBtnRef}
            className="btn btn--outline btn--lg"
            style={{ '--btn-color': HO } as React.CSSProperties}
            onClick={handlePlay}
        >
            {hasActiveRun ? 'Continue Horde →' : 'Play Horde →'}
        </button>
    );

    const tabBar = (
        <div ref={tabBarRef} style={{ ...tabStyles.bar, overflowX: 'auto', flexWrap: 'nowrap' as const, flexShrink: 0 }}>
            {HORDE_TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                    style={{ ...(tab === t ? tabStyles.tabActive : tabStyles.tabInactive), flexShrink: 0 }}>
                    {HORDE_TAB_LABELS[t]}
                </button>
            ))}
        </div>
    );

    const tabContent = (
        <div style={{ ...tabStyles.panel, overflowY: isMobile ? 'visible' : 'auto' }}>
            {tab === 'Overview' && <HordeOverview onNavigateTab={setTab} presetsRef={presetsRef} dnaPanelRef={dnaPanelRef} />}
            {tab === 'Algorithm' && <HordeEASettingsPanel />}
            {tab === 'DnaWave' && (
                <>
                    <div className="panel panel--md" style={{ marginBottom: 12 }}>
                        <p style={tabStyles.sectionLabel}>DNA</p>
                        <ShooterDnaSection
                            dna={displayDna}
                            onChange={(i, v) => {
                                // Not "starter vs current" — just DNA. Always updates the
                                // setting (so it's what the next run starts from). If a run
                                // is active, broadcast just this one gene to the whole swarm
                                // — every individual in the gene pool *and* every agent
                                // currently alive — rather than only the single best agent.
                                // Every other gene each of them already has stays untouched,
                                // so this doesn't erase what's evolved so far.
                                const newDna = [...displayDna];
                                newDna[i] = v;
                                setHordeSettings({ ...hordeSettings, starterDna: newDna });
                                if (activeRun) {
                                    const setGene = (dna: number[]) => {
                                        const next = [...dna];
                                        next[i] = v;
                                        return next;
                                    };
                                    hordeGameStore.state = {
                                        ...activeRun,
                                        population: {
                                            ...activeRun.population,
                                            individuals: activeRun.population.individuals.map(ind => ({ ...ind, dna: setGene(ind.dna) })),
                                        },
                                        agents: activeRun.agents.map(a => ({ ...a, dna: setGene(a.dna) })),
                                    };
                                    hordeGameStore.notify();
                                }
                            }}
                            genes={HORDE_EDITABLE_GENES}
                        />
                    </div>
                    <div className="panel panel--md">
                        <p style={tabStyles.sectionLabel}>Wave Settings</p>
                        <HordeWaveSection />
                    </div>
                </>
            )}
            {tab === 'Map' && <HordeMapSection />}
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
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, color: HO, margin: 0 }}>Horde Mode</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {tabBar}
                    {tabContent}
                </div>
                <div style={mobileBtnsStyle}>
                    <HelpButton topic="shooter.horde" onTakeTour={startTour} />
                    <button className="btn btn--outline btn--sm" style={{ '--btn-color': HO } as React.CSSProperties} onClick={openTutorial}>Tutorial</button>
                    <div style={{ flex: 1 }}>{playBtn}</div>
                </div>
                {tourOverlay}
                {tutorialOverlays}
            </div>
        );
    }

    return (
        <div style={{ ...lobbyStyles.page, zoom }}>
            <div style={lobbyStyles.leftTop}>
                <div ref={mapPreviewRef} style={lobbyStyles.leftTopPreview}>
                    <div style={lobbyStyles.brand}>
                        <div style={{ ...lobbyStyles.brandLogo, color: HO, background: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.25)' }}>SG</div>
                        <span style={lobbyStyles.brandName}>Shooter Game</span>
                    </div>
                    {/* Show the real map layout — not the generic decorative demo —
                        once a run is active, so this actually reflects the run. */}
                    {(tab === 'Map' || activeRun) ? <HordeMapPreview map={previewMap} /> : <HordePreview />}
                    <div style={lobbyStyles.previewLabel}>
                        {tab === 'Map' ? 'Map Preview' : activeRun ? 'Current Map' : 'Live Preview'} · {previewMap.label}
                    </div>
                </div>
                <div style={lobbyStyles.leftTopHelpSlot}>
                    <HelpButton topic="shooter.horde" className="btn btn--outline btn--block help-button" onTakeTour={startTour} />
                </div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={{ ...lobbyStyles.title, color: HO }}>Horde Mode</h1>
                </div>
                <div style={tabStyles.shell}>
                    {tabBar}
                    {tabContent}
                </div>
            </div>

            <div style={{ ...lobbyStyles.rightBottom, gap: 10 }}>
                <button className="btn btn--outline btn--lg" style={{ '--btn-color': HO } as React.CSSProperties} onClick={openTutorial}>Tutorial</button>
                {playBtn}
            </div>
            {tourOverlay}
            {tutorialOverlays}
        </div>
    );
}
