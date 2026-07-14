import { useEffect, useRef } from 'react';
import './eaConceptVisuals.css';

// "The Problem" / "Fitness" für das generelle EA-Tutorial: ein verstecktes
// Fitness-Gebirge, von dem man nichts sieht — man kann nur einzelne Lösungen
// ausprobieren (Balken poppen an zufälligen Stellen auf) und bekommt pro
// Versuch genau eine Zahl zurück. Der beste Versuch bisher leuchtet im
// Akzentton. `showScores` blendet zusätzlich die Zahl über jedem neuen
// Versuch ein — dieselbe Szene, im Fitness-Step nur explizit beziffert.

const SIZE     = 240;
const PLOT_PAD = 22;   // Rand unten für die Achse / oben für Labels
const BAR_W    = 4;

const SAMPLE_EVERY = 0.9;   // s zwischen zwei Versuchen
const BAR_GROW     = 0.3;   // s bis ein Balken seine volle Höhe erreicht
const SCORE_FADE   = 1.6;   // s bis ein Score-Label verblasst
const MAX_SAMPLES  = 16;    // dann Reset — die Fläche soll nie "voll" wirken
const RESET_FADE   = 0.6;

const ACCENT = '#4fc3f7';

// Das versteckte Gebirge: mehrere Sinus-Wellen, ein klares globales Maximum.
function terrain(x: number): number {
    const raw = 0.5
        + 0.26 * Math.sin(x * 6.2 + 1.0)
        + 0.16 * Math.sin(x * 13.0 + 2.2)
        + 0.12 * Math.sin(x * 3.0 - 0.5);
    return Math.min(0.95, Math.max(0.08, raw));
}

const hash01 = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;

interface Sample { x: number; fitness: number; bornAt: number }

export function SearchSpaceVisual({ showScores = false, axisLabel = 'possible solutions →' }: {
    showScores?: boolean;
    /** Beschriftung der X-Achse — z.B. "every possible creature →". */
    axisLabel?:  string;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let samples: Sample[] = [];
        let sampleCount = 0;   // läuft über Resets weiter → immer neue Stellen
        let nextAt = 0.4;
        let resetAt: number | null = null;
        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const plotH = SIZE - PLOT_PAD * 2;
        const baseY = SIZE - PLOT_PAD;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;

            if (resetAt !== null) {
                if (t >= resetAt + RESET_FADE) {
                    samples = [];
                    resetAt = null;
                    nextAt  = t + 0.4;
                }
            } else if (t >= nextAt) {
                nextAt = t + SAMPLE_EVERY;
                sampleCount += 1;
                const x = 0.06 + 0.88 * hash01(sampleCount * 7 + 3);
                samples.push({ x, fitness: terrain(x), bornAt: t });
                if (samples.length >= MAX_SAMPLES) resetAt = t + SAMPLE_EVERY * 0.8;
            }

            // ---- Draw ----
            ctx.clearRect(0, 0, SIZE, SIZE);
            const fadeK = resetAt !== null ? Math.max(0, 1 - Math.max(0, t - resetAt) / RESET_FADE) : 1;

            // Achse: "alle möglichen Lösungen" von links nach rechts.
            ctx.beginPath();
            ctx.moveTo(10, baseY);
            ctx.lineTo(SIZE - 10, baseY);
            ctx.strokeStyle = 'rgba(255,255,255,0.18)';
            ctx.lineWidth   = 1;
            ctx.stroke();
            ctx.font         = "400 10px 'JetBrains Mono', monospace";
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle    = 'rgba(255,255,255,0.3)';
            ctx.fillText(axisLabel, SIZE / 2, baseY + 11);

            const best = samples.reduce<Sample | null>((b, s) => (b === null || s.fitness > b.fitness ? s : b), null);

            for (const s of samples) {
                const growK  = Math.min((t - s.bornAt) / BAR_GROW, 1);
                const h      = s.fitness * plotH * growK;
                const px     = 10 + s.x * (SIZE - 20);
                const isBest = s === best && growK >= 1;

                ctx.globalAlpha = fadeK;
                ctx.fillStyle   = isBest ? ACCENT : 'rgba(255,255,255,0.3)';
                ctx.fillRect(px - BAR_W / 2, baseY - h, BAR_W, h);
                ctx.beginPath();
                ctx.arc(px, baseY - h, isBest ? 4 : 2.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;

                // Score-Label: beim Fitness-Step für jeden frischen Versuch,
                // beim besten dauerhaft.
                const labelAlpha = isBest
                    ? 0.95
                    : showScores ? Math.max(0, 1 - (t - s.bornAt - BAR_GROW) / SCORE_FADE) : 0;
                if (labelAlpha > 0 && growK >= 1) {
                    ctx.font         = "700 10px 'JetBrains Mono', monospace";
                    ctx.globalAlpha  = labelAlpha * fadeK;
                    ctx.fillStyle    = isBest ? ACCENT : 'rgba(255,255,255,0.7)';
                    ctx.fillText(s.fitness.toFixed(2), px, baseY - h - 10);
                    ctx.globalAlpha  = 1;
                }
            }
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [showScores, axisLabel]);

    return (
        <div className="eaviz__previewBox">
            <canvas ref={canvasRef} width={SIZE} height={SIZE} className="eaviz__previewCanvas" />
            <div className="eaviz__previewLegend">
                <span className="eaviz__previewLegendDot" style={{ background: 'rgba(255,255,255,0.45)' }} /> One try
                <span className="eaviz__previewLegendDot" style={{ background: ACCENT }} /> Best so far
            </div>
        </div>
    );
}
