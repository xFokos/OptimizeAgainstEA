import { useEffect, useRef, useState } from 'react';
import './eaConceptVisuals.css';

// Die Wurf-Szene der ersten beiden Steps des generellen EA-Tutorials —
// bewusst zweimal dieselbe Grafik, damit Step 2 als Fortsetzung von Step 1
// gelesen wird und nicht als neues Thema:
//
//   'interactive' (Step "The Problem")  — Klick = ein NEU gefalteter Flieger,
//       der losfliegt und irgendwo weiter rechts landet. Wichtig: der Wurf
//       selbst ist nicht zufällig — derselbe Flieger flöge immer gleich weit.
//       Was sich ändert, ist die Faltung, und deren Weite kann man eben nicht
//       vorhersagen, nur messen. Die Weiten kommen daher aus einer festen
//       Liste (FOLDS), nicht aus Math.random(). Frühere Landungen bleiben als
//       blasse Marker stehen, damit die Streuung sichtbar wird.
//
//   'measure' (Step "Fitness")          — läuft einmal von selbst durch: drei
//       Flieger fliegen nacheinander, jeder bekommt seine gemessene Weite.
//       Danach faden die Flieger aus und übrig bleiben nur die drei Strecken
//       mit ihren Zahlen — das ist alles, was man je über sie weiß.
//
// Die drei PNGs in public/ zeigen den Flieger aus drei Perspektiven, passend
// zur Flugphase: liegend (Ruhe) → von hinten (direkt nach dem Abwurf) →
// Seitenansicht (Flug + Landung).

const W = 360;
const H = 260;

const ORIGIN_X = 46;           // Y-Achse
const BASE_Y   = H - 46;       // X-Achse (der "Boden")
const AXIS_END = W - 14;
const MAX_M    = 10;           // Skala der X-Achse in Metern

const REST_SRC   = '/PaperPlane2.png';  // 3/4 von oben — liegt bereit
const BEHIND_SRC = '/PaperPlane3.png';  // von hinten — direkt nach dem Abwurf
const SIDE_SRC   = '/PaperPlane.png';   // flache Seitenansicht — im Flug

const THROW_TIME  = 0.22;      // s, Flieger verlässt die Hand (Rückansicht)
const FLIGHT_TIME = 1.45;      // s, Bogen bis zur Landung
const ACCENT      = '#4fc3f7';

const PLANE_H = 34;            // gezeichnete Höhe des Fliegers in px
const LAUNCH_X = ORIGIN_X + 42;

// ---- 'measure' timing ----
const M_START      = 0.5;      // Vorlauf, bevor der erste geworfen wird
const M_LAND_HOLD  = 0.75;     // wie lange ein gelandeter Flieger liegen bleibt,
const M_SLOT       = THROW_TIME + FLIGHT_TIME + M_LAND_HOLD;  // bevor der nächste startet
const M_FADE_WAIT  = 0.6;      // Pause nach dem letzten Wurf …
const M_FADE       = 0.9;      // … dann faden die Flieger weg …
const M_STACK      = 0.7;      // … und die Strecken lösen sich von der Achse und stapeln sich

const M_STACK_GAP  = 20;       // Zeilenabstand im gestapelten Zustand
const M_STACK_TOP  = BASE_Y - 28;

// Feste Weiten — die Zahlen sollen sich zwischen den Besuchen nicht ändern,
// der Step erklärt das Messen, nicht den Zufall. Eine Farbe pro Flieger, damit
// man die Strecke nach dem Stapeln noch ihrem Wurf zuordnen kann.
const M_THROWS = [
    { dist: 4.2, arc: 52, color: '#60a5fa' },
    { dist: 7.6, arc: 74, color: '#f97316' },
    { dist: 5.9, arc: 60, color: '#a78bfa' },
];
const M_BEST = M_THROWS.reduce((b, s, i) => (s.dist > M_THROWS[b].dist ? i : b), 0);
// Kurz gelandet liegen alle drei Strecken auf der X-Achse übereinander — die
// längste zuerst zeichnen, sonst deckt sie die kürzeren zu.
const M_DRAW_ORDER = M_THROWS.map((_, i) => i).sort((a, b) => M_THROWS[b].dist - M_THROWS[a].dist);

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

// Die Falten-Reihe für 'interactive': jeder Klick faltet den nächsten Flieger.
// Bewusst fest verdrahtet statt zufällig — ein Wurf ist im Modell nicht
// verrauscht, die Weite hängt allein an der Faltung. Die Reihenfolge steigt
// nicht an: Falte #4 ist schlechter als #3, sonst liest man einen Trend hinein,
// den es nicht gibt.
const FOLDS = [
    { dist: 4.8, arc: 56 },
    { dist: 2.9, arc: 40 },
    { dist: 7.3, arc: 72 },
    { dist: 5.4, arc: 58 },
    { dist: 3.6, arc: 47 },
    { dist: 8.4, arc: 78 },
    { dist: 6.1, arc: 63 },
];

const mToPx    = (m: number) => ORIGIN_X + (m / MAX_M) * (AXIS_END - ORIGIN_X);
const clamp01  = (v: number) => Math.min(Math.max(v, 0), 1);
const hash01   = (n: number) => Math.abs(Math.sin(n * 12.9898) * 43758.5453) % 1;

// ---- 'population' timing: der Stapel faltet sich auf → die Achse erscheint →
//      alle sammeln sich am Abwurfpunkt → der ganze Schwarm fliegt auf einmal
//      los. Läuft in Schleife. ------------------------------------------------
const P_COUNT      = 10;
const P_FOLD_START = 0.35;
const P_FOLD_EVERY = 0.14;    // ein Flieger nach dem anderen wird gefaltet
const P_FOLD_FADE  = 0.3;
const P_AXES_AT    = P_FOLD_START + P_COUNT * P_FOLD_EVERY + 0.25;
const P_AXES_FADE  = 0.5;
const P_GATHER_AT  = P_AXES_AT + P_AXES_FADE * 0.6;
const P_GATHER     = 0.75;    // alle ziehen zum gemeinsamen Abwurfpunkt
const P_LAUNCH_AT  = P_GATHER_AT + P_GATHER + 0.45;   // kurz sammeln, dann los
const P_STAGGER    = 0.05;    // fast gleichzeitig — ein Schwarm, keine Schlange
const P_FLIGHT     = 1.35;
const P_SCORE_FADE = 0.3;
const P_HOLD       = 2.6;     // alle gelandet, alle Weiten sichtbar
const P_END        = P_LAUNCH_AT + (P_COUNT - 1) * P_STAGGER + P_FLIGHT + P_HOLD;

const P_GRID_COLS  = 5;
const P_SCALE      = 0.62;    // im Stapel liegen sie kleiner da
const P_LAUNCH_Y   = BASE_Y - PLANE_H * P_SCALE / 2;

// Ein Individuum der Population: eigene Faltung → eigene Weite, eigener Bogen.
const P_PLANES = Array.from({ length: P_COUNT }, (_, i) => ({
    dist: 2.4 + hash01(i * 7 + 1) * 6.6,
    arc:  30 + hash01(i * 7 + 2) * 34,
    // Warteposition im Stapel, links über dem Ursprung
    gx:   ORIGIN_X - 4 + (i % P_GRID_COLS) * 26,
    gy:   40 + Math.floor(i / P_GRID_COLS) * 30,
    // Sammelpunkt: für alle derselbe, nur ein paar Pixel Streuung, damit sie
    // nicht deckungsgleich aufeinanderliegen.
    lx:   LAUNCH_X - 14 + (hash01(i * 7 + 3) - 0.5) * 9,
    ly:   P_LAUNCH_Y + (hash01(i * 7 + 4) - 0.5) * 9,
}));
const P_BEST = P_PLANES.reduce((b, p, i) => (p.dist > P_PLANES[b].dist ? i : b), 0);

// 'selection' baut auf derselben Szene auf: sind alle gelandet, werden die zwei
// weitesten als Eltern markiert — in genau den Farben, die der Crossover-Step
// gleich für Parent A / Parent B benutzt. Der Rest tritt zurück.
const PARENT_A_COLOR = '#60a5fa';
const PARENT_B_COLOR = '#f97316';

const P_TOP2 = P_PLANES
    .map((p, i) => ({ i, dist: p.dist }))
    .sort((a, b) => b.dist - a.dist)
    .slice(0, 2)
    .map(x => x.i);

// Zehn Weiten auf einer 300px-Achse kollidieren als Text zwangsläufig — also
// vorab Zeilen vergeben: von links nach rechts, und wer seinem linken Nachbarn
// zu nah kommt, rutscht eine Zeile höher. Die Weiten sind statisch, das lässt
// sich einmal beim Modul-Laden ausrechnen.
const P_LABEL_W   = 30;
const P_LABEL_ROW = (() => {
    const rows: number[] = new Array(P_COUNT).fill(0);
    const lastX: number[] = [];   // rechter Rand des letzten Labels je Zeile
    for (const { i, x } of P_PLANES
        .map((p, i) => ({ i, x: mToPx(p.dist) }))
        .sort((a, b) => a.x - b.x)) {
        let row = lastX.findIndex(lx => x - lx >= P_LABEL_W);
        if (row < 0) row = lastX.length;
        rows[i]    = row;
        lastX[row] = x;
    }
    return rows;
})();

const P_ALL_DOWN = P_LAUNCH_AT + (P_COUNT - 1) * P_STAGGER + P_FLIGHT;
const P_PICK_AT  = P_ALL_DOWN + 0.5;   // erst alle Weiten lesen lassen …
const P_PICK_GAP = 0.7;                // … dann Parent A, dann Parent B
const P_PICK_IN  = 0.35;
const P_SEL_HOLD = 2.8;                // Standbild, solange man den Step liest
const P_SEL_END  = P_PICK_AT + P_PICK_GAP + P_PICK_IN + P_SEL_HOLD;

const easeInOut = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

type Phase = 'idle' | 'throw' | 'flight' | 'landed';

const loadImage = (src: string) => {
    const img = new Image();
    img.src = src;
    return img;
};

function drawPlane(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number, y: number,
    rot: number, scale = 1, alpha = 1,
    /** Färbt den Flieger selbst ein (Eltern-Markierung im Selection-Step). */
    tint?: string,
) {
    if (!img.complete || img.naturalWidth === 0 || alpha <= 0) return;
    const h = PLANE_H * scale;
    const w = h * (img.naturalWidth / img.naturalHeight);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.drawImage(tint ? tinted(img, tint) : img, -w / 2, -h / 2, w, h);
    ctx.restore();
}

// Eingefärbte Kopie eines Fliegers. 'source-atop' malt die Farbe nur dort, wo
// das PNG schon deckt — auf einem eigenen Canvas, damit nicht der Hintergrund
// (Achse, andere Flieger) mit eingefärbt wird. Wird pro Bild+Farbe genau einmal
// gebaut und dann wiederverwendet.
const tintCache = new Map<string, HTMLCanvasElement>();
function tinted(img: HTMLImageElement, color: string): HTMLCanvasElement | HTMLImageElement {
    const key = `${img.src}|${color}`;
    const hit = tintCache.get(key);
    if (hit) return hit;

    const off = document.createElement('canvas');
    off.width  = img.naturalWidth;
    off.height = img.naturalHeight;
    const octx = off.getContext('2d');
    if (!octx) return img;

    octx.drawImage(img, 0, 0);
    octx.globalCompositeOperation = 'source-atop';
    octx.globalAlpha = 0.72;   // etwas Papier-Struktur darf durchscheinen
    octx.fillStyle   = color;
    octx.fillRect(0, 0, off.width, off.height);

    tintCache.set(key, off);
    return off;
}

function drawAxes(ctx: CanvasRenderingContext2D, alpha = 1) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 1;

    // X-Achse (Boden) + Y-Achse (Höhe)
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, BASE_Y);
    ctx.lineTo(AXIS_END, BASE_Y);
    ctx.moveTo(ORIGIN_X, BASE_Y);
    ctx.lineTo(ORIGIN_X, 26);
    ctx.stroke();

    ctx.font         = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle    = 'rgba(255,255,255,0.3)';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (let m = 2; m <= MAX_M; m += 2) {
        const px = mToPx(m);
        ctx.beginPath();
        ctx.moveTo(px, BASE_Y);
        ctx.lineTo(px, BASE_Y + 4);
        ctx.stroke();
        ctx.fillText(`${m}m`, px, BASE_Y + 14);
    }

    ctx.fillText('distance flown →', (ORIGIN_X + AXIS_END) / 2, BASE_Y + 30);

    ctx.save();                                  // "height" längs der Y-Achse
    ctx.translate(ORIGIN_X - 14, (BASE_Y + 26) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('height', 0, 0);
    ctx.restore();

    ctx.restore();
}

/** Ein Flieger auf seiner Parabel; `p` = 0 (Abwurf) … 1 (gelandet). */
function drawArcPlane(
    ctx: CanvasRenderingContext2D,
    side: HTMLImageElement,
    endX: number, arc: number, p: number,
    alpha: number, trail: boolean,
) {
    const x    = LAUNCH_X + (endX - LAUNCH_X) * p;
    const y    = BASE_Y - PLANE_H / 2 - arc * 4 * p * (1 - p);

    if (trail && p < 1) {
        ctx.beginPath();
        for (let s = 0; s <= p; s += 0.02) {
            const sx = LAUNCH_X + (endX - LAUNCH_X) * s;
            const sy = BASE_Y - PLANE_H / 2 - arc * 4 * s * (1 - s);
            if (s === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = 'rgba(79,195,247,0.35)';
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Neigung folgt der Flugrichtung: Steigen → Nase hoch, Sinken → Nase runter.
    const slope = (arc * 4 * (1 - 2 * p)) / Math.max(endX - LAUNCH_X, 1);
    drawPlane(ctx, side, x, y, -Math.atan(slope) * 0.6, 1, alpha);
}

/** Die gemessene Strecke: gestrichelte Linie 0 → Landung, Weite als Zahl. */
function drawMeasure(
    ctx: CanvasRenderingContext2D,
    dist: number, y: number, alpha: number, color: string, best: boolean,
) {
    if (alpha <= 0) return;
    const endX = mToPx(dist);

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(ORIGIN_X, y);
    ctx.lineTo(endX, y);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth   = best ? 2.5 : 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth   = 1;

    ctx.beginPath();
    ctx.arc(endX, y, best ? 3.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.font         = `700 ${best ? 13 : 12}px 'JetBrains Mono', monospace`;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${dist.toFixed(1)} m`, endX + 7, y);
    ctx.globalAlpha  = 1;
}

interface PlaneThrowVisualProps {
    /** 'interactive' (default): der Leser wirft selbst, jede Faltung eine andere Weite.
     *  'measure': drei Würfe laufen einmal automatisch durch, danach bleiben
     *  nur die gemessenen Strecken stehen.
     *  'population': ein ganzer Stapel wird gefaltet und fliegt dann auf einmal —
     *  jeder Flieger landet woanders und bekommt seine eigene Weite.
     *  'selection': dieselbe Szene, aber am Ende werden die zwei weitesten als
     *  Eltern markiert (blau/orange) und der Rest tritt zurück. */
    mode?: 'interactive' | 'measure' | 'population' | 'selection';
}

export function PlaneThrowVisual({ mode = 'interactive' }: PlaneThrowVisualProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Phase lebt im Ref (die rAF-Schleife liest sie jeden Frame) und im State
    // (die Caption unter dem Canvas rendert daraus) — daher beides.
    const phaseRef  = useRef<Phase>('idle');
    const [phase, setPhase] = useState<Phase>('idle');
    const [distance, setDistance] = useState<number | null>(null);
    // 'measure': wie viele der drei Flieger schon aufgekommen sind — die Legende
    // darunter deckt eine Weite erst auf, wenn sie tatsächlich gemessen wurde.
    const [landed, setLanded] = useState(0);

    // 'interactive': der wievielte gefaltete Flieger gerade fliegt (0 = noch keiner).
    const foldRef = useRef(0);
    const [fold, setFold] = useState(0);

    const throwRef = useRef<{ t: number; dist: number; arc: number }>({ t: 0, dist: 0, arc: 0 });
    const pastRef  = useRef<number[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const rest   = loadImage(REST_SRC);
        const behind = loadImage(BEHIND_SRC);
        const side   = loadImage(SIDE_SRC);

        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        // ── 'population': der Stapel wird gefaltet, dann erscheint die Achse und
        //    alle fliegen auf einmal — jeder landet woanders, jeder bekommt seine
        //    eigene Weite. Läuft in Schleife. ────────────────────────────────────
        if (mode === 'population' || mode === 'selection') {
            const selecting = mode === 'selection';
            const cycle     = selecting ? P_SEL_END : P_END;

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t += dt;
                if (t >= cycle) t -= cycle;

                ctx.clearRect(0, 0, W, H);
                drawAxes(ctx, clamp01((t - P_AXES_AT) / P_AXES_FADE));

                // Sobald die Eltern feststehen, tritt der Rest zurück.
                const dimK = selecting
                    ? 1 - 0.6 * clamp01((t - P_PICK_AT) / P_PICK_IN)
                    : 1;

                P_PLANES.forEach(({ dist, arc, gx, gy, lx, ly }, i) => {
                    const foldK = clamp01((t - (P_FOLD_START + i * P_FOLD_EVERY)) / P_FOLD_FADE);
                    if (foldK <= 0) return;

                    const flightK = clamp01((t - (P_LAUNCH_AT + i * P_STAGGER)) / P_FLIGHT);
                    const endX    = mToPx(dist);

                    // Eltern-Rolle (nur im Selection-Modus): der Weiteste wird
                    // Parent A, der Zweitweiteste Parent B.
                    const rank    = selecting ? P_TOP2.indexOf(i) : -1;
                    const isPick  = rank >= 0;
                    const pickCol = rank === 0 ? PARENT_A_COLOR : PARENT_B_COLOR;
                    const pickK   = isPick
                        ? clamp01((t - (P_PICK_AT + rank * P_PICK_GAP)) / P_PICK_IN)
                        : 0;
                    // Die Eltern bleiben hell, alle anderen treten zurück.
                    const alpha   = isPick ? 1 : dimK;

                    if (flightK <= 0) {
                        // Noch am Boden: erst im Stapel, dann zieht der ganze
                        // Schwarm zum gemeinsamen Abwurfpunkt.
                        const g = easeInOut(clamp01((t - (P_GATHER_AT + i * 0.03)) / P_GATHER));
                        drawPlane(ctx, rest, gx + (lx - gx) * g, gy + (ly - gy) * g, -0.08, P_SCALE, foldK);
                        return;
                    }

                    // Bogen vom Sammelpunkt zur Landestelle: alle starten am
                    // selben Fleck, aber jeder hat seine eigene Bogenhöhe und
                    // sein eigenes Ziel — daher fächert der Schwarm in der Luft auf.
                    const x     = lx + (endX - lx) * flightK;
                    const y     = ly + (P_LAUNCH_Y - ly) * flightK - arc * 4 * flightK * (1 - flightK);
                    const slope = ((P_LAUNCH_Y - ly) - arc * 4 * (1 - 2 * flightK)) / Math.max(endX - lx, 1);
                    const rot   = Math.atan(slope) * 0.6;

                    // Die Eltern-Markierung färbt den Flieger selbst — erst das
                    // Papier, dann die Farbe darüber eingeblendet.
                    drawPlane(ctx, side, x, y, rot, P_SCALE, alpha);
                    if (pickK > 0) drawPlane(ctx, side, x, y, rot, P_SCALE, pickK, pickCol);

                    if (flightK >= 1) {                      // gelandet → eigene Weite
                        const a = clamp01((t - (P_LAUNCH_AT + i * P_STAGGER + P_FLIGHT)) / P_SCORE_FADE);
                        const hot = selecting ? isPick : i === P_BEST;
                        ctx.globalAlpha  = a * (isPick || !selecting ? 1 : dimK);
                        ctx.font         = `700 ${hot ? 11 : 10}px 'JetBrains Mono', monospace`;
                        ctx.textAlign    = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillStyle    = !hot ? 'rgba(255,255,255,0.55)'
                            : selecting ? pickCol : ACCENT;
                        ctx.fillText(dist.toFixed(1), endX, BASE_Y - PLANE_H - 8 - P_LABEL_ROW[i] * 13);
                        ctx.globalAlpha  = 1;
                    }
                });
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ── 'measure': drei Würfe, einmal durch. Jede gemessene Strecke bleibt
        //    zunächst auf der X-Achse liegen; sind alle drei geflogen, faden die
        //    Flieger weg und die Strecken stapeln sich zum Vergleich auf. ──────
        if (mode === 'measure') {
            const fadeAt   = M_START + M_THROWS.length * M_SLOT + M_FADE_WAIT;
            const endAt    = fadeAt + Math.max(M_FADE, M_STACK);
            const landedAt = (i: number) => M_START + i * M_SLOT + THROW_TIME + FLIGHT_TIME;
            let counted    = 0;

            const loop = (now: number) => {
                raf = requestAnimationFrame(loop);
                const dt = Math.min((now - last) / 1000, 1 / 20);
                last = now;
                t = Math.min(t + dt, endAt);   // läuft aus, statt zu loopen

                const n = M_THROWS.filter((_, i) => t >= landedAt(i)).length;
                if (n !== counted) {
                    counted = n;
                    setLanded(n);
                }

                ctx.clearRect(0, 0, W, H);
                drawAxes(ctx);

                const planeAlpha = 1 - clamp01((t - fadeAt) / M_FADE);
                const stackK     = easeOut(clamp01((t - fadeAt) / M_STACK));

                // Flieger: erst der aktuelle im Flug, danach liegen sie da.
                M_THROWS.forEach(({ dist, arc }, i) => {
                    const local = t - (M_START + i * M_SLOT);
                    if (local < 0) return;

                    if (local < THROW_TIME) {          // verlässt gerade die Hand
                        const k = local / THROW_TIME;
                        drawPlane(ctx, behind, ORIGIN_X + 26 + k * 16, BASE_Y - PLANE_H / 2 - k * 14, 0, 1 - k * 0.22, planeAlpha);
                        return;
                    }
                    const p = clamp01((local - THROW_TIME) / FLIGHT_TIME);
                    drawArcPlane(ctx, side, mToPx(dist), arc, p, planeAlpha, p < 1);
                });

                // Strecken: erscheinen beim Aufkommen auf der Achse (längste
                // zuerst, sonst deckt sie die kürzeren zu) und wandern beim
                // Stapeln nach oben — jede in ihre eigene Zeile.
                for (const i of M_DRAW_ORDER) {
                    const { dist, color } = M_THROWS[i];
                    const local = t - (M_START + i * M_SLOT + THROW_TIME + FLIGHT_TIME);
                    if (local < 0) continue;
                    const y = BASE_Y + (M_STACK_TOP - i * M_STACK_GAP - BASE_Y) * stackK;
                    drawMeasure(ctx, dist, y, clamp01(local / 0.3), color, i === M_BEST);
                }

                // Der Flieger, der als nächstes dran ist, liegt schon bereit.
                if (t < M_START + (M_THROWS.length - 1) * M_SLOT + THROW_TIME) {
                    const bob = Math.sin(t * 2.4) * 3;
                    drawPlane(ctx, rest, ORIGIN_X + 26, BASE_Y - PLANE_H / 2 + bob, -0.08, 1, planeAlpha * 0.9);
                }
            };

            raf = requestAnimationFrame(loop);
            return () => cancelAnimationFrame(raf);
        }

        // ── 'interactive': der Leser wirft selbst ─────────────────────────────
        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            const dt = Math.min((now - last) / 1000, 1 / 20);
            last = now;
            t += dt;

            const ph = phaseRef.current;
            if (ph === 'throw' || ph === 'flight') {
                throwRef.current.t += dt;
                if (ph === 'throw' && throwRef.current.t >= THROW_TIME) {
                    phaseRef.current = 'flight';
                    setPhase('flight');
                } else if (ph === 'flight' && throwRef.current.t >= THROW_TIME + FLIGHT_TIME) {
                    phaseRef.current = 'landed';
                    setPhase('landed');
                    setDistance(throwRef.current.dist);
                    pastRef.current = [...pastRef.current, throwRef.current.dist].slice(-6);
                }
            }

            ctx.clearRect(0, 0, W, H);
            drawAxes(ctx);

            // Die Weiten der bisherigen Faltungen — jede Faltung, eine andere Weite.
            for (const m of pastRef.current) {
                if (phaseRef.current === 'landed' && m === throwRef.current.dist) continue;
                ctx.beginPath();
                ctx.moveTo(mToPx(m), BASE_Y - 5);
                ctx.lineTo(mToPx(m), BASE_Y + 3);
                ctx.strokeStyle = 'rgba(255,255,255,0.22)';
                ctx.stroke();
            }

            const cur = phaseRef.current;

            // Der Aufruf zum nächsten Falz — pulsiert, solange nichts fliegt.
            if (cur === 'idle' || cur === 'landed') {
                ctx.font         = "700 11px 'JetBrains Mono', monospace";
                ctx.textAlign    = 'center';
                ctx.textBaseline = 'middle';
                ctx.globalAlpha  = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2.4));
                ctx.fillStyle    = ACCENT;
                ctx.fillText(
                    cur === 'idle' ? 'click to throw' : 'click to fold another',
                    W / 2, 16,
                );
                ctx.globalAlpha  = 1;
            }

            if (cur === 'idle') {
                const bob = Math.sin(t * 2.4) * 3;
                drawPlane(ctx, rest, ORIGIN_X + 26, BASE_Y - PLANE_H / 2 + bob, -0.08);
                return;
            }

            const { t: ft, dist, arc } = throwRef.current;
            const endX = mToPx(dist);

            if (cur === 'throw') {
                // Kurz von hinten, während er die Hand verlässt — und schon
                // etwas kleiner, weil er sich entfernt.
                const k = ft / THROW_TIME;
                drawPlane(ctx, behind, ORIGIN_X + 26 + k * 16, BASE_Y - PLANE_H / 2 - k * 14, 0, 1 - k * 0.22);
                return;
            }

            const p = cur === 'landed' ? 1 : clamp01((ft - THROW_TIME) / FLIGHT_TIME);
            drawArcPlane(ctx, side, endX, arc, p, 1, true);

            if (cur === 'landed') drawMeasure(ctx, dist, BASE_Y - 14, 1, ACCENT, true);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [mode]);

    const throwPlane = () => {
        if (mode !== 'interactive') return;
        if (phaseRef.current === 'throw' || phaseRef.current === 'flight') return;
        // Jeder Klick faltet den nächsten Flieger aus der Reihe — der Wurf ist
        // nicht verrauscht, die Faltung ist eine andere.
        const next = foldRef.current + 1;
        foldRef.current = next;
        setFold(next);
        throwRef.current = { t: 0, ...FOLDS[(next - 1) % FOLDS.length] };
        phaseRef.current = 'throw';
        setPhase('throw');
        setDistance(null);
    };

    const interactive = mode === 'interactive';
    const canThrow    = interactive && (phase === 'idle' || phase === 'landed');

    const ARIA: Record<string, string> = {
        interactive: 'Throw the paper plane',
        measure:     'Three paper planes are thrown and their distances measured',
        population:  'A whole batch of paper planes is folded and thrown at once, each landing at its own distance',
        selection:   'The whole batch is thrown, and the two planes that flew furthest are picked as parents',
    };

    return (
        <div className="eaviz__previewBox">
            <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="eaviz__previewCanvas"
                style={{ cursor: canThrow ? 'pointer' : 'default' }}
                onClick={interactive ? throwPlane : undefined}
                role={interactive ? 'button' : 'img'}
                tabIndex={interactive ? 0 : undefined}
                aria-label={ARIA[mode]}
                onKeyDown={interactive
                    ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); throwPlane(); } }
                    : undefined}
            />
            <div className="eaviz__previewLegend">
                {mode === 'selection'
                    ? <>
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_A_COLOR }} /> Parent A
                        <span className="eaviz__previewLegendDot" style={{ background: PARENT_B_COLOR }} /> Parent B
                    </>
                    : mode === 'population'
                    ? `${P_COUNT} planes, ${P_COUNT} distances — one generation`
                    : mode === 'measure'
                        ? (landed === 0
                            ? 'Throwing…'
                            : M_THROWS.slice(0, landed).map(({ dist, color }, i) => (
                                <span key={i}>
                                    <span className="eaviz__previewLegendDot" style={{ background: color }} />
                                    {' '}{dist.toFixed(1)}m
                                </span>
                            )))
                        : distance !== null
                            ? <>Fold #{fold} flew <strong style={{ color: ACCENT, margin: '0 4px' }}>{distance.toFixed(1)} m</strong> — fold the next one and see.</>
                            : phase === 'idle' ? 'Click the plane to throw it' : 'Measuring…'}
            </div>
        </div>
    );
}
