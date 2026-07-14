import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { HelpButton } from '../../../components/help';
import { gameStore } from '../game/gameStore';
import { analyticsStore } from '../game/analyticsStore';
import { getRaidbossStatus, claimRaidbossSlot } from '../game/raidbossStore';
import type { RaidbossDoc } from '../game/raidbossStore';
import { useMobile, useZoom, enterGameFullscreen } from './lobbyHooks';
import { lobbyStyles, mobilePageStyle, mobileBtnsStyle } from './lobbyStyles';
import { RaidbossPreview } from './previews/RaidbossPreview';
import { TutorialChooserModal } from './TutorialChooserModal';
import { TutorialRaidbossExplainer } from '../components/tutorialRaidbossContent';
import { hasCompletedAnyTutorial } from '../shooter.types';

// ---- Raidboss Lobby ----

const RB = '#a855f7';

export function RaidbossLobby() {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const zoom = useZoom();
    const [doc,     setDoc]     = useState<RaidbossDoc | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getRaidbossStatus().then(setDoc).catch(() => {});
    }, []);

    const handlePlay = async () => {
        setLoading(true);
        try {
            await enterGameFullscreen();
            await claimRaidbossSlot();
            gameStore.state = null as unknown as typeof gameStore.state;
            gameStore.notify();
            analyticsStore.clear();
            navigate('/ShooterGame');
        } catch (err) {
            console.error('[Raidboss] Fehler:', err);
            setLoading(false);
        }
    };

    // Übungsrunde = dieselbe Solo-Practice-Round (Steuerung ist identisch),
    // nur dass sie am Ende in den Raidboss-Explainer mündet und hierher
    // zurückkehrt (tutorialMode) — kein Firestore-Slot, nichts wird bewertet.
    const startPractice = async () => {
        await enterGameFullscreen();
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        navigate('/ShooterGame', { state: { tutorial: true, tutorialMode: 'raidboss' } });
    };

    // Wie in der Solo-Lobby: nur komplett neue Spieler bekommen den vollen
    // Erstlauf (Übungsrunde → Explainer) — wer irgendwo schon ein
    // Gameplay-Tutorial gemacht hat, kriegt direkt das Auswahlfenster.
    const [tutorialChooserOpen, setTutorialChooserOpen] = useState(false);
    const [explainerOpen, setExplainerOpen]             = useState(false);
    const openTutorial = () => {
        if (hasCompletedAnyTutorial()) setTutorialChooserOpen(true);
        else void startPractice();
    };

    const tutorialOverlays = (
        <>
            {tutorialChooserOpen && (
                <TutorialChooserModal
                    accent={RB}
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
                    <TutorialRaidbossExplainer
                        onFinish={() => setExplainerOpen(false)}
                        finishLabel="Back to Lobby"
                    />
                </div>,
                document.body,
            )}
        </>
    );

    const evalCount  = doc ? doc.individuals.filter(i => i.fitness !== null).length : 0;
    const total      = doc?.populationSize ?? 0;
    const nextIndex  = doc ? doc.individuals.findIndex(i => i.fitness === null) : -1;
    const progress   = total > 0 ? evalCount / total : 0;
    const genTotal   = doc ? (doc.generation - 1) * total + evalCount : 0;

    const statusContent = doc === null ? (
        <div style={rbStyles.emptyState}>
            <span style={rbStyles.emptyIcon}>🧬</span>
            <span style={rbStyles.emptyTitle}>No boss trained yet</span>
            <span style={rbStyles.emptySub}>Be the first and start the first generation.</span>
        </div>
    ) : (
        <div style={rbStyles.statusPanel}>
            <div style={rbStyles.genRow}>
                <span style={rbStyles.genLabel}>Generation</span>
                <span style={rbStyles.genValue}>{doc.generation}</span>
                <span style={rbStyles.genTotal}>{genTotal} individuals evaluated in total</span>
            </div>
            <div style={rbStyles.progressBlock}>
                <div style={rbStyles.progressHeader}>
                    <span style={rbStyles.progressLabel}>Progress this generation</span>
                    <span style={rbStyles.progressCount}>{evalCount} / {total}</span>
                </div>
                <div style={rbStyles.progressTrack}>
                    <div style={{ ...rbStyles.progressFill, width: `${progress * 100}%` }} />
                </div>
            </div>
            <div style={rbStyles.dotsRow}>
                {doc.individuals.map((ind, i) => {
                    const isDone = ind.fitness !== null;
                    const isNext = i === nextIndex;
                    return (
                        <div
                            key={i}
                            title={`Individual ${i + 1}${isDone ? ` · Fitness ${ind.fitness?.toFixed(2)}` : isNext ? ' · Next up' : ''}`}
                            style={{
                                ...rbStyles.dot,
                                background:  isDone ? RB : isNext ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.08)',
                                border:      isNext ? `1px solid ${RB}` : '1px solid transparent',
                                boxShadow:   isDone ? `0 0 6px rgba(168,85,247,0.5)` : 'none',
                            }}
                        />
                    );
                })}
            </div>
            {nextIndex !== -1 ? (
                <div style={rbStyles.nextUp}>
                    <span style={rbStyles.nextUpLabel}>Next up</span>
                    <span style={rbStyles.nextUpValue}>Individual {nextIndex + 1} of {total}</span>
                </div>
            ) : (
                <div style={rbStyles.nextUp}>
                    <span style={rbStyles.nextUpLabel}>Status</span>
                    <span style={{ ...rbStyles.nextUpValue, color: '#4ade80' }}>All evaluated — evolution running</span>
                </div>
            )}
        </div>
    );

    const playBtn = (
        <button
            className="btn btn--outline btn--lg"
            style={{ '--btn-color': RB } as React.CSSProperties}
            onClick={handlePlay}
            disabled={loading}
        >
            {loading ? 'Loading...' : 'Fight Raidboss →'}
        </button>
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, color: RB, margin: 0 }}>Community Raidboss</h1>
                <p style={{ ...lobbyStyles.description, margin: 0 }}>
                    Each player evaluates one agent from the community population.
                    Once all are evaluated, the population automatically evolves to the next generation.
                </p>
                {statusContent}
                <div style={mobileBtnsStyle}>
                    <HelpButton topic="shooter.raidboss" />
                    <button className="btn btn--outline btn--sm" style={{ '--btn-color': RB } as React.CSSProperties} onClick={openTutorial}>Tutorial</button>
                    <div style={{ flex: 1 }}>{playBtn}</div>
                </div>
                {tutorialOverlays}
            </div>
        );
    }

    return (
        <div style={{ ...lobbyStyles.page, zoom }}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.leftTopPreview}>
                    <div style={lobbyStyles.brand}>
                        <div style={{ ...lobbyStyles.brandLogo, color: RB, background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.25)' }}>SG</div>
                        <span style={lobbyStyles.brandName}>Shooter Game</span>
                    </div>
                    <RaidbossPreview />
                    <div style={lobbyStyles.previewLabel}>Boss Preview</div>
                </div>
                <div style={lobbyStyles.leftTopHelpSlot}>
                    <HelpButton topic="shooter.raidboss" className="btn btn--outline btn--block help-button" />
                </div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={{ ...lobbyStyles.title, color: RB }}>Community Raidboss</h1>
                    <p style={lobbyStyles.description}>
                        Play against one individual of the current generation. There is no simulation and every individual experiences real player combat.
                    </p>
                </div>
                {statusContent}
            </div>

            <div style={{ ...lobbyStyles.rightBottom, gap: 10 }}>
                <button className="btn btn--outline btn--lg" style={{ '--btn-color': RB } as React.CSSProperties} onClick={openTutorial}>Tutorial</button>
                {playBtn}
            </div>
            {tutorialOverlays}
        </div>
    );
}

const rbStyles: Record<string, React.CSSProperties> = {
    emptyState: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            6,
        padding:        '20px',
        background:     'rgba(168,85,247,0.05)',
        border:         '1px dashed rgba(168,85,247,0.25)',
        borderRadius:   10,
    },
    emptyIcon:  { fontSize: 28 },
    emptyTitle: { fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'rgba(192,158,255,0.9)' },
    emptySub:   { fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 },

    statusPanel: {
        display:       'flex',
        flexDirection: 'column',
        gap:           20,
    },
    genRow: {
        display:    'flex',
        alignItems: 'baseline',
        gap:        12,
    },
    genLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'rgba(168,85,247,0.6)',
    },
    genValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   48,
        fontWeight: 700,
        color:      RB,
        lineHeight: 1,
        textShadow: '0 0 24px rgba(168,85,247,0.4)',
    },
    genTotal: {
        fontSize: 13,
        color:    'rgba(255,255,255,0.35)',
    },

    progressBlock: {
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
    },
    progressHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
    },
    progressLabel: {
        fontSize:      11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color:         'rgba(255,255,255,0.35)',
        fontFamily:    'var(--font-mono)',
    },
    progressCount: {
        fontFamily: 'var(--font-mono)',
        fontSize:   14,
        fontWeight: 700,
        color:      'rgba(192,158,255,0.85)',
    },
    progressTrack: {
        height:       6,
        borderRadius: 999,
        background:   'rgba(255,255,255,0.08)',
        overflow:     'hidden',
    },
    progressFill: {
        height:           '100%',
        borderRadius:     999,
        background:       `linear-gradient(90deg, rgba(168,85,247,0.7), ${RB})`,
        transition:       'width 0.4s ease',
        boxShadow:        '0 0 8px rgba(168,85,247,0.5)',
    },

    dotsRow: {
        display:   'flex',
        flexWrap:  'wrap' as const,
        gap:       6,
    },
    dot: {
        width:        14,
        height:       14,
        borderRadius: '50%',
        flexShrink:   0,
        transition:   'all 0.2s ease',
        cursor:       'default',
    },

    nextUp: {
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        padding:    '10px 14px',
        background: 'rgba(168,85,247,0.07)',
        border:     '1px solid rgba(168,85,247,0.2)',
        borderRadius: 8,
    },
    nextUpLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'rgba(168,85,247,0.55)',
        flexShrink:    0,
    },
    nextUpValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   14,
        fontWeight: 700,
        color:      'rgba(192,158,255,0.9)',
    },
};
