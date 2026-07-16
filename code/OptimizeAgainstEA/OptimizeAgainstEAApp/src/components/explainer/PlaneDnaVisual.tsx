import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import './eaConceptVisuals.css';

// Step "DNA" des generellen EA-Tutorials: derselbe Papierflieger, aber jetzt
// als Zahlen. Aufgebaut wie die DNA-Steps im Shooter-Tutorial (ShooterDnaSection
// + DnaPreviewCanvas): links unter dem Text die Regler, rechts das Fenster, in
// dem sich der Flieger sofort mitverändert. Beide sind *controlled* — die DNA
// hält der Aufrufer (siehe EAExplainedTab), damit Regler und Vorschau dieselbe
// Zahl sehen.
//
// Die Gene sind genau die, die man am PNG auch wirklich sehen kann — nichts
// erklären, was das Bild nicht zeigt.

const W = 300;
const H = 240;

const PLANE_SRC = '/PaperPlane2.png';   // 3/4 von oben — Flügel gut sichtbar
const BASE_H    = 96;                   // Höhe des Fliegers bei Gen-Wert 0.5
const ACCENT    = '#4fc3f7';

export interface PlaneGene {
    index:  number;
    label:  string;
    /** Wie das Gen den gezeichneten Flieger verzerrt — 0…1 auf einen Faktor. */
    factor: (v: number) => number;
}

/** Die volle Papierflieger-DNA. Ein Step kann sich davon eine Teilmenge geben
 *  lassen (`genes`) — der DNA-Vektor bleibt derselbe. */
export const PLANE_GENES: PlaneGene[] = [
    { index: 0, label: 'Size',      factor: v => 0.45 + v * 1.3 },
    { index: 1, label: 'Wing span', factor: v => 0.6 + v * 0.9 },
    { index: 2, label: 'Length',    factor: v => 0.7 + v * 0.7 },
];

export const PLANE_SIZE_GENE = PLANE_GENES.filter(g => g.index === 0);

export const PLANE_DNA_START = [0.5, 0.6, 0.5];

// ── Regler (links, unter dem Text) ────────────────────────────────────────

interface PlaneDnaSlidersProps {
    dna:      number[];
    onChange: (index: number, value: number) => void;
    /** Welche Zeilen gezeigt werden. Default: das ganze Genom. */
    genes?:   PlaneGene[];
}

export function PlaneDnaSliders({ dna, onChange, genes = PLANE_GENES }: PlaneDnaSlidersProps) {
    return (
        <div style={styles.grid}>
            {genes.map(gene => (
                <div key={gene.index} style={styles.row}>
                    <span style={styles.label}>{gene.label}</span>
                    <input
                        type="range" min={0} max={1} step={0.01}
                        value={dna[gene.index]}
                        onChange={e => onChange(gene.index, parseFloat(e.target.value))}
                        className="slider"
                        style={styles.slider}
                        aria-label={gene.label}
                    />
                    <span style={styles.value}>{dna[gene.index].toFixed(2)}</span>
                </div>
            ))}
        </div>
    );
}

// ── Vorschau (rechts) ─────────────────────────────────────────────────────

interface PlaneDnaPreviewProps {
    dna: number[];
    /** Welche Gene unter dem Fenster als Zahlenreihe stehen — dieselbe Teilmenge,
     *  die der Step auch als Regler zeigt. Was man nicht ziehen kann, soll hier
     *  auch nicht als Zahl herumstehen. Default: das ganze Genom. */
    genes?: PlaneGene[];
}

export function PlaneDnaPreview({ dna, genes = PLANE_GENES }: PlaneDnaPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    // Die rAF-Schleife (fürs leichte Wippen) läuft dauerhaft und liest die DNA
    // jeden Frame aus dem Ref — sonst würde sie bei jedem Regler-Pixel neu
    // starten. Gleiche Lösung wie in DnaPreviewCanvas.
    const dnaRef = useRef(dna);
    useEffect(() => { dnaRef.current = dna; }, [dna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx    = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const img = new Image();
        img.src = PLANE_SRC;

        let t    = 0;
        let last = performance.now();
        let raf  = 0;

        const loop = (now: number) => {
            raf = requestAnimationFrame(loop);
            t += Math.min((now - last) / 1000, 1 / 20);
            last = now;

            ctx.clearRect(0, 0, W, H);
            if (!img.complete || img.naturalWidth === 0) return;

            const [size, span, len] = dnaRef.current;
            const h = BASE_H * PLANE_GENES[0].factor(size);
            const w = h * (img.naturalWidth / img.naturalHeight);

            ctx.save();
            ctx.translate(W / 2, H / 2 + Math.sin(t * 2) * 4);
            ctx.rotate(-0.06);
            // Spannweite dehnt quer, Länge längs — beides um die Mitte, damit
            // der Flieger beim Ziehen nicht aus dem Fenster wandert.
            ctx.scale(PLANE_GENES[2].factor(len), PLANE_GENES[1].factor(span));
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, []);

    return (
        <div className="eaviz__previewBox">
            <canvas ref={canvasRef} width={W} height={H} className="eaviz__previewCanvas" />
            {/* Die DNA selbst: nur eine Reihe Zahlen — genau das, was der EA sieht. */}
            <div style={styles.strip}>[{genes.map(g => dna[g.index].toFixed(2)).join(', ')}]</div>
        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    strip: {
        fontFamily:    'var(--font-mono, monospace)',
        fontSize:      13,
        color:         ACCENT,
        letterSpacing: '0.04em',
    },
    grid: {
        display:       'flex',
        flexDirection: 'column',
        gap:           8,
        width:         '100%',
    },
    row: {
        display:             'grid',
        gridTemplateColumns: '78px 1fr 34px',
        alignItems:          'center',
        gap:                 10,
    },
    label: {
        fontFamily: 'var(--font-mono, monospace)',
        fontSize:   11,
        color:      'var(--text-dim, rgba(255,255,255,0.55))',
    },
    slider: {
        width:  '100%',
        cursor: 'pointer',
    },
    value: {
        fontFamily: 'var(--font-mono, monospace)',
        fontSize:   11,
        color:      ACCENT,
        textAlign:  'right',
    },
};
