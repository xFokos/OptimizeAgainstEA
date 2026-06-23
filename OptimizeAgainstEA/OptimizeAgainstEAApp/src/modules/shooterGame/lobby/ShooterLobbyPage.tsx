import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { ShooterSettingsPanel } from '../settings/ShooterSettings';
import { EASettingsPanel } from '../../../components/settings/EASettings';
import { vec } from '../game/core/vec';
import { useSettings } from '../../../context/SettingsContext';
import { DNA_INDEX } from '../shooter.types';

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
            const dna      = dnaRef.current;
            const spread   = (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;

            const shoot = (from: PreviewAgent, to: PreviewAgent, color: string) => {
                const base  = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({
                    pos:      { ...from.pos },
                    vel:      { x: Math.cos(angle) * 260, y: Math.sin(angle) * 260 },
                    color,
                    lifetime: 1.5,
                });
            };

            shoot(a, b, '#80d8ff');
            shoot(b, a, '#ff8a80');
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

            bullets = bullets
                .map(b => ({
                    ...b,
                    pos:      { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
                    lifetime: b.lifetime - dt,
                }))
                .filter(b =>
                    b.lifetime > 0 &&
                    b.pos.x > 0 && b.pos.x < PREVIEW_W &&
                    b.pos.y > 0 && b.pos.y < PREVIEW_H
                );

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

// ---- Lobby Page ----

export default function ShooterLobbyPage() {
    const navigate = useNavigate();

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

                {/* Rechts unten – Play */}
                <div style={styles.rightBottom}>
                    <button style={styles.startBtn} onClick={() => navigate('/ShooterGame')}>
                        Spielen →
                    </button>
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
        padding:      '14px 40px',
        background:   'rgba(79, 195, 247, 0.1)',
        border:       '1px solid #4fc3f7',
        borderRadius: '8px',
        color:        '#4fc3f7',
        fontFamily:   'monospace',
        fontSize:     '16px',
        letterSpacing: '0.06em',
        cursor:       'pointer',
        transition:   'background 0.15s',
    },
};