import { useEffect, useRef } from 'react';
import './eaConceptVisuals.css';

// Neutrale Roster-Animationen für das generelle EA-Tutorial auf dem Dashboard.
// Bewusst KEINE Shooter-Optik: das Dashboard erklärt EAs am Papierflieger-
// Beispiel (man kann nicht ausrechnen, wie weit ein Flieger fliegt — man muss
// werfen), die Spiele werden danach konkret. Ein Individuum ist hier also ein
// gefalteter Flieger, kein Agent.
//
//   'lineup'      — die Population baut sich Flieger für Flieger auf, dann
//                   wird das ganze Roster ersetzt und der Gen-Zähler tickt.
//   'selection'   — das Roster steht; die zwei Weitesten werden nacheinander
//                   als Eltern markiert (blau/orange, die Crossover-Farben),
//                   der Rest tritt zurück. Spielt einmal und bleibt stehen.
//   'mutation'    — das fertige Roster steht; zwei Flieger färben sich lila:
//                   die haben ein Gen abbekommen, das so in keinem Elternteil
//                   stand. Spielt einmal und bleibt stehen.
//   'generations' — Schnelldurchlauf des Zyklus: falten, die zwei Besten kurz
//                   feiern, alles austauschen, Gen +1 — endlos.

const SIZE = 240;

const PARENT_A_COLOR = '#60a5fa';
const PARENT_B_COLOR = '#f97316';
const MUTANT_COLOR   = '#a78bfa';

const hash01  = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;
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

// ---- 'mutation' timing ----
const MUT_IDLE = 1.1;    // erst steht die frische Generation ruhig da …
const MUT_GAP  = 0.9;    // … dann erwischt es einen, kurz darauf noch einen
const MUT_FADE = 0.4;

// ---- 'generations' timing (zügig — hier zählt der Kreislauf) ----
const GN_STAGGER   = 0.08;
const GN_FADE      = 0.3;
const GN_HOLD      = 0.9;
const GN_BEST_TIME = 1.2;
const GN_OUT       = 0.5;

interface Spot { x: number; y: number; r: number; light: number; tilt: number; alpha: number }

// 4 Spalten: bei count = 12 (dem Default) ergibt das ein volles 4×3-Raster —
// ruhiger als ein Gitter mit angebrochener letzter Reihe. Andere Zahlen füllen
// die letzte Reihe weiterhin zentriert auf.
const ROSTER_COLS = 4;

function rosterSpots(count: number, genSeed = 0): Spot[] {
    const cols   = Math.min(ROSTER_COLS, count);
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
            // Jeder Flieger ein bisschen anders gefaltet — Individuen, keine Klone.
            r:     9 + hash01(s + 1) * 4,
            light: 72 + hash01(s + 2) * 16,   // Papierweiß, leicht variierend
            tilt:  (hash01(s + 4) - 0.5) * 0.5,
            alpha: 0.72 + hash01(s + 3) * 0.28,
        };
    });
}

// Dart-Silhouette: Nase rechts (= Flugrichtung), zwei Flügel, sichtbare
// Mittelfalte. Auf 240px liest sich das eindeutiger als jeder Kreis.
function drawPlane(ctx: CanvasRenderingContext2D, s: Spot, alpha: number, color?: string) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha * s.alpha;
    ctx.translate(s.x, s.y);
    ctx.rotate(s.tilt);

    const r = s.r;
    ctx.beginPath();
    ctx.moveTo(r, 0);                 // Nase
    ctx.lineTo(-r, -r * 0.72);        // oberer Flügel
    ctx.lineTo(-r * 0.45, 0);         // Kerbe am Heck
    ctx.lineTo(-r, r * 0.72);         // unterer Flügel
    ctx.closePath();
    // Markierte Flieger werden selbst eingefärbt — kein Ring drumherum, der
    // im engen Roster nur zusätzlich zumacht.
    ctx.fillStyle = color ?? `hsl(200, 20%, ${s.light}%)`;
    ctx.fill();

    ctx.beginPath();                  // Mittelfalte
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.45, 0);
    ctx.strokeStyle = 'rgba(10, 10, 15, 0.4)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    ctx.restore();
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

interface PlaneRosterVisualProps {
    variant: 'lineup' | 'selection' | 'mutation' | 'generations';
    count?:  number;
}

export function PlaneRosterVisual({ variant, count = 12 }: PlaneRosterVisualProps) {
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
                        drawPlane(ctx, s, dimK);
                        return;
                    }
                    const k = clamp01((t - (i === pickA ? SEL_IDLE : SEL_IDLE + SEL_GAP)) / SEL_FADE);
                    drawPlane(ctx, s, 1);
                    drawRing(ctx, s, i === pickA ? PARENT_A_COLOR : PARENT_B_COLOR, k * 0.9, t);
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ---- 'mutation': die frische Generation steht — dann bekommen zwei von
        //      ihnen ein Gen verdreht und färben sich lila. ----
        if (variant === 'mutation') {
            const spots = rosterSpots(count, 3);
            const mutA  = Math.floor(count * 0.35);
            const mutB  = count > 1 ? Math.floor(count * 0.8) : 0;

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;

                ctx.clearRect(0, 0, SIZE, SIZE);

                spots.forEach((s, i) => {
                    const isMut = i === mutA || (i === mutB && mutB !== mutA);
                    drawPlane(ctx, s, 1);
                    if (!isMut) return;

                    const k = clamp01((t - (i === mutA ? MUT_IDLE : MUT_IDLE + MUT_GAP)) / MUT_FADE);
                    if (k <= 0) return;
                    // Kurzes Zittern im Moment der Mutation — irgendetwas an
                    // diesem Flieger ist gerade verstellt worden.
                    const shake = k < 1 ? Math.sin(t * 40) * 0.08 * (1 - k) : 0;
                    drawPlane(ctx, { ...s, tilt: s.tilt + shake }, k, MUTANT_COLOR);
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        if (variant === 'lineup') {
            let spots    = rosterSpots(count, gen);
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
                    spots = rosterSpots(count, gen); // frisch gefaltet — kein Klon-Roster
                }

                ctx.clearRect(0, 0, SIZE, SIZE);
                drawGenLabel(ctx, `Gen ${gen}`);
                spots.forEach((s, i) => {
                    drawPlane(ctx, s, clamp01((t - bornAt(i)) / LU_FADE));
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ---- 'generations': falten → die zwei Besten feiern → austauschen → Gen +1 ----
        // Zwei, nicht einer: die nächste Generation entsteht aus zwei Eltern, und
        // die Farben sind dieselben wie im Selection-/Crossover-Step.
        const pickTwo = (g: number): [number, number] => {
            const a = Math.floor(hash01(g * 31) * count);
            const b = count > 1 ? (a + 1 + Math.floor(hash01(g * 31 + 7) * (count - 1))) % count : a;
            return [a, b];
        };

        let spots       = rosterSpots(count, gen);
        let [bestA, bestB] = pickTwo(gen);
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
                [bestA, bestB] = pickTwo(gen);
            }

            ctx.clearRect(0, 0, SIZE, SIZE);
            drawGenLabel(ctx, `Gen ${gen}`);
            const outK  = 1 - clamp01((t - bestAt - GN_BEST_TIME) / GN_OUT);
            const pickK = clamp01((t - bestAt) / 0.3);

            spots.forEach((s, i) => {
                const inK   = clamp01((t - i * GN_STAGGER) / GN_FADE);
                const color = i === bestA ? PARENT_A_COLOR : i === bestB ? PARENT_B_COLOR : undefined;
                drawPlane(ctx, s, inK * outK);
                // Die Farbe wird über den Papierflieger geblendet, damit sie
                // einblendet statt hart umzuspringen.
                if (color) drawPlane(ctx, s, pickK * outK, color);
            });
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [variant, count]);

    return (
        <div className="eaviz__previewBox">
            <canvas ref={canvasRef} width={SIZE} height={SIZE} className="eaviz__previewCanvas" />
            <div className="eaviz__previewLegend">
                <span className="eaviz__previewLegendDot" style={{ background: 'hsl(200, 20%, 80%)' }} /> One plane
                {variant === 'selection' && (
                    <>
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_A_COLOR }} /> Parent A
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_B_COLOR }} /> Parent B
                    </>
                )}
                {variant === 'mutation' && (
                    <>
                        <span className="eaviz__previewLegendDot" style={{ background: MUTANT_COLOR }} /> Mutated
                    </>
                )}
                {variant === 'generations' && (
                    <>
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_A_COLOR }} /> Parent A
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_B_COLOR }} /> Parent B
                    </>
                )}
            </div>
        </div>
    );
}
