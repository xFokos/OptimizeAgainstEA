import PageContainer from "../components/PageContainer";
import GameMap from "../components/GameMap";
import { useState } from "react";
import { bealeFunction } from "../utils/functions";

export default function MapGamePage() {
    const [selectedPoint, setSelectedPoint] = useState<{ x: number; y: number } | null>(null);
    const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
    const [score, setScore] = useState<number | null>(null);
    const [showFunction, setShowFunction] = useState(false);

    const confirmPoint = () => {
        if (!selectedPoint) return;

        // Punkt ins Array der bestätigten Punkte speichern
        setPoints([...points, selectedPoint]);

        // Funktionswert für Feedback
        const value = bealeFunction(selectedPoint.x, selectedPoint.y);
        setScore(value);

        // Temporären Punkt zurücksetzen
        setSelectedPoint(null);
    };

    return (
        <PageContainer>
            <div className="sidebar-left">
                <h3>Funktion</h3>
                <p>Beale Function</p>
                <small>f(x,y) Minimum bei (3, 0.5)</small>
            </div>

            <div className="game-container">
                <div className="game-window"
                     style={{
                         backgroundColor: "#f5f5f5",
                         backgroundImage: `
                                repeating-linear-gradient(to right, #ccc 0 1px, transparent 1px 40px),
                                repeating-linear-gradient(to bottom, #ccc 0 1px, transparent 1px 40px)
                            `,
                         backgroundPosition: "center center",
                         backgroundSize: "40px 40px",
                     }}>
                    <GameMap
                        selectedPoint={selectedPoint}   // temporärer Punkt
                        confirmedPoints={points}        // bestätigte Punkte
                        onSelect={(x, y) => setSelectedPoint({ x, y })}
                        showFunction={showFunction}
                        fn={bealeFunction}
                    />
                </div>

                <div className="game-bar-down">
                    <button onClick={confirmPoint}>Punkt bestätigen</button>

                    <label>
                        <input
                            type="checkbox"
                            checked={showFunction}
                            onChange={() => setShowFunction(!showFunction)}
                        />
                        Funktion anzeigen
                    </label>
                </div>
            </div>

            <div className="sidebar-right">
                <h3>Feedback</h3>
                {score !== null && (
                    <p>
                        Funktionswert: <strong>{score.toFixed(4)}</strong>
                    </p>
                )}
            </div>
        </PageContainer>
    );
}
