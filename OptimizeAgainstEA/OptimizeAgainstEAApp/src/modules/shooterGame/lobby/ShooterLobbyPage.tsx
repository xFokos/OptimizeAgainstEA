import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { GameModeSelectorLayout } from '../../../components/layout/GameModeSelectorLayout';
import { HintsProvider, HintToggle, HintLayer, useHints } from '../../../components/hints';
import { ShooterPlayerSection, ShooterRoundSection } from '../settings/ShooterSettings';
import { useSettings, resetShooterSettings } from '../../../context/SettingsContext';
import { EASettingsPanel } from '../../../components/settings/EASettings';
import { makeInitialGameState } from '../game/makeGameState';
import { vec } from '../game/core/vec';
import { DNA_INDEX, DNA_NAMES, GAME_CONFIG } from '../shooter.types';
import { initPopulation } from '../game/ga/population';
import { gameStore } from '../game/gameStore';
import { analyticsStore } from '../game/analyticsStore';
import { getRaidbossStatus, claimRaidbossSlot } from '../game/raidbossStore';
import type { RaidbossDoc } from '../game/raidbossStore';

// ---- Mobile-Breakpoint Hook ----

function useMobile(bp = 768) {
    const [mob, setMob] = useState(() => window.innerWidth < bp);
    useEffect(() => {
        const h = () => setMob(window.innerWidth < bp);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, [bp]);
    return mob;
}

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
        const ctx = canvas.getContext('2d', { alpha: false });
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

        // Statischer Hintergrund gecacht – einmal zeichnen, dann per drawImage kopieren
        const bgCache = document.createElement('canvas');
        bgCache.width  = PREVIEW_W;
        bgCache.height = PREVIEW_H;
        const bgCtx = bgCache.getContext('2d')!;
        bgCtx.fillStyle = '#0f0f1a';
        bgCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        bgCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        bgCtx.lineWidth   = 1;
        bgCtx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { bgCtx.moveTo(0, y); bgCtx.lineTo(PREVIEW_W, y); }
        bgCtx.stroke();
        bgCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

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

        // Bullets gebündelt nach Farbe, kein shadowBlur
        const drawBullets = () => {
            const groups: Record<string, PreviewBullet[]> = {};
            for (const b of bullets) {
                (groups[b.color] ??= []).push(b);
            }
            for (const [color, group] of Object.entries(groups)) {
                ctx.fillStyle = color;
                ctx.beginPath();
                for (const b of group) {
                    ctx.moveTo(b.pos.x + 4, b.pos.y);
                    ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
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
            // Preview braucht nur 30fps (rein dekorativ).
            // Threshold 31ms statt 33.33ms damit auf 60Hz-Displays (16.67ms/Frame) nie ein Frame
            // knapp unter dem Threshold liegt und das Preview unregelmäßig läuft.
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
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
                    if (b.lifetime <= 0 || !Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.y) || b.pos.x <= 0 || b.pos.x >= PREVIEW_W || b.pos.y <= 0 || b.pos.y >= PREVIEW_H)
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

// ---- Fullscreen vor dem Navigieren zum Spiel anfordern ----
// Chrome on Android erlaubt orientation.lock nur in Fullscreen → innerhalb des User-Gesture-Kontexts aufrufen

async function enterGameFullscreen() {
    // pointer: coarse = Touch als primäres Eingabegerät (Phones, Tablets)
    // zuverlässiger als Screen-Größe, die bei großen Tablets versagt
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;
    if (!document.fullscreenElement) {
        try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch {}
    }
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

// DNA-Reihenfolge: AGGRESSION, DODGE, ACCURACY, RANGE, SPEED, LEAD, FIRE_RATE, BULLET_SPEED
const PRESETS = [
    {
        id:       'einfach',
        label:    'Einfach',
        color:    '#4ade80',
        desc:     'Der EA lernt langsam und ohne Vorsimulation.',
        dna:      [0.2, 0.2, 0.2, 0.4, 0.2, 0.2, 0.2, 0.2],
        mutation: 0.05,
        strength: 0.1,
        presim:   0,
    },
    {
        id:       'mittel',
        label:    'Mittel',
        color:    '#facc15',
        desc:     'Ausgewogener Start mit 1 Presim-Generation.',
        dna:      [0.2, 0.25, 0.25, 0.4, 0.25, 0.25, 0.25, 0.25],
        mutation: 0.15,
        strength: 0.2,
        presim:   1,
    },
    {
        id:       'schwer',
        label:    'Schwer',
        color:    '#f87171',
        desc:     'Der EA simuliert 3 Generationen gegen deinen Spielstil.',
        dna:      [0.2, 0.3, 0.3, 0.4, 0.3, 0.3, 0.35, 0.3],
        mutation: 0.25,
        strength: 0.3,
        presim:   3,
    },
] as const;

type PresetId = typeof PRESETS[number]['id'] | 'custom';

// ---- Solo Play Overview (tab 1) ----

interface SoloPlayOverviewProps {
    selectedPreset:    PresetId;
    setSelectedPreset: (p: PresetId) => void;
}

function SoloPlayOverview({ selectedPreset, setSelectedPreset }: SoloPlayOverviewProps) {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const [round, setRound]     = useState(gameStore.state?.roundNumber ?? 0);
    const [hasGame, setHasGame] = useState(!!gameStore.state);
    const [lastRecord, setLastRecord] = useState(analyticsStore.rounds.at(-1) ?? null);
    const { shooterSettings, setShooterSettings, eaSettings, setEaSettings } = useSettings();
    const { showHint } = useHints();

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
        setShooterSettings({ ...shooterSettings, starterDna: [...p.dna] });
        setEaSettings({ ...eaSettings, mutationRate: p.mutation, mutationStrength: p.strength, presimGenerations: p.presim });
    };

    // Wenn Settings manuell geändert werden → zurück zu Custom
    useEffect(() => {
        if (selectedPreset === 'custom') return;
        const active = PRESETS.find(p => p.id === selectedPreset);
        if (!active) return;
        const dnaMatch = active.dna.every((v, i) => Math.abs(v - (shooterSettings.starterDna[i] ?? 0)) < 0.001);
        const mutMatch = Math.abs(active.mutation - eaSettings.mutationRate) < 0.001 &&
                         Math.abs(active.strength  - eaSettings.mutationStrength) < 0.001;
        const presimMatch = active.presim === eaSettings.presimGenerations;
        if (!dnaMatch || !mutMatch || !presimMatch) setSelectedPreset('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shooterSettings.starterDna, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.presimGenerations]);

    const activePreset = PRESETS.find(p => p.id === selectedPreset) ?? null;

    const showActiveDna = round > 0 && !!gameStore.state?.agent.dna;
    const displayDna    = showActiveDna ? gameStore.state.agent.dna : shooterSettings.starterDna;

    const [displayedDna, setDisplayedDna] = useState<number[]>([...displayDna]);
    const animTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);
    const prevRoundRef = useRef(round);

    useEffect(() => {
        const roundIncreased = round > prevRoundRef.current;
        prevRoundRef.current = round;

        if (!roundIncreased || !showActiveDna) {
            setDisplayedDna([...displayDna]);
        } else {
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

    const updateDna = (index: number, value: number) => {
        if (round > 0 && hasGame) showHint('shooter.dnaChangeDuringRound');
        const newDna = [...displayDna];
        newDna[index] = value;
        setShooterSettings({ ...shooterSettings, starterDna: newDna });
        if (gameStore.state) {
            const newPop  = initPopulation(newDna);
            const prevGen = gameStore.state.population?.generation ?? 1;
            gameStore.state = {
                ...gameStore.state,
                population: { ...newPop, generation: prevGen },
                agent:      { ...gameStore.state.agent, dna: newDna },
            };
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 16 } : ovStyles.layout}>
            <div style={ovStyles.slot}>
            {hasGame ? (
                    <div style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Runde</div>
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
                                    <span style={ovStyles.statsCompactLabel}>Score (EA : Du)</span>
                                    <span style={ovStyles.statsCompactValue}>{lastRecord.hitsLanded} : {lastRecord.hitsReceived}</span>
                                </div>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>EA Fitness</span>
                                    <span style={ovStyles.statsCompactValue}>{lastRecord.fitness.toFixed(1)}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ ...ovStyles.statsCompactLabel, flex: 1 }}>Noch keine Runde abgeschlossen</div>
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
                            <span style={ovStyles.slotTitle}>Kein aktives Spiel</span>
                            <span style={ovStyles.slotSub}>
                                Wähle einen Schwierigkeitsgrad<br />
                                und starte deine erste Runde.
                            </span>
                        </div>
                        <button
                            className="btn btn--outline btn--sm"
                            style={{ width: '100%', marginTop: 16 }}
                            onClick={handlePrepare}
                        >
                            Runde aufbauen →
                        </button>
                    </div>
                )}
            </div>
            <div style={ovStyles.placeholder}>
                <span style={ovStyles.placeholderHeading}>Schwierigkeitsgrad</span>
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
                        : 'Eigene Konfiguration — Einstellungen manuell angepasst.'}
                </p>
                <div style={ovStyles.divider} />
                <span style={ovStyles.placeholderHeading}>Rundeneinstellungen</span>
                <ShooterRoundSection onBeforeChange={() => { if (round > 0 && hasGame) showHint('shooter.dnaChangeDuringRound'); }} />
            </div>
        </div>

        {/* DNA-Sektion */}
        <div style={tabStyles.box}>
            <p style={{ ...tabStyles.sectionLabel, marginBottom: 12 }}>
                {showActiveDna ? 'Aktuelle DNA' : 'Starter DNA'}
            </p>
            <div style={isMobile ? { display: 'grid', gridTemplateColumns: '1fr', gap: '8px 16px' } : ovStyles.dnaGrid}>
                {DNA_NAMES.map((name, i) => (
                    <div key={i} style={ovStyles.dnaGridItem}>
                        <div style={ovStyles.dnaGridHeader}>
                            <span style={ovStyles.dnaGridLabel}>{name}</span>
                            <span style={{ ...ovStyles.dnaGridValue, transition: 'color 0.15s ease' }}>
                                {(displayedDna[i] ?? 0).toFixed(2)}
                            </span>
                        </div>
                        <input
                            type="range" min={0} max={1} step={0.01}
                            value={displayedDna[i] ?? 0}
                            onChange={e => updateDna(i, parseFloat(e.target.value))}
                            className="slider"
                            style={{ width: '100%', cursor: 'pointer' }}
                        />
                    </div>
                ))}
            </div>
        </div>

        </div>
    );
}

const ovStyles: Record<string, React.CSSProperties> = {
    layout: {
        display: 'flex',
        gap:     16,
        height:  260,
    },
    slot: {
        flex:          '0 0 50%',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
    },
    placeholder: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        padding:       '18px',
        background:    'var(--surface)',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-md)',
        overflow:      'hidden',
    },
    placeholderHeading: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
        flexShrink:    0,
    },
    presetBtns: {
        display:   'flex',
        gap:       6,
        flexShrink: 0,
    },
    presetBtn: {
        flex:          1,
        padding:       '6px 0',
        border:        '1px solid',
        borderRadius:  'var(--r-sm)',
        cursor:        'pointer',
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.04em',
        transition:    'all 0.15s ease',
    },
    presetDesc: {
        fontSize:   11,
        color:      'var(--text-muted)',
        lineHeight: 1.5,
        margin:     0,
        flexShrink: 0,
    },
    emptySlot: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        border:        '1px dashed rgba(255,255,255,0.12)',
        borderRadius:  'var(--r-md)',
        padding:       '32px 28px 24px',
        textAlign:     'center',
    },
    activeSlot: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        padding:       '18px',
        background:    'var(--surface)',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-md)',
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

    header: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        flexShrink:     0,
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


    divider: {
        height:     1,
        background: 'var(--border)',
    },
    dnaRow: {
        display:     'flex',
        gap:         3,
        flex:        1,
        flexWrap:    'wrap' as const,
        alignItems:  'center',
        marginLeft:  10,
    },
    dnaLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.06em',
        color:         'rgba(255,255,255,0.25)',
        marginRight:   4,
        flexShrink:    0,
    },
    dnaCell: {
        fontFamily: 'var(--font-mono)',
        fontSize:   9,
        color:      'rgba(255,255,255,0.35)',
        lineHeight: 1,
    },

    dnaGrid: {
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                 '8px 16px',
    },
    dnaGridItem: {
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
    },
    dnaGridHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
    },
    dnaGridLabel: {
        fontFamily:   'var(--font-mono)',
        fontSize:     10,
        color:        'var(--text-dim)',
        whiteSpace:   'nowrap' as const,
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        letterSpacing: '0.04em',
    },
    dnaGridValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   10,
        color:      'var(--accent)',
        flexShrink: 0,
    },

    statsCompact: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap:           4,
        minHeight:     0,
    },
    statsCompactRow: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        gap:            8,
    },
    statsCompactLabel: {
        fontFamily: 'var(--font-mono)',
        fontSize:   11,
        color:      'var(--text-muted)',
    },
    statsCompactValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   12,
        fontWeight: 700,
        color:      'rgba(255,255,255,0.8)',
    },

};

// ---- Settings Tabs ----

const LOBBY_TABS = ['Übersicht', 'Algorithmus', 'Performance', 'Spieler'] as const;
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

// ---- Performance Tab ----

function PerformanceTab() {
    const { eaSettings: s, setEaSettings } = useSettings();
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={tabStyles.box}>
                <p style={tabStyles.sectionLabel}>Aufzeichnung</p>
                <div style={perfStyles.row}>
                    <label style={perfStyles.label}>Round record limit</label>
                    <input
                        type="range" min={5} max={50} step={5}
                        value={s.maxAnalyticsRounds}
                        onChange={e => setEaSettings({ ...s, maxAnalyticsRounds: parseInt(e.target.value) })}
                        className="slider"
                        style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <span style={perfStyles.value}>{s.maxAnalyticsRounds}</span>
                </div>
            </div>
        </div>
    );
}

const perfStyles: Record<string, React.CSSProperties> = {
    row: {
        display:      'flex',
        alignItems:   'center',
        gap:          12,
        marginBottom: 10,
    },
    label: {
        width:      160,
        fontSize:   13,
        flexShrink: 0,
        color:      'var(--text-dim)',
    },
    value: {
        width:     36,
        fontSize:  13,
        textAlign: 'right' as const,
        color:     'var(--accent)',
    },
};

// ---- Normal Lobby ----

function NormalLobby({ onBack }: { onBack: () => void }) {
    const navigate = useNavigate();
    const [tab, setTab] = useState<LobbyTab>('Übersicht');
    const [hasActiveGame, setHasActiveGame] = useState(!!gameStore.state);
    const [selectedPreset, setSelectedPreset] = useState<PresetId>('custom');
    const { setShooterSettings } = useSettings();
    const isMobile = useMobile();

    useEffect(() => {
        const sync = () => setHasActiveGame(!!gameStore.state);
        sync();
        return gameStore.subscribe(sync);
    }, []);

    const tabBar = (
        <div style={{ ...tabStyles.bar, overflowX: 'auto', flexWrap: 'nowrap' as const, flexShrink: 0 }}>
            {LOBBY_TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                    style={{ ...(tab === t ? tabStyles.tabActive : tabStyles.tabInactive), flexShrink: 0 }}>
                    {t}
                </button>
            ))}
        </div>
    );

    const tabContent = (
        <div style={{ ...tabStyles.panel, overflowY: isMobile ? 'visible' : 'auto' }}>
            {tab === 'Übersicht' && <SoloPlayOverview selectedPreset={selectedPreset} setSelectedPreset={setSelectedPreset} />}
            {tab === 'Algorithmus' && <EASettingsPanel />}
            {tab === 'Performance' && <PerformanceTab />}
            {tab === 'Spieler' && (
                <>
                    <div style={tabStyles.box}>
                        <ShooterPlayerSection />
                    </div>
                    <button style={tabStyles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>Zurücksetzen</button>
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
                    <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
                    <button className="btn btn--primary" style={{ flex: 1 }} onClick={async () => { await enterGameFullscreen(); navigate('/ShooterGame'); }}>
                        {hasActiveGame ? 'Fortsetzen →' : 'Spielen →'}
                    </button>
                </div>
            </div>
        );
    }

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
                    {tabBar}
                    {tabContent}
                </div>
            </div>

            <div style={lobbyStyles.leftBottom}>
                <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
            </div>
            <div style={lobbyStyles.rightBottom}>
                <button className="btn btn--primary" onClick={async () => { await enterGameFullscreen(); navigate('/ShooterGame'); }}>
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
    const isMobile = useMobile();
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

    const evalCount  = doc ? doc.individuals.filter(i => i.fitness !== null).length : 0;
    const total      = doc?.populationSize ?? 0;
    const nextIndex  = doc ? doc.individuals.findIndex(i => i.fitness === null) : -1;
    const progress   = total > 0 ? evalCount / total : 0;
    const genTotal   = doc ? (doc.generation - 1) * total + evalCount : 0;

    const statusContent = doc === null ? (
        <div style={rbStyles.emptyState}>
            <span style={rbStyles.emptyIcon}>🧬</span>
            <span style={rbStyles.emptyTitle}>Noch kein Boss trainiert</span>
            <span style={rbStyles.emptySub}>Sei der Erste und starte die erste Generation.</span>
        </div>
    ) : (
        <div style={rbStyles.statusPanel}>
            <div style={rbStyles.genRow}>
                <span style={rbStyles.genLabel}>Generation</span>
                <span style={rbStyles.genValue}>{doc.generation}</span>
                <span style={rbStyles.genTotal}>{genTotal} Individuen gesamt bewertet</span>
            </div>
            <div style={rbStyles.progressBlock}>
                <div style={rbStyles.progressHeader}>
                    <span style={rbStyles.progressLabel}>Fortschritt diese Generation</span>
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
            {nextIndex !== -1 ? (
                <div style={rbStyles.nextUp}>
                    <span style={rbStyles.nextUpLabel}>Als nächstes</span>
                    <span style={rbStyles.nextUpValue}>Individuum {nextIndex + 1} von {total}</span>
                </div>
            ) : (
                <div style={rbStyles.nextUp}>
                    <span style={rbStyles.nextUpLabel}>Status</span>
                    <span style={{ ...rbStyles.nextUpValue, color: '#4ade80' }}>Alle bewertet — Evolution läuft</span>
                </div>
            )}
        </div>
    );

    const playBtn = (
        <button
            className="btn btn--outline"
            style={{ '--btn-color': RB } as React.CSSProperties}
            onClick={handlePlay}
            disabled={loading}
        >
            {loading ? 'Lade...' : 'Raidboss kämpfen →'}
        </button>
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, color: RB, margin: 0 }}>Community Raidboss</h1>
                <p style={{ ...lobbyStyles.description, margin: 0 }}>
                    Jeder Spieler bewertet einen Agenten der Community-Population.
                    Sind alle bewertet, evoliert die Population automatisch zur nächsten Generation.
                </p>
                {statusContent}
                <div style={mobileBtnsStyle}>
                    <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
                    <div style={{ flex: 1 }}>{playBtn}</div>
                </div>
            </div>
        );
    }

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
                {statusContent}
            </div>

            <div style={lobbyStyles.leftBottom}>
                <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
            </div>
            <div style={lobbyStyles.rightBottom}>
                {playBtn}
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
    const isMobile = useMobile();

    const wip = (
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
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, color: '#fb923c', margin: 0 }}>Horde Mode</h1>
                <p style={{ ...lobbyStyles.description, margin: 0 }}>
                    Überlebe endlose Wellen immer stärker werdender Agenten.
                    Jede Welle wird schwieriger — wie lange kannst du standhalten?
                </p>
                {wip}
                <div style={mobileBtnsStyle}>
                    <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
                    <button className="btn btn--outline" style={{ flex: 1, '--btn-color': '#fb923c' } as React.CSSProperties} disabled>
                        Bald verfügbar
                    </button>
                </div>
            </div>
        );
    }

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
                {wip}
            </div>

            <div style={lobbyStyles.leftBottom}>
                <button className="btn btn--outline btn--c-danger" onClick={onBack}>← Modus</button>
            </div>
            <div style={lobbyStyles.rightBottom}>
                <button
                    className="btn btn--outline"
                    style={{ '--btn-color': '#fb923c' } as React.CSSProperties}
                    disabled
                >
                    Bald verfügbar
                </button>
            </div>
        </div>
    );
}

// ---- Shared Mobile Styles ----

const mobilePageStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
    padding:       '16px',
    boxSizing:     'border-box',
};

const mobileBtnsStyle: React.CSSProperties = {
    display:    'flex',
    gap:        10,
    flexShrink: 0,
    paddingTop: 4,
};

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
    const isMobile = useMobile();

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
                <div style={{ flex: 1, minHeight: 0, overflow: isMobile ? 'auto' : 'hidden' }}>
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
