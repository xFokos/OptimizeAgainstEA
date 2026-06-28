import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { GameModeSelectorLayout } from '../../../components/layout/GameModeSelectorLayout';
import { HintsProvider, HintToggle, HintLayer } from '../../../components/hints';
import { ShooterDnaSection, ShooterPlayerSection, ShooterRoundSection } from '../settings/ShooterSettings';
import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { EASettingsPanel } from '../../../components/settings/EASettings';
import { vec } from '../game/core/vec';
import { DNA_INDEX, GAME_CONFIG } from '../shooter.types';
import type { GamePhase } from '../shooter.types';
import { gameStore } from '../game/gameStore';
import { analyticsStore } from '../game/analyticsStore';
import { getRaidbossStatus, claimRaidbossSlot } from '../game/raidbossStore';
import type { RaidbossDoc } from '../game/raidbossStore';

// ---- Mini Preview Canvas ----

const PREVIEW_W = 400;
const PREVIEW_H = 400;

interface PreviewAgent {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    rot:      number;
    color:    string;
    glowColor: string;
}

interface PreviewBullet {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    color:    string;
    lifetime: number;
    owner:    'a' | 'b';
}

function ShooterPreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { shooterSettings } = useSettings();

    const dnaRef = useRef(shooterSettings.starterDna);
    useEffect(() => { dnaRef.current = shooterSettings.starterDna; }, [shooterSettings.starterDna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let agentA: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.25, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: 0,
            color:     '#4fc3f7',
            glowColor: 'rgba(79, 195, 247, 0.3)',
        };
        let agentB: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.75, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: Math.PI,
            color:     '#ef5350',
            glowColor: 'rgba(239, 83, 80, 0.3)',
        };

        let bullets: PreviewBullet[] = [];
        let bulletTimer   = 0;
        let lastTimestamp = 0;

        const drawArena = () => {
            ctx.fillStyle = '#0f0f1a';
            ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth   = 1;
            for (let x = 0; x <= PREVIEW_W; x += 40) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, PREVIEW_H); ctx.stroke();
            }
            for (let y = 0; y <= PREVIEW_H; y += 40) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(PREVIEW_W, y); ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.lineWidth   = 2;
            ctx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);
        };

        const drawAgent = (agent: PreviewAgent) => {
            ctx.save();
            ctx.translate(agent.pos.x, agent.pos.y);
            ctx.rotate(agent.rot);
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = agent.color;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(26, 0);
            ctx.strokeStyle = agent.color;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.strokeStyle = agent.glowColor;
            ctx.lineWidth   = 3;
            ctx.stroke();
            ctx.restore();
        };

        const drawBullets = () => {
            for (const b of bullets) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
                ctx.fillStyle   = b.color;
                ctx.shadowColor = b.color;
                ctx.shadowBlur  = 8;
                ctx.fill();
                ctx.restore();
            }
        };

        const updateAgent = (agent: PreviewAgent, target: PreviewAgent, dt: number): PreviewAgent => {
            const dna        = dnaRef.current;
            const speed      = 30 + dna[DNA_INDEX.MOVEMENT_SPEED] * 70;
            const aggression = 0.3 + dna[DNA_INDEX.AGGRESSION] * 0.7;
            const prefRange  = 60 + dna[DNA_INDEX.PREFERRED_RANGE] * 150;

            const diff     = vec.sub(target.pos, agent.pos);
            const dist     = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
            const toTarget = dist > 1 ? vec.scale(diff, 1 / dist) : { x: 1, y: 0 };

            const orbitAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const orbitVel   = { x: Math.cos(orbitAngle) * speed, y: Math.sin(orbitAngle) * speed };

            const rangeError = dist - prefRange;
            const rangeVel   = vec.scale(toTarget, rangeError * aggression * 1.5);

            const combined = vec.add(orbitVel, rangeVel);
            agent.vel = vec.scale(vec.add(agent.vel, vec.scale(combined, dt)), 0.88);
            agent.pos = {
                x: Math.max(20, Math.min(PREVIEW_W - 20, agent.pos.x + agent.vel.x * dt)),
                y: Math.max(20, Math.min(PREVIEW_H - 20, agent.pos.y + agent.vel.y * dt)),
            };
            agent.rot = Math.atan2(toTarget.y, toTarget.x);
            return agent;
        };

        const spawnBullets = (a: PreviewAgent, b: PreviewAgent) => {
            const dna         = dnaRef.current;
            const spread      = (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
            const bulletSpeed = (GAME_CONFIG.BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);

            const shoot = (from: PreviewAgent, to: PreviewAgent, color: string, owner: 'a' | 'b') => {
                const base  = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({
                    pos:      { ...from.pos },
                    vel:      { x: Math.cos(angle) * bulletSpeed, y: Math.sin(angle) * bulletSpeed },
                    color,
                    lifetime: 1.5,
                    owner,
                });
            };

            shoot(a, b, '#80d8ff', 'a');
            shoot(b, a, '#ff8a80', 'b');
        };

        const loop = (timestamp: number) => {
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;

            agentA = updateAgent(agentA, agentB, dt);
            agentB = updateAgent(agentB, agentA, dt);

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                const fireRate  = dnaRef.current[DNA_INDEX.FIRE_RATE];
                bulletTimer = 1.4 - fireRate * 1.1 + Math.random() * 0.2;
                spawnBullets(agentA, agentB);
            }

            const AGENT_RADIUS  = 14;
            const BULLET_RADIUS = 4;
            const HIT_DIST      = AGENT_RADIUS + BULLET_RADIUS;

            bullets = bullets
                .map(b => ({
                    ...b,
                    pos:      { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
                    lifetime: b.lifetime - dt,
                }))
                .filter(b => {
                    if (b.lifetime <= 0 || b.pos.x <= 0 || b.pos.x >= PREVIEW_W || b.pos.y <= 0 || b.pos.y >= PREVIEW_H)
                        return false;
                    const target = b.owner === 'a' ? agentB : agentA;
                    const dx = b.pos.x - target.pos.x;
                    const dy = b.pos.y - target.pos.y;
                    return dx * dx + dy * dy >= HIT_DIST * HIT_DIST;
                });

            drawArena();
            drawBullets();
            drawAgent(agentA);
            drawAgent(agentB);

            animRef = requestAnimationFrame(loop);
        };

        let animRef = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
                borderRadius: '8px',
                border:       '1px solid rgba(255,255,255,0.08)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}

// ---- Phase label ----

function phaseLabel(phase: GamePhase): string {
    if (phase === 'playing')  return 'Läuft';
    if (phase === 'roundEnd') return 'Beendet';
    if (phase === 'evolving') return 'Evolving';
    return '';
}

// ---- Mode type ----

type LobbyMode = 'normal' | 'raidboss' | 'horde';

const SHOOTER_MODES = [
    {
        id:    'normal',
        key:   'S',
        label: 'Solo Play',
        sub:   'Kämpfe gegen einen genetischen Algorithmus, der sich nach jeder Runde an deinen Spielstil anpasst.',
    },
    {
        id:    'raidboss',
        key:   'R',
        label: 'Community Raidboss',
        sub:   'Trainiere die Community-Population. Jeder Kampf verbessert den gemeinsamen Boss für alle Spieler.',
    },
    {
        id:    'horde',
        key:   'H',
        label: 'Horde Mode',
        sub:   'Überlebe endlose Wellen immer stärker werdender Agenten. Wie lange hältst du durch?',
    },
];

// ---- Difficulty Presets ----

const PRESETS = [
    {
        id:      'einfach',
        label:   'Einfach',
        color:   '#4ade80',
        desc:    'Der EA startet schwach und lernt langsam. Ideal zum Kennenlernen des Spiels.',
        dna:     [0.1, 0.1, 0.2, 0.3, 0.2, 0.1, 0.2],
        mutation: 0.05,
        strength: 0.1,
        presim:  0,
    },
    {
        id:      'mittel',
        label:   'Mittel',
        color:   '#facc15',
        desc:    'Ausgewogener Start — der EA lernt moderat und passt sich nach einigen Runden an.',
        dna:     [0.4, 0.3, 0.5, 0.5, 0.4, 0.3, 0.4],
        mutation: 0.15,
        strength: 0.2,
        presim:  3,
    },
    {
        id:      'schwer',
        label:   'Schwer',
        color:   '#f87171',
        desc:    'Der EA startet stark und optimiert sich schnell gegen deinen Spielstil.',
        dna:     [0.7, 0.6, 0.8, 0.6, 0.7, 0.6, 0.7],
        mutation: 0.25,
        strength: 0.3,
        presim:  8,
    },
] as const;

type PresetId = typeof PRESETS[number]['id'];

// ---- Solo Play Overview (tab 1) ----

function SoloPlayOverview() {
    const navigate = useNavigate();
    const [round, setRound] = useState(gameStore.state?.roundNumber ?? 0);
    const [phase, setPhase] = useState<GamePhase | null>(gameStore.state?.phase ?? null);
    const [lastRecord, setLastRecord] = useState(analyticsStore.rounds.at(-1) ?? null);
    const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(null);
    const { shooterSettings, setShooterSettings, eaSettings, setEaSettings } = useSettings();

    useEffect(() => {
        const syncGame = () => {
            setRound(gameStore.state?.roundNumber ?? 0);
            setPhase(gameStore.state?.phase ?? null);
        };
        const syncAnalytics = () => setLastRecord(analyticsStore.rounds.at(-1) ?? null);
        syncGame();
        syncAnalytics();
        const unsub1 = gameStore.subscribe(syncGame);
        const unsub2 = analyticsStore.subscribe(syncAnalytics);
        return () => { unsub1(); unsub2(); };
    }, []);

    const applyPreset = (p: typeof PRESETS[number]) => {
        setSelectedPreset(p.id);
        setShooterSettings({ ...shooterSettings, starterDna: [...p.dna] });
        setEaSettings({ ...eaSettings, mutationRate: p.mutation, mutationStrength: p.strength, presimGenerations: p.presim });
    };

    const hasGame = round > 0;

    const handleReset = () => {
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        analyticsStore.clear();
    };

    if (!hasGame) {
        const active = PRESETS.find(p => p.id === selectedPreset) ?? null;
        return (
            <div style={ovStyles.emptyLayout}>
                {/* Slot */}
                <div style={ovStyles.slot}>
                    <span style={ovStyles.slotIcon}>🎮</span>
                    <span style={ovStyles.slotTitle}>Kein aktives Spiel</span>
                    <span style={ovStyles.slotSub}>
                        Wähle einen Schwierigkeitsgrad<br />
                        und starte deine erste Runde.
                    </span>
                </div>

                {/* Preset panel */}
                <div style={ovStyles.presetPanel}>
                    <span style={ovStyles.presetHeading}>Schnellstart</span>
                    <div style={ovStyles.presetBtns}>
                        {PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p)}
                                style={{
                                    ...ovStyles.presetBtn,
                                    borderColor: selectedPreset === p.id ? p.color : 'var(--border)',
                                    color:       selectedPreset === p.id ? p.color : 'var(--text-dim)',
                                    background:  selectedPreset === p.id ? `${p.color}14` : 'transparent',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                    {active ? (
                        <p style={{ ...ovStyles.presetDesc, color: active.color + 'cc' }}>
                            {active.desc}
                        </p>
                    ) : (
                        <p style={ovStyles.presetDesc}>
                            Wähle einen Modus um die Settings automatisch anzupassen.
                        </p>
                    )}
                    <div style={ovStyles.presetStats}>
                        <div style={ovStyles.presetStat}>
                            <span style={ovStyles.presetStatLabel}>Mutations-Rate</span>
                            <span style={ovStyles.presetStatValue}>{eaSettings.mutationRate.toFixed(2)}</span>
                        </div>
                        <div style={ovStyles.presetStat}>
                            <span style={ovStyles.presetStatLabel}>Presim Gen.</span>
                            <span style={ovStyles.presetStatValue}>{eaSettings.presimGenerations}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={ovStyles.card}>
            {/* Round + Phase */}
            <div style={ovStyles.header}>
                <div>
                    <div style={ovStyles.roundLabel}>Runde</div>
                    <div style={ovStyles.roundValue}>{round}</div>
                </div>
                {phase && <span style={ovStyles.phaseBadge}>{phaseLabel(phase)}</span>}
            </div>

            <div style={ovStyles.divider} />

            {/* Last round stats */}
            {lastRecord ? (
                <div style={ovStyles.statsBlock}>
                    <div style={ovStyles.statsLabel}>Letzte Runde</div>
                    <div style={ovStyles.statsGrid}>
                        <div style={ovStyles.stat}>
                            <span style={ovStyles.statValue}>{Math.round(lastRecord.accuracy * 100)}%</span>
                            <span style={ovStyles.statName}>Accuracy</span>
                        </div>
                        <div style={ovStyles.stat}>
                            <span style={ovStyles.statValue}>{lastRecord.hitsLanded}</span>
                            <span style={ovStyles.statName}>Treffer</span>
                        </div>
                        <div style={ovStyles.stat}>
                            <span style={ovStyles.statValue}>{lastRecord.hitsReceived}</span>
                            <span style={ovStyles.statName}>Bekommen</span>
                        </div>
                        <div style={ovStyles.stat}>
                            <span style={ovStyles.statValue}>{lastRecord.fitness.toFixed(1)}</span>
                            <span style={ovStyles.statName}>Fitness</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={ovStyles.statsLabel}>Noch keine Runde abgeschlossen</div>
            )}

            <div style={ovStyles.divider} />

            {/* Actions */}
            <div style={ovStyles.actions}>
                <button className="btn btn--ghost btn--sm" onClick={() => navigate('/Analytics')}>
                    Analytics →
                </button>
                <button className="btn btn--outline btn--c-danger btn--sm" onClick={handleReset}>
                    Neu starten
                </button>
            </div>
        </div>
    );
}

const ovStyles: Record<string, React.CSSProperties> = {
    emptyLayout: {
        display: 'flex',
        gap:     16,
        alignItems: 'stretch',
    },
    slot: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            12,
        border:         '1px dashed rgba(255,255,255,0.12)',
        borderRadius:   'var(--r-md)',
        padding:        '36px 28px',
        textAlign:      'center',
        minWidth:       180,
    },
    slotIcon: {
        fontSize:  40,
        opacity:   0.45,
    },
    slotTitle: {
        fontFamily:    'var(--font-mono)',
        fontSize:      13,
        fontWeight:    700,
        color:         'rgba(255,255,255,0.35)',
        letterSpacing: '0.04em',
    },
    slotSub: {
        fontSize:   11,
        color:      'rgba(255,255,255,0.18)',
        lineHeight: 1.7,
    },

    presetPanel: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        padding:       '18px',
        background:    'var(--surface)',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-md)',
    },
    presetHeading: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
    },
    presetBtns: {
        display: 'flex',
        gap:     8,
    },
    presetBtn: {
        flex:          1,
        padding:       '8px 0',
        border:        '1px solid',
        borderRadius:  'var(--r-sm)',
        cursor:        'pointer',
        fontFamily:    'var(--font-mono)',
        fontSize:      12,
        fontWeight:    700,
        letterSpacing: '0.04em',
        transition:    'all 0.15s ease',
    },
    presetDesc: {
        fontSize:   12,
        color:      'var(--text-muted)',
        lineHeight: 1.6,
        margin:     0,
        flex:       1,
    },
    presetStats: {
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 8,
        marginTop:           'auto',
    },
    presetStat: {
        display:        'flex',
        flexDirection:  'column',
        gap:            2,
        padding:        '8px 10px',
        background:     'rgba(255,255,255,0.03)',
        borderRadius:   'var(--r-sm)',
        border:         '1px solid rgba(255,255,255,0.05)',
    },
    presetStatLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      10,
        color:         'var(--text-muted)',
        letterSpacing: '0.06em',
    },
    presetStatValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   16,
        fontWeight: 700,
        color:      'rgba(255,255,255,0.7)',
    },

    card: {
        display:       'flex',
        flexDirection: 'column',
        gap:           16,
        padding:       '18px',
        background:    'var(--surface)',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-md)',
    },
    header: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-end',
    },
    roundLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
        marginBottom:  2,
    },
    roundValue: {
        fontFamily:  'var(--font-mono)',
        fontSize:    48,
        fontWeight:  700,
        color:       'var(--accent)',
        lineHeight:  1,
        textShadow:  '0 0 24px var(--accent-glow)',
    },
    phaseBadge: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        padding:       '4px 10px',
        borderRadius:  'var(--r-sm)',
        background:    'var(--accent-dim)',
        color:         'var(--accent)',
        letterSpacing: '0.06em',
        alignSelf:     'flex-start',
    },

    divider: {
        height:     1,
        background: 'var(--border)',
    },

    statsBlock: {
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
    },
    statsLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
    },
    statsGrid: {
        display:               'grid',
        gridTemplateColumns:   'repeat(4, 1fr)',
        gap:                   8,
    },
    stat: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        gap:            3,
        padding:        '10px 6px',
        background:     'rgba(255,255,255,0.03)',
        borderRadius:   'var(--r-sm)',
        border:         '1px solid rgba(255,255,255,0.06)',
    },
    statValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   18,
        fontWeight: 700,
        color:      'rgba(255,255,255,0.85)',
    },
    statName: {
        fontSize:   10,
        color:      'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
    },

    actions: {
        display: 'flex',
        gap:     8,
    },
};

// ---- Settings Tabs ----

const LOBBY_TABS = ['Übersicht', 'DNA', 'Algorithmus', 'Spieler'] as const;
type LobbyTab = typeof LOBBY_TABS[number];

const tabStyles: Record<string, React.CSSProperties> = {
    shell: {
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        minWidth:      0,
        flex:          1,
        minHeight:     0,
        overflow:      'hidden',
    },
    bar: {
        display:      'flex',
        gap:          4,
        marginBottom: 12,
    },
    tabActive: {
        padding:       '5px 14px',
        background:    'var(--accent-dim)',
        border:        '1px solid var(--accent)',
        borderRadius:  'var(--r-sm)',
        color:         'var(--accent)',
        cursor:        'pointer',
        fontSize:      '12px',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.04em',
    },
    tabInactive: {
        padding:       '5px 14px',
        background:    'transparent',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-sm)',
        color:         'var(--text-dim)',
        cursor:        'pointer',
        fontSize:      '12px',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.04em',
    },
    panel: {
        flex:      1,
        minHeight: 0,
        overflowY: 'auto',
    },
    box: {
        padding:      '16px',
        background:   'var(--surface)',
        borderRadius: 'var(--r-md)',
        border:       '1px solid var(--border)',
    },
    sectionLabel: {
        fontSize:      '11px',
        color:         'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        margin:        '0 0 10px 0',
        fontFamily:    'var(--font-mono)',
    },
    resetBtn: {
        marginTop:    '12px',
        padding:      '6px 16px',
        background:   'transparent',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        color:        'var(--text-muted)',
        cursor:       'pointer',
        fontFamily:   'var(--font)',
        fontSize:     '12px',
    },

};

// ---- Normal Lobby ----

function NormalLobby({ onBack }: { onBack: () => void }) {
    const navigate = useNavigate();
    const [tab, setTab] = useState<LobbyTab>('Übersicht');
    const [hasActiveGame, setHasActiveGame] = useState((gameStore.state?.roundNumber ?? 0) > 0);
    const { setShooterSettings } = useSettings();

    useEffect(() => {
        const sync = () => setHasActiveGame((gameStore.state?.roundNumber ?? 0) > 0);
        sync();
        return gameStore.subscribe(sync);
    }, []);

    return (
        <div style={lobbyStyles.page}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.brand}>
                    <div style={lobbyStyles.brandLogo}>SG</div>
                    <span style={lobbyStyles.brandName}>Shooter Game</span>
                </div>
                <ShooterPreview />
                <div style={lobbyStyles.previewLabel}>Live Preview</div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={lobbyStyles.title}>Solo Play</h1>
                </div>
                <div style={tabStyles.shell}>
                    <div style={tabStyles.bar}>
                        {LOBBY_TABS.map(t => (
                            <button key={t} onClick={() => setTab(t)}
                                style={tab === t ? tabStyles.tabActive : tabStyles.tabInactive}>
                                {t}
                            </button>
                        ))}
                    </div>
                    <div style={tabStyles.panel}>
                        {tab === 'Übersicht' && (
                            <>
                                <SoloPlayOverview />
                                <div style={{ ...tabStyles.box, marginTop: 10 }}>
                                    <p style={tabStyles.sectionLabel}>Spielrunde</p>
                                    <ShooterRoundSection />
                                </div>
                            </>
                        )}
                        {tab === 'DNA' && (
                            <>
                                <div style={tabStyles.box}>
                                    <p style={tabStyles.sectionLabel}>Starter DNA</p>
                                    <ShooterDnaSection />
                                </div>
                                <button style={tabStyles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>Zurücksetzen</button>
                            </>
                        )}
                        {tab === 'Algorithmus' && <EASettingsPanel />}
                        {tab === 'Spieler' && (
                            <>
                                <div style={tabStyles.box}>
                                    <ShooterPlayerSection />
                                </div>
                                <button style={tabStyles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>Zurücksetzen</button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div style={lobbyStyles.leftBottom}>
                <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
            </div>
            <div style={lobbyStyles.rightBottom}>
                <button className="btn btn--primary" onClick={() => navigate('/ShooterGame')}>
                    {hasActiveGame ? 'Fortsetzen →' : 'Spielen →'}
                </button>
            </div>
        </div>
    );
}

// ---- Raidboss Lobby ----

const RB = '#a855f7';

function RaidbossLobby({ onBack }: { onBack: () => void }) {
    const navigate = useNavigate();
    const [doc,     setDoc]     = useState<RaidbossDoc | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getRaidbossStatus().then(setDoc).catch(() => {});
    }, []);

    const handlePlay = async () => {
        setLoading(true);
        try {
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

    const evalCount  = doc ? doc.individuals.filter(i => i.fitness !== null).length : 0;
    const total      = doc?.populationSize ?? 0;
    const nextIndex  = doc ? doc.individuals.findIndex(i => i.fitness === null) : -1;
    const progress   = total > 0 ? evalCount / total : 0;
    const genTotal   = doc ? (doc.generation - 1) * total + evalCount : 0;

    return (
        <div style={lobbyStyles.page}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.brand}>
                    <div style={{ ...lobbyStyles.brandLogo, color: RB, background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.25)' }}>SG</div>
                    <span style={lobbyStyles.brandName}>Shooter Game</span>
                </div>
                <ShooterPreview />
                <div style={lobbyStyles.previewLabel}>Live Preview</div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={{ ...lobbyStyles.title, color: RB }}>Community Raidboss</h1>
                    <p style={lobbyStyles.description}>
                        Jeder Spieler bewertet einen Agenten der Community-Population.
                        Sind alle bewertet, evoliert die Population automatisch zur nächsten Generation.
                    </p>
                </div>

                {doc === null ? (
                    <div style={rbStyles.emptyState}>
                        <span style={rbStyles.emptyIcon}>🧬</span>
                        <span style={rbStyles.emptyTitle}>Noch kein Boss trainiert</span>
                        <span style={rbStyles.emptySub}>Sei der Erste und starte die erste Generation.</span>
                    </div>
                ) : (
                    <div style={rbStyles.statusPanel}>

                        {/* Generation badge */}
                        <div style={rbStyles.genRow}>
                            <span style={rbStyles.genLabel}>Generation</span>
                            <span style={rbStyles.genValue}>{doc.generation}</span>
                            <span style={rbStyles.genTotal}>{genTotal} Individuen gesamt bewertet</span>
                        </div>

                        {/* Progress bar */}
                        <div style={rbStyles.progressBlock}>
                            <div style={rbStyles.progressHeader}>
                                <span style={rbStyles.progressLabel}>Fortschritt diese Generation</span>
                                <span style={rbStyles.progressCount}>{evalCount} / {total}</span>
                            </div>
                            <div style={rbStyles.progressTrack}>
                                <div style={{ ...rbStyles.progressFill, width: `${progress * 100}%` }} />
                            </div>
                        </div>

                        {/* Individual dots */}
                        <div style={rbStyles.dotsRow}>
                            {doc.individuals.map((ind, i) => {
                                const isDone = ind.fitness !== null;
                                const isNext = i === nextIndex;
                                return (
                                    <div
                                        key={i}
                                        title={`Individuum ${i + 1}${isDone ? ` · Fitness ${ind.fitness?.toFixed(2)}` : isNext ? ' · Als nächstes' : ''}`}
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

                        {/* Next up */}
                        {nextIndex !== -1 && (
                            <div style={rbStyles.nextUp}>
                                <span style={rbStyles.nextUpLabel}>Als nächstes</span>
                                <span style={rbStyles.nextUpValue}>Individuum {nextIndex + 1} von {total}</span>
                            </div>
                        )}
                        {nextIndex === -1 && (
                            <div style={rbStyles.nextUp}>
                                <span style={rbStyles.nextUpLabel}>Status</span>
                                <span style={{ ...rbStyles.nextUpValue, color: '#4ade80' }}>Alle bewertet — Evolution läuft</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={lobbyStyles.leftBottom}>
                <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
            </div>

            <div style={lobbyStyles.rightBottom}>
                <button
                    className="btn btn--outline"
                    style={{ '--btn-color': RB } as React.CSSProperties}
                    onClick={handlePlay}
                    disabled={loading}
                >
                    {loading ? 'Lade...' : 'Raidboss kämpfen →'}
                </button>
            </div>
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
    emptySub:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 },

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
        fontSize:   32,
        fontWeight: 700,
        color:      RB,
        lineHeight: 1,
        textShadow: '0 0 20px rgba(168,85,247,0.4)',
    },
    genTotal: {
        fontSize: 12,
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
        fontSize:   13,
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
        fontSize:   13,
        fontWeight: 700,
        color:      'rgba(192,158,255,0.9)',
    },
};

// ---- Horde Lobby ----

function HordeLobby({ onBack }: { onBack: () => void }) {
    return (
        <div style={lobbyStyles.page}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.brand}>
                    <div style={{ ...lobbyStyles.brandLogo, color: '#fb923c', background: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.25)' }}>SG</div>
                    <span style={lobbyStyles.brandName}>Shooter Game</span>
                </div>
                <ShooterPreview />
                <div style={lobbyStyles.previewLabel}>Live Preview</div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={{ ...lobbyStyles.title, color: '#fb923c' }}>Horde Mode</h1>
                    <p style={lobbyStyles.description}>
                        Überlebe endlose Wellen immer stärker werdender Agenten.
                        Jede Welle wird schwieriger — wie lange kannst du standhalten?
                    </p>
                </div>
                <div style={{
                    display:       'flex',
                    flexDirection: 'column',
                    gap:           8,
                    padding:       '20px',
                    background:    'rgba(251,146,60,0.05)',
                    border:        '1px dashed rgba(251,146,60,0.25)',
                    borderRadius:  10,
                }}>
                    <span style={{ fontSize: 28 }}>🚧</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'rgba(253,186,116,0.9)' }}>In Entwicklung</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
                        Horde Mode ist noch nicht implementiert. Waves, Schwierigkeitskurve und Scoring kommen in einem späteren Update.
                    </span>
                </div>
            </div>

            <div style={lobbyStyles.leftBottom}>
                <button className="btn btn--outline btn--c-danger" onClick={onBack}>
                    ← Modus
                </button>
            </div>

            <div style={lobbyStyles.rightBottom}>
                <div style={lobbyStyles.bottomBtns}>
                    <button
                        className="btn btn--outline"
                        style={{ '--btn-color': '#fb923c' } as React.CSSProperties}
                        disabled
                    >
                        Bald verfügbar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ---- Shared Lobby Styles (same layout for all modes) ----

const lobbyStyles: Record<string, React.CSSProperties> = {
    page: {
        display:             'grid',
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows:    '1fr auto',
        width:               '100%',
        height:              '100%',
        columnGap:           '32px',
        padding:             '24px 32px',
        boxSizing:           'border-box',
        overflow:            'hidden',
    },
    leftTop: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '12px',
        minHeight:     0,
        overflow:      'hidden',
    },
    rightTop: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
        minWidth:      0,
        minHeight:     0,
        overflow:      'hidden',
    },
    leftBottom: {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 0 0',
    },
    rightBottom: {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 0 0',
    },
    brand: {
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '8px',
        paddingBottom: '12px',
        borderBottom:  '1px solid rgba(255,255,255,0.07)',
    },
    brandLogo: {
        width:          '48px',
        height:         '48px',
        borderRadius:   '12px',
        background:     'rgba(79, 195, 247, 0.12)',
        border:         '1px solid rgba(79, 195, 247, 0.25)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '15px',
        fontWeight:     700,
        letterSpacing:  '0.05em',
        color:          '#4fc3f7',
        fontFamily:     'monospace',
    },
    brandName: {
        fontSize:      '11px',
        fontWeight:    600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        color:         'rgba(255,255,255,0.28)',
        textAlign:     'center' as const,
        fontFamily:    'monospace',
    },
    previewLabel: {
        fontSize:      '11px',
        color:         'rgba(255,255,255,0.25)',
        textAlign:     'center',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily:    'monospace',
    },
    header: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
    },
    title: {
        fontFamily: 'monospace',
        fontSize:   '24px',
        fontWeight: 500,
        color:      'rgba(255,255,255,0.9)',
        margin:     0,
    },
    description: {
        fontFamily:  'monospace',
        fontSize:    '13px',
        color:       'rgba(255,255,255,0.5)',
        lineHeight:  1.5,
        margin:      0,
    },
};

// ---- Top Bar (lobby modes only) ----

function TopBar({ onBack }: { onBack: () => void }) {
    return (
        <div style={topBarStyles.bar}>
            <div style={topBarStyles.side}>
                <button className="btn btn--ghost btn--sm" onClick={onBack}>
                    ← Modus
                </button>
            </div>

            <div style={topBarStyles.center}>
                <span style={topBarStyles.logoMark}>SG</span>
                <span style={topBarStyles.centerTitle}>Shooter vs EA</span>
            </div>

            <div style={{ ...topBarStyles.side, justifyContent: 'flex-end' }}>
                <HintToggle />
            </div>
        </div>
    );
}

const topBarStyles: Record<string, React.CSSProperties> = {
    bar: {
        width:          '100%',
        height:         56,
        flexShrink:     0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 16px',
        boxSizing:      'border-box',
        background:     'rgba(0,0,0,0.35)',
        borderBottom:   '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
    },
    side: {
        display:    'flex',
        alignItems: 'center',
        minWidth:   120,
    },
    center: {
        display:    'flex',
        alignItems: 'center',
        gap:        10,
    },
    logoMark: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.06em',
        color:         '#4fc3f7',
        background:    'rgba(79,195,247,0.12)',
        border:        '1px solid rgba(79,195,247,0.22)',
        borderRadius:  6,
        padding:       '2px 7px',
    },
    centerTitle: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      13,
        fontWeight:    600,
        letterSpacing: '0.08em',
        color:         'rgba(255,255,255,0.55)',
        textTransform: 'uppercase',
    },
};

// ---- Root ----

function ShooterLobbyContent() {
    const location = useLocation();
    const initialMode = (location.state as { mode?: LobbyMode } | null)?.mode ?? null;
    const [mode, setMode] = useState<LobbyMode | null>(initialMode);
    const navigate = useNavigate();

    if (mode === null) {
        return (
            <GameModeSelectorLayout
                title="SHOOTER VS EA"
                subtitle="Wähle deinen Spielmodus"
                logoText="SG"
                modes={SHOOTER_MODES}
                onSelect={(id) => setMode(id as LobbyMode)}
                onBack={() => navigate('/dashboard')}
                backLabel="← Dashboard"
                rightContent={<HintToggle />}
            />
        );
    }

    return (
        <PageContainer>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                <TopBar onBack={() => setMode(null)} />
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    {mode === 'normal'   && <NormalLobby   onBack={() => setMode(null)} />}
                    {mode === 'raidboss' && <RaidbossLobby onBack={() => setMode(null)} />}
                    {mode === 'horde'    && <HordeLobby    onBack={() => setMode(null)} />}
                </div>
            </div>
        </PageContainer>
    );
}

export default function ShooterLobbyPage() {
    return (
        <HintsProvider>
            <ShooterLobbyContent />
            <HintLayer />
        </HintsProvider>
    );
}
