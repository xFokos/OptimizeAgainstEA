import { useEffect, useRef } from 'react';
import './eaConceptVisuals.css';

// Neutrale Roster-Animationen für das generelle EA-Tutorial — bewusst KEINE
// Shooter-Optik (keine Dreiecke, kein Spieler, keine Schüsse): kleine
// "Kreaturen" (Kreise mit Augen, leicht unterschiedlich groß/gefärbt) spielen
// dieselben Staging-Ideen wie die Spiel-Tutorials nach:
//
//   'lineup'      — die Population baut sich Individuum für Individuum auf,
//                   dann wird das ganze Roster ersetzt und der Gen-Zähler
//                   tickt — endlos.
//   'selection'   — das Roster steht; die zwei Besten werden nacheinander
//                   als Eltern markiert (blau/orange, die Crossover-Farben),
//                   der Rest tritt zurück. Spielt einmal und bleibt stehen.
//   'generations' — Schnelldurchlauf des ganzen Zyklus: aufbauen, den Besten
//                   kurz feiern, alles austauschen, Gen +1 — endlos.

const SIZE = 240;

const PARENT_A_COLOR = '#60a5fa';
const PARENT_B_COLOR = '#f97316';
const ACCENT         = '#4fc3f7';

const hash01 = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);

// ---- 'lineup' timing (gemächlich — der Step erklärt das Konzept) ----
const LU_FIRST_HOLD  = 1.2;
const LU_SPAWN_EVERY = 0.25;
const LU_FADE        = 0.35;
const LU_HOLD_FULL   = 1.6;

// ---- 'selection' timing ----
const SEL_IDLE = 1.0;
const SEL_GAP  = 0.8;
const SEL_FADE = 0.35;

// ---- 'generations' timing (zügig — hier zählt der Kreislauf) ----
const GN_STAGGER   = 0.08;
const GN_FADE      = 0.3;
const GN_HOLD      = 0.9;
const GN_BEST_TIME = 1.2;
const GN_OUT       = 0.5;

interface Spot { x: number; y: number; r: number; hue: number; alpha: number }

function rosterSpots(count: number, genSeed = 0): Spot[] {
    const cols   = Math.ceil(Math.sqrt(count));
    const rows   = Math.ceil(count / cols);
    const margin = SIZE * 0.18;
    const stepX  = cols > 1 ? (SIZE - margin * 2) / (cols - 1) : 0;
    const stepY  = rows > 1 ? (SIZE - margin * 2) / (rows - 1) : 0;

    return Array.from({ length: count }, (_, i) => {
        const row   = Math.floor(i / cols);
        const col   = i % cols;
        const inRow = row === rows - 1 ? count - row * cols : cols;
        const s     = i * 13 + genSeed * 101;
        return {
            x: cols > 1 ? margin + ((cols - inRow) * stepX) / 2 + col * stepX : SIZE / 2,
            y: rows > 1 ? margin + row * stepY : SIZE / 2,
            // Jede Kreatur ein bisschen anders — Individuen, keine Klone.
            r:     6 + hash01(s + 1) * 4,
            hue:   150 + hash01(s + 2) * 60, // grün-türkise Familie
            alpha: 0.7 + hash01(s + 3) * 0.3,
        };
    });
}

function drawCreature(ctx: CanvasRenderingContext2D, s: Spot, alpha: number) {
    if (alpha <= 0) return;
    ctx.globalAlpha = alpha * s.alpha;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${s.hue}, 45%, 55%)`;
    ctx.fill();
    // Zwei Augen — das kleine Detail, das "Lebewesen" statt "Marker" liest.
    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx.beginPath();
    ctx.arc(s.x - s.r * 0.35, s.y - s.r * 0.25, s.r * 0.16, 0, Math.PI * 2);
    ctx.arc(s.x + s.r * 0.35, s.y - s.r * 0.25, s.r * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawRing(ctx: CanvasRenderingContext2D, s: Spot, color: string, alpha: number, t: number) {
    if (alpha <= 0) return;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r + 5 + Math.sin(t * 3) * 1.2, 0, Math.PI * 2);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
}

function drawGenLabel(ctx: CanvasRenderingContext2D, label: string) {
    ctx.font         = "700 12px 'JetBrains Mono', monospace";
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = 'rgba(255,255,255,0.6)';
    ctx.fillText(label, SIZE / 2, 16);
}

interface CreatureRosterVisualProps {
    variant: 'lineup' | 'selection' | 'generations';
    count?:  number;
}

export function CreatureRosterVisual({ variant, count = 10 }: CreatureRosterVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let t    = 0;
        let gen  = 1;
        let last = performance.now();
        let raf  = 0;

        if (variant === 'selection') {
            const spots = rosterSpots(count);
            const pickA = Math.floor(count * 0.25);
            const pickB = count > 1 ? Math.floor(count * 0.65) : 0;

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;

                ctx.clearRect(0, 0, SIZE, SIZE);
                const dimK = 1 - 0.6 * clamp01((t - SEL_IDLE) / SEL_FADE);

                spots.forEach((s, i) => {
                    const isPick = i === pickA || (i === pickB && pickB !== pickA);
                    if (!isPick) {
                        drawCreature(ctx, s, dimK);
                        return;
                    }
                    const k = clamp01((t - (i === pickA ? SEL_IDLE : SEL_IDLE + SEL_GAP)) / SEL_FADE);
                    drawCreature(ctx, s, 1);
                    drawRing(ctx, s, i === pickA ? PARENT_A_COLOR : PARENT_B_COLOR, k * 0.9, t);
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        if (variant === 'lineup') {
            let spots  = rosterSpots(count, gen);
            const bornAt = (i: number) => (i === 0 ? 0 : LU_FIRST_HOLD + (i - 1) * LU_SPAWN_EVERY);
            const cycle  = bornAt(count - 1) + LU_FADE + LU_HOLD_FULL;

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;
                if (t >= cycle) {
                    t -= cycle;
                    gen += 1;
                    spots = rosterSpots(count, gen); // neue Individuen — kein Klon-Roster
                }

                ctx.clearRect(0, 0, SIZE, SIZE);
                drawGenLabel(ctx, `Gen ${gen}`);
                spots.forEach((s, i) => {
                    drawCreature(ctx, s, clamp01((t - bornAt(i)) / LU_FADE));
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ---- 'generations': aufbauen → Besten feiern → austauschen → Gen +1 ----
        let spots  = rosterSpots(count, gen);
        let best   = Math.floor(hash01(gen * 31) * count);
        const assembled = (count - 1) * GN_STAGGER + GN_FADE;
        const bestAt    = assembled + GN_HOLD;
        const cycle     = bestAt + GN_BEST_TIME + GN_OUT;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;
            if (t >= cycle) {
                t -= cycle;
                gen += 1;
                spots = rosterSpots(count, gen);
                best  = Math.floor(hash01(gen * 31) * count);
            }

            ctx.clearRect(0, 0, SIZE, SIZE);
            drawGenLabel(ctx, `Gen ${gen}`);
            const outK = 1 - clamp01((t - bestAt - GN_BEST_TIME) / GN_OUT);

            spots.forEach((s, i) => {
                const inK = clamp01((t - i * GN_STAGGER) / GN_FADE);
                drawCreature(ctx, s, inK * outK);
                if (i === best) {
                    drawRing(ctx, s, ACCENT, clamp01((t - bestAt) / 0.3) * 0.95 * outK, t);
                }
            });
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [variant, count]);

    return (
        <div className="eaviz__previewBox">
            <canvas ref={canvasRef} width={SIZE} height={SIZE} className="eaviz__previewCanvas" />
            <div className="eaviz__previewLegend">
                <span className="eaviz__previewLegendDot" style={{ background: 'hsl(170, 45%, 55%)' }} /> Individuals
                {variant === 'selection' && (
                    <>
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_A_COLOR }} /> Parent A
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_B_COLOR }} /> Parent B
                    </>
                )}
                {variant === 'generations' && (
                    <>
                        <span className="eaviz__previewLegendDot" style={{ background: ACCENT }} /> Best of its generation
                    </>
                )}
            </div>
        </div>
    );
}
