import { useEffect, useState } from 'react';
import { gameStore } from '../game/gameStore';
import { DNA_NAMES } from '../shooter.types';

export function DNADisplay() {
    const [dna, setDna] = useState<number[]>(() =>
        gameStore.state?.agent?.dna ?? []
    );

    useEffect(() => {
        const unsubscribe = gameStore.subscribe(() => {
            setDna([...gameStore.state.agent.dna]);
        });
        return unsubscribe;
    }, []);

    return (
        <div style={styles.panel}>
            {dna.map((v, i) => (
                <div key={i}>
                    {DNA_NAMES[i]}: {v.toFixed(3)}
                </div>
            ))}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    panel: {
        width:        '260px',
        background:   '#111',
        color:        '#fff',
        fontFamily:   'monospace',
        padding:      '10px',
        borderLeft:   '1px solid #333',
        height:       '100%',
        overflowY:    'auto',
        boxSizing:    'border-box',
    },
};