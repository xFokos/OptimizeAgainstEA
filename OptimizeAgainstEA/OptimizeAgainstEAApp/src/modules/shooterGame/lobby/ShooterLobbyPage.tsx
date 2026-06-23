import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { ShooterSettingsPanel } from '../settings/ShooterSettings';
import { EASettingsPanel } from '../../../components/settings/EASettings';
import { vec } from '../game/core/vec';

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

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Zwei Agenten
        let agentA: PreviewAgent = {
            pos:       { x: PREVIEW_W * 0.25, y: PREVIEW_H * 0.5 },
            vel:       { x: 0, y: 0 },
            rot:       0,
            color:     '#4fc3f7',
            glowColor: 'rgba(79, 195, 247, 0.3)',
        };
        let agentB: PreviewAgent = {
            pos:       { x: PREVIEW_W * 0.75, y: PREVIEW_H * 0.5 },
            vel:       { x: 0, y: 0 },
            rot:       Math.PI,
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
            const toTarget = vec.normalize(vec.sub(target.pos, agent.pos));

            // Kreisförmige Bewegung mit leichter Verfolgung
            const angle     = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const circleVel = { x: Math.cos(angle) * 60, y: Math.sin(angle) * 60 };
            const chaseVel  = vec.scale(toTarget, 30);
            const combined  = vec.add(circleVel, chaseVel);

            agent.vel = vec.scale(vec.add(agent.vel, vec.scale(combined, dt)), 0.9);
            agent.pos = {
                x: Math.max(20, Math.min(PREVIEW_W - 20, agent.pos.x + agent.vel.x * dt)),
                y: Math.max(20, Math.min(PREVIEW_H - 20, agent.pos.y + agent.vel.y * dt)),
            };
            agent.rot = Math.atan2(toTarget.y, toTarget.x);

            return agent;
        };

        const loop = (timestamp: number) => {
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;

            // Agenten updaten
            agentA = updateAgent(agentA, agentB, dt);
            agentB = updateAgent(agentB, agentA, dt);

            // Bullets spawnen
            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                bulletTimer = 0.6 + Math.random() * 0.4;

                // Agent A schießt
                const dirA = vec.normalize(vec.sub(agentB.pos, agentA.pos));
                bullets.push({
                    pos:      { ...agentA.pos },
                    vel:      vec.scale(dirA, 250),
                    color:    '#80d8ff',
                    lifetime: 1.5,
                });

                // Agent B schießt
                const dirB = vec.normalize(vec.sub(agentA.pos, agentB.pos));
                bullets.push({
                    pos:      { ...agentB.pos },
                    vel:      vec.scale(dirB, 250),
                    color:    '#ff8a80',
                    lifetime: 1.5,
                });
            }

            // Bullets updaten
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

            // Zeichnen
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

                {/* Links – Preview */}
                <div style={styles.left}>
                    <ShooterPreview />
                    <div style={styles.previewLabel}>Live Preview</div>
                </div>

                {/* Rechts – Info + Settings */}
                <div style={styles.right}>
                    {/* Header */}
                    <div style={styles.header}>
                        <h1 style={styles.title}>Shooter vs EA</h1>
                        <p style={styles.description}>
                            Kämpfe gegen einen genetischen Algorithmus der sich nach jeder Runde
                            an deinen Spielstil anpasst. Wie lange kannst du die Oberhand behalten?
                        </p>
                    </div>

                    {/* Settings */}
                    <div style={styles.settings}>
                        <EASettingsPanel />
                        <ShooterSettingsPanel />
                    </div>

                    {/* Start Button */}
                    <button
                        style={styles.startBtn}
                        onClick={() => navigate('/ShooterGame')}
                    >
                        Spielen →
                    </button>
                </div>
            </div>
        </PageContainer>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        display:    'flex',
        width:      '100%',
        height:     '100%',
        gap:        '40px',
        padding:    '32px',
        boxSizing:  'border-box',
        alignItems: 'flex-start',
        overflowY:  'auto',
    },
    left: {
        flexShrink:  0,
        display:     'flex',
        flexDirection: 'column',
        gap:         '12px',
        position:    'sticky',
        top:         '32px',
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
        gap:           '24px',
        minWidth:      0,
    },
    header: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '12px',
    },
    title: {
        fontFamily: 'monospace',
        fontSize:   '28px',
        fontWeight: 500,
        color:      'rgba(255,255,255,0.9)',
        margin:     0,
    },
    description: {
        fontFamily:  'monospace',
        fontSize:    '14px',
        color:       'rgba(255,255,255,0.5)',
        lineHeight:  1.6,
        margin:      0,
        maxWidth:    '480px',
    },
    settings: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
    },
    startBtn: {
        alignSelf:    'flex-start',
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