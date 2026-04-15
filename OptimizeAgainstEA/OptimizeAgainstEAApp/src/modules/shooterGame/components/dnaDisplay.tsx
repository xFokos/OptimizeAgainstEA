import { gameStore } from "./ShooterCanvas.tsx";
import { DNA_NAMES } from "../shooter.types.ts";

export function DNADisplay() {
    const dna = gameStore.state.agent.dna;

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
        width: "260px",
        background: "#111",
        color: "#fff",
        fontFamily: "monospace",
        padding: "10px",
        margin: "20px",
        borderLeft: "1px solid #333",
        height: "100vh",
        overflowY: "auto",
    },
};