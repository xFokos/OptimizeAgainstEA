import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { ShooterSettingsPanel } from '../settings/ShooterSettings';
import { EASettingsPanel } from '../../../components/settings/EASettings';
import { vec } from '../game/core/vec';
import { useSettings } from '../../../context/SettingsContext';
import { DNA_INDEX, GAME_CONFIG } from '../shooter.types';
import type { GamePhase } from '../shooter.types';
import { gameStore } from '../game/gameStore';
import { analyticsStore } from '../game/analyticsStore';
import { getRaidbossStatus, claimRaidbossSlot } from '../game/raidbossStore';
import type { RaidbossDoc } from '../game/raidbossStore';

// ---- Mini Preview Canvas ----
// Zeigt zwei Agenten die gegeneinander kämpfen

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

const PREVIEW_W = 400;
const PREVIEW_H = 400;

function ShooterPreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { shooterSettings } = useSettings();

    // Ref so the animation loop always reads latest DNA without restarting
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
            // Scale preferred range to preview canvas size
            const prefRange  = 60 + dna[DNA_INDEX.PREFERRED_RANGE] * 150;

            const diff = vec.sub(target.pos, agent.pos);
            const dist = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
            const toTarget = dist > 1 ? vec.scale(diff, 1 / dist) : { x: 1, y: 0 };

            // Orbit perpendicular to target
            const orbitAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const orbitVel   = { x: Math.cos(orbitAngle) * speed, y: Math.sin(orbitAngle) * speed };

            // Range correction: push away if too close, pull in if too far
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
            }}
        />
    );
}

// ---- Runden-Status Badge ----

function phaseLabel(phase: GamePhase): string {
    if (phase === 'playing')  return 'Läuft';
    if (phase === 'roundEnd') return 'Beendet';
    if (phase === 'evolving') return 'Evolving';
    return '';
}

// ---- Lobby Page ----

export default function ShooterLobbyPage() {
    const navigate = useNavigate();

    const [savedRound, setSavedRound] = useState(gameStore.state?.roundNumber ?? 0);
    const [savedPhase, setSavedPhase] = useState<GamePhase | null>(
        gameStore.state ? gameStore.state.phase : null,
    );
    const [raidbossDoc,     setRaidbossDoc]     = useState<RaidbossDoc | null>(null);
    const [raidbossLoading, setRaidbossLoading] = useState(false);

    useEffect(() => {
        const sync = () => {
            const s = gameStore.state;
            setSavedRound(s?.roundNumber ?? 0);
            setSavedPhase(s ? s.phase : null);
        };
        sync();
        getRaidbossStatus().then(setRaidbossDoc).catch(() => {});
        return gameStore.subscribe(sync);
    }, []);

    const hasActiveGame = savedRound > 0;

    const handleContinue = () => navigate('/ShooterGame');

    const handleReset = () => {
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        analyticsStore.clear();
        navigate('/ShooterGame');
    };

    const handleRaidboss = async () => {
        setRaidbossLoading(true);
        try {
            await claimRaidbossSlot();
            // Raidboss-Modus startet immer fresh
            gameStore.state = null as unknown as typeof gameStore.state;
            gameStore.notify();
            analyticsStore.clear();
            navigate('/ShooterGame');
        } catch (err) {
            console.error('[Raidboss] Fehler:', err);
            setRaidbossLoading(false);
        }
    };

    return (
        <PageContainer>
            <div style={styles.page}>

                {/* Links oben – Brand + Preview */}
                <div style={styles.leftTop}>
                    <div style={styles.brand}>
                        <div style={styles.brandLogo}>SG</div>
                        <span style={styles.brandName}>Shooter Game</span>
                    </div>
                    <ShooterPreview />
                    <div style={styles.previewLabel}>Live Preview</div>
                </div>

                {/* Rechts oben – Header + Settings */}
                <div style={styles.rightTop}>
                    <div style={styles.header}>
                        <h1 style={styles.title}>Shooter vs EA</h1>
                        <p style={styles.description}>
                            Kämpfe gegen einen genetischen Algorithmus der sich nach jeder Runde
                            an deinen Spielstil anpasst. Wie lange kannst du die Oberhand behalten?
                        </p>
                    </div>
                    <div style={styles.settings}>
                        <EASettingsPanel />
                        <ShooterSettingsPanel />
                    </div>
                </div>

                {/* Links unten – Back */}
                <div style={styles.leftBottom}>
                    <button style={styles.backBtn} onClick={() => navigate('/dashboard')}>
                        ← Back
                    </button>
                </div>

                {/* Rechts unten – Session-Status + Buttons */}
                <div style={styles.rightBottom}>
                    <div style={styles.bottomBtns}>
                        {hasActiveGame ? (
                            <div style={styles.sessionBlock}>
                                <div style={styles.sessionStatus}>
                                    <span style={styles.sessionDot} />
                                    <span style={styles.sessionText}>
                                        Runde {savedRound}
                                        {savedPhase ? ` · ${phaseLabel(savedPhase)}` : ''}
                                    </span>
                                </div>
                                <div style={styles.sessionBtns}>
                                    <button style={styles.startBtn} onClick={handleContinue}>
                                        Fortsetzen →
                                    </button>
                                    <button style={styles.resetBtn} onClick={handleReset}>
                                        Neu starten
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button style={styles.startBtn} onClick={() => navigate('/ShooterGame')}>
                                Spielen →
                            </button>
                        )}

                        <div style={styles.raidbossCard}>
                            <span style={styles.raidbossTitle}>Community Raidboss</span>
                            {raidbossDoc ? (() => {
                                const evaluated = (raidbossDoc.generation - 1) * raidbossDoc.populationSize
                                    + raidbossDoc.individuals.filter(i => i.fitness !== null).length;
                                return (
                                    <div style={styles.raidbossStats}>
                                        <span style={styles.raidbossStatVal}>Gen {raidbossDoc.generation}</span>
                                        <span style={styles.raidbossStatDivider}>·</span>
                                        <span style={styles.raidbossStatVal}>{evaluated} Individuen trainiert</span>
                                    </div>
                                );
                            })() : (
                                <span style={styles.raidbossInfo}>Noch kein Boss trainiert — sei der Erste!</span>
                            )}
                            <button
                                style={{ ...styles.raidbossBtn, opacity: raidbossLoading ? 0.6 : 1 }}
                                onClick={handleRaidboss}
                                disabled={raidbossLoading}
                            >
                                {raidbossLoading ? 'Lade...' : 'Raidboss kämpfen →'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        display:             'grid',
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows:    '1fr auto',
        width:               '100%',
        height:              '100%',
        columnGap:           '32px',
        padding:             '24px 32px',
        boxSizing:           'border-box',
        overflowY:           'auto',
    },
    leftTop: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '12px',
    },
    rightTop: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
        minWidth:      0,
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
    backBtn: {
        padding:       '14px 40px',
        background:    'rgba(239, 83, 80, 0.08)',
        border:        '1px solid #ef5350',
        borderRadius:  '8px',
        color:         '#ef5350',
        fontFamily:    'monospace',
        fontSize:      '16px',
        letterSpacing: '0.06em',
        cursor:        'pointer',
        transition:    'background 0.15s',
    },
    previewLabel: {
        fontSize:      '11px',
        color:         'rgba(255,255,255,0.25)',
        textAlign:     'center',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily:    'monospace',
    },
    right: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
        minWidth:      0,
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
    settings: {
        display:             'grid',
        gridTemplateColumns: '1fr 1fr',
        gap:                 '16px',
        alignItems:          'start',
    },
    startBtn: {
        padding:       '14px 40px',
        background:    'rgba(79, 195, 247, 0.1)',
        border:        '1px solid #4fc3f7',
        borderRadius:  '8px',
        color:         '#4fc3f7',
        fontFamily:    'monospace',
        fontSize:      '16px',
        letterSpacing: '0.06em',
        cursor:        'pointer',
        transition:    'background 0.15s',
    },
    sessionBlock: {
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '12px',
    },
    sessionStatus: {
        display:     'flex',
        alignItems:  'center',
        gap:         '8px',
        padding:     '6px 14px',
        background:  'rgba(79, 195, 247, 0.07)',
        border:      '1px solid rgba(79, 195, 247, 0.2)',
        borderRadius: '999px',
    },
    sessionDot: {
        width:        '7px',
        height:       '7px',
        borderRadius: '50%',
        background:   '#4fc3f7',
        flexShrink:    0,
        boxShadow:    '0 0 6px #4fc3f7',
    },
    sessionText: {
        fontFamily:    'monospace',
        fontSize:      '12px',
        letterSpacing: '0.08em',
        color:         'rgba(79, 195, 247, 0.9)',
        textTransform: 'uppercase' as const,
    },
    sessionBtns: {
        display: 'flex',
        gap:     '12px',
    },
    resetBtn: {
        padding:       '14px 28px',
        background:    'rgba(239, 83, 80, 0.07)',
        border:        '1px solid rgba(239, 83, 80, 0.5)',
        borderRadius:  '8px',
        color:         'rgba(239, 83, 80, 0.8)',
        fontFamily:    'monospace',
        fontSize:      '14px',
        letterSpacing: '0.06em',
        cursor:        'pointer',
        transition:    'background 0.15s',
    },
    bottomBtns: {
        display:    'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap:        '20px',
        flexWrap:   'wrap' as const,
    },
    raidbossCard: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
        padding:       '14px 20px',
        background:    'rgba(124, 58, 237, 0.08)',
        border:        '1px solid rgba(124, 58, 237, 0.35)',
        borderRadius:  '10px',
        minWidth:      '260px',
    },
    raidbossTitle: {
        fontFamily:    'monospace',
        fontSize:      '11px',
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'rgba(167, 139, 250, 0.55)',
    },
    raidbossStats: {
        display:    'flex',
        alignItems: 'center',
        gap:        '8px',
    },
    raidbossStatVal: {
        fontFamily:  'monospace',
        fontSize:    '14px',
        fontWeight:  700,
        color:       'rgba(192, 158, 255, 0.95)',
        letterSpacing: '0.02em',
    },
    raidbossStatDivider: {
        color:    'rgba(167, 139, 250, 0.35)',
        fontSize: '14px',
    },
    raidbossInfo: {
        fontFamily: 'monospace',
        fontSize:   '13px',
        color:      'rgba(192, 158, 255, 0.7)',
    },
    raidbossBtn: {
        padding:       '10px 16px',
        background:    'rgba(124, 58, 237, 0.15)',
        border:        '1px solid rgba(124, 58, 237, 0.6)',
        borderRadius:  '7px',
        color:         'rgba(167, 139, 250, 0.95)',
        fontFamily:    'monospace',
        fontSize:      '13px',
        letterSpacing: '0.05em',
        cursor:        'pointer',
        transition:    'background 0.15s',
    },
};