import { useEffect, useRef } from 'react';
import styles from './arenaPreview.module.css';
import { ARENA_SIZE, ARENA_SCALE, BULLET_RADIUS, drawArenaAgentTriangle } from './arenaAgentSim';

// Scripted illustration for the "Fitness" step, in the same visual grammar as
// DnaPreviewCanvas/GhostArenaVisual (blue player dot, orange EA triangle):
// the two simply stand facing each other and trade shots, strictly taking
// turns — and every hit pops a floating "+100" / "−100" at the impact point
// that drifts up and fades, video-game damage-number style. Signs/colors are
// from the EA's perspective, matching the FitnessVisual breakdown card next
// to it: the EA hitting *you* is +100 (green), taking a hit is −100 (red).
// No physics/AI here — a hit demo, not a fight demo; the DNA steps already
// showed real behavior.

const PLAYER_POS = { x: ARENA_SIZE * 0.24, y: ARENA_SIZE * 0.5 };
const AGENT_POS  = { x: ARENA_SIZE * 0.76, y: ARENA_SIZE * 0.5 };

const BULLET_SPEED = 420 * ARENA_SCALE; // ~1s of flight across the gap
const SHOT_PAUSE   = 0.8;               // beat after a hit before the answer

const POPUP_LIFE = 1.1; // seconds
const POPUP_RISE = 26;  // px drifted upward over a popup's lifetime

interface Popup  { x: number; y: number; text: string; color: string; age: number }
interface Bullet { x: number; y: number; vx: number; vy: number; owner: 'agent' | 'player' }

interface FitnessArenaVisualProps {
    /** Farbe + Legenden-Label des Gegners — Solo lässt den Default (orange
     * "EA"), das Raidboss-Tutorial übergibt sein Lila und "Boss". */
    agentColor?: string;
    agentLabel?: string;
}

export function FitnessArenaVisual({ agentColor = '#f97316', agentLabel = 'EA' }: FitnessArenaVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let bullets: Bullet[] = [];
        let popups:  Popup[]  = [];
        let turn: Bullet['owner'] = 'agent';
        let shotTimer = 0.6;
        let last = performance.now();
        let raf  = 0;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;

            // One bullet in flight at a time — a clean, readable alternation
            // ("your turn, my turn") instead of overlapping crossfire.
            if (bullets.length === 0) {
                shotTimer -= dt;
                if (shotTimer <= 0) {
                    const from = turn === 'agent' ? AGENT_POS : PLAYER_POS;
                    const to   = turn === 'agent' ? PLAYER_POS : AGENT_POS;
                    const dx = to.x - from.x, dy = to.y - from.y;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    bullets.push({
                        x: from.x, y: from.y,
                        vx: (dx / len) * BULLET_SPEED,
                        vy: (dy / len) * BULLET_SPEED,
                        owner: turn,
                    });
                }
            }

            bullets = bullets.filter(b => {
                b.x += b.vx * dt;
                b.y += b.vy * dt;
                const target = b.owner === 'agent' ? PLAYER_POS : AGENT_POS;
                const hit = (b.x - target.x) ** 2 + (b.y - target.y) ** 2 < 8 ** 2;
                if (hit) {
                    popups.push(b.owner === 'agent'
                        ? { x: target.x, y: target.y - 14, text: '+100', color: '#4ade80', age: 0 }
                        : { x: target.x, y: target.y - 14, text: '−100', color: '#f87171', age: 0 });
                    turn      = b.owner === 'agent' ? 'player' : 'agent';
                    shotTimer = SHOT_PAUSE;
                }
                return !hit;
            });

            for (const p of popups) p.age += dt;
            popups = popups.filter(p => p.age < POPUP_LIFE);

            // ---- Draw ----
            ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

            for (const b of bullets) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, BULLET_RADIUS, 0, Math.PI * 2);
                ctx.fillStyle = b.owner === 'agent' ? agentColor : 'rgba(255,255,255,0.75)';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(PLAYER_POS.x, PLAYER_POS.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = '#60a5fa';
            ctx.fill();

            drawArenaAgentTriangle(ctx, { ...AGENT_POS, vx: 0, vy: 0, rot: Math.PI }, 1, agentColor);

            ctx.font         = "700 14px 'JetBrains Mono', monospace";
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'alphabetic';
            for (const p of popups) {
                const k = p.age / POPUP_LIFE;
                ctx.globalAlpha = 1 - k;
                ctx.fillStyle   = p.color;
                ctx.fillText(p.text, p.x, p.y - k * POPUP_RISE);
            }
            ctx.globalAlpha = 1;
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [agentColor]);

    return (
        <div className={styles.preview}>
            <canvas ref={canvasRef} width={ARENA_SIZE} height={ARENA_SIZE} className={styles.canvas} />
            <div className={styles.legend}>
                <span className={styles.legendDot} style={{ background: '#60a5fa' }} /> You
                <span className={styles.legendDot} style={{ background: agentColor }} /> {agentLabel}
            </div>
        </div>
    );
}
