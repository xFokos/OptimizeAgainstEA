import { useEffect, useState } from 'react';
import { gameStore } from '../game/gameStore';
import { DNA_NAMES } from '../shooter.types';

const FONT   = 'var(--font)';
const ACCENT = 'var(--accent)';

const GENE_LABELS: Record<string, string> = {
    AGGRESSION:      'Aggression',
    DODGE_WEIGHT:    'Dodge',
    SHOOT_ACCURACY:  'Accuracy',
    PREFERRED_RANGE: 'Range',
    MOVEMENT_SPEED:  'Speed',
    PREDICT_LEAD:    'Lead',
    FIRE_RATE:       'Fire Rate',
};

function GeneBar({ name, value }: { name: string; value: number }) {
    return (
        <div style={styles.geneRow}>
            <div style={styles.geneHeader}>
                <span style={styles.geneName}>{GENE_LABELS[name] ?? name}</span>
                <span style={styles.geneValue}>{value.toFixed(2)}</span>
            </div>
            <div style={styles.barTrack}>
                <div style={{ ...styles.barFill, width: `${value * 100}%` }} />
            </div>
        </div>
    );
}

export function DNADisplay() {
    const [dna, setDna] = useState<number[]>(() =>
        gameStore.state?.agent?.dna ?? []
    );

    useEffect(() => {
        return gameStore.subscribe(() => {
            setDna([...gameStore.state.agent.dna]);
        });
    }, []);

    return (
        <div style={styles.panel}>
            <div style={styles.sectionTitle}>Agent DNA</div>
            {dna.map((v, i) => (
                <GeneBar key={i} name={DNA_NAMES[i]} value={v} />
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