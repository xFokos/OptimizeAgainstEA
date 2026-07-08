import { useEffect, useRef, useState } from 'react';
import { gameStore } from '../game/gameStore';
import { getRaidbossActive } from '../game/raidbossStore';
import { DNA_NAMES, DNA_GENE_INFO } from '../shooter.types';

const FONT   = 'var(--font)';
const ACCENT = 'var(--accent)';

// ---- DNA String (Zahlen) ----

function DnaString({ dna }: { dna: number[] }) {
    return (
        <div style={styles.dnaGrid}>
            {dna.map((v, i) => (
                <span key={i} style={styles.dnaNum}>{v.toFixed(2)}</span>
            ))}
        </div>
    );
}

// ---- Gene Bars ----

function DeltaBadge({ delta }: { delta: number }) {
    if (Math.abs(delta) < 0.005) return null;
    return (
        <span style={{
            fontSize:   11,
            fontWeight: 600,
            color:      delta > 0 ? '#4ade80' : '#f87171',
            marginLeft: 6,
        }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
        </span>
    );
}

function GeneBar({ name, value, delta }: { name: string; value: number; delta: number }) {
    const info = DNA_GENE_INFO[name as keyof typeof DNA_GENE_INFO];
    return (
        <div style={styles.geneRow} title={info?.tooltip}>
            <div style={styles.geneHeader}>
                <span style={styles.geneName}>{info?.label ?? name}</span>
                <span style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={styles.geneValue}>{value.toFixed(2)}</span>
                    <DeltaBadge delta={delta} />
                </span>
            </div>
            <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${value * 100}%` }} />
            </div>
        </div>
    );
}

// ---- Hauptkomponente ----

export function DNADisplay() {
    const [dna, setDna]     = useState<number[]>(() => gameStore.state?.agent?.dna ?? []);
    const [prevDna, setPrevDna] = useState<number[]>(() => gameStore.state?.agent?.dna ?? []);

    const prevDnaRef   = useRef<number[]>(gameStore.state?.agent?.dna ?? []);
    const prevRoundRef = useRef<number>(gameStore.state?.roundNumber ?? 0);

    useEffect(() => {
        return gameStore.subscribe(() => {
            const state    = gameStore.state;
            const newDna   = state.agent.dna;
            const newRound = state.roundNumber;

            if (getRaidbossActive()) {
                // Kein Delta-Tracking in Raidboss-Modus
                prevDnaRef.current   = [...newDna];
                prevRoundRef.current = newRound;
                setPrevDna([...newDna]);
            } else if (newRound !== prevRoundRef.current) {
                // Delta nur zwischen echten Spielrunden zeigen (nicht beim ersten Start)
                if (prevRoundRef.current > 0) {
                    setPrevDna([...prevDnaRef.current]);
                }
                prevRoundRef.current = newRound;
            }

            prevDnaRef.current = [...newDna];
            setDna([...newDna]);
        });
    }, []);

    const isRaidboss = getRaidbossActive();

    return (
        <div style={styles.panel}>
            <div style={{ ...styles.sectionTitle, color: isRaidboss ? '#a855f7' : undefined }}>
                {isRaidboss ? 'Raidboss DNA' : 'Agent DNA'}
            </div>
            <DnaString dna={dna} />

            {DNA_NAMES.map((name, i) => (
                <GeneBar
                    key={i}
                    name={name}
                    value={dna[i] ?? 0}
                    delta={isRaidboss ? 0 : (dna[i] ?? 0) - (prevDna[i] ?? dna[i] ?? 0)}
                />
            ))}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    panel: {
        display:       'flex',
        flexDirection: 'column',
        gap:           14,
        color:         'var(--text)',
        fontFamily:    FONT,
        height:        '100%',
        overflowY:     'auto',
        boxSizing:     'border-box',
    },
    sectionTitle: {
        fontSize:      11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color:         'var(--text-muted)',
        marginBottom:  4,
    },
    dnaGrid: {
        display:             'flex',
        gap:                 6,
        flexWrap:            'wrap',
        marginBottom:        6,
        padding:             '8px 6px',
        background:          'rgba(255,255,255,0.04)',
        borderRadius:        6,
    },
    dnaNum: {
        fontSize:   13,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        color:      ACCENT,
    },
    geneRow: {
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
    },
    geneHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
    },
    geneName: {
        fontSize: 13,
        color:    'var(--text-dim)',
    },
    geneValue: {
        fontSize:   16,
        fontWeight: 600,
        color:      'var(--text)',
    },
    barTrack: {
        height:       8,
        borderRadius: 4,
        background:   'var(--surface-hover)',
        overflow:     'hidden',
    },
    barFill: {
        height:       '100%',
        borderRadius: 4,
        background:   ACCENT,
        transition:   'width 0.2s ease',
        opacity:      0.85,
    },
};
