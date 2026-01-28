import { useState } from "react";
import PageContainer from "../components/PageContainer";
import GameMap from "../components/GameMap";
import AnalyticsPanel from "../components/AnalyticsPanel";
import {bealeFunction, /*newFunction*/} from "../utils/functions";


//const myFunc = newFunction(2, 3); // α = 2, β = 3


export default function MapGamePage() {
    const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
    const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
    const [showFunction, setShowFunction] = useState(false);

    const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

    const confirmPoint = () => {
        if (currentPoint) {
            setPoints(p => [...p, currentPoint]);
            setCurrentPoint(null);
        }
    };

    return (
        <PageContainer>
            <div className="sidebar-left">
                <h3>Funktion</h3>
                <p>Beale Function</p>
                <small></small>
            </div>

            <div className="game-container">
                <div className="game-window">
                    <GameMap
                        selectedPoint={currentPoint}
                        hoveredPointIndex={hoveredPointIndex}
                        points={points}
                        onSelect={(x, y) => setCurrentPoint({ x, y })}
                        showFunction={showFunction}
                        fn={bealeFunction}
                    />
                </div>

                <div className="game-bar-down">
                    <button onClick={confirmPoint} disabled={!currentPoint}>
                        Punkt bestätigen
                    </button>

                    <label>
                        <input
                            type="checkbox"
                            checked={showFunction}
                            onChange={() => setShowFunction(s => !s)}
                        />
                        Funktion anzeigen
                    </label>
                </div>
            </div>

            <div className="sidebar-right">
                <h3>Analytics</h3>
                <AnalyticsPanel
                    history={points.map(pt => bealeFunction(pt.x, pt.y))}
                    onHover={setHoveredPointIndex}
                />
            </div>
        </PageContainer>
    );
}
