// ProblemSelection.tsx
import type { ProblemId } from "../../../pages/DashboardPage.tsx";

export type ProblemSelectionProps = {
    value?: ProblemId;                  // Aktuell ausgewähltes Problem
    onChange: (p: ProblemId) => void;  // Callback, um den State zu ändern
};

export function ProblemSelection({ value, onChange }: ProblemSelectionProps) {
    return (
        <>
            <h1 className="page-title">Choose Game</h1>
            <div className="problem-list">
                <ProblemCard
                    title="Peak Finder"
                    description="Find your way to the highest peak"
                    image="/game-peakfinder.png"
                    active={value === "battleShips"}
                    onClick={() => onChange("battleShips")}
                />
                <ProblemCard
                    title="Shooter vs EA"
                    description="Fight against a learning genetic algorithm."
                    image="/game-shooter.png"
                    active={value === "shooter"}
                    onClick={() => onChange("shooter")}
                />
                <ProblemCard
                  title="Maze Explorer"
                  description="Experiment with EAs in a Maze environment"
                  image="Maze_Explorer.webp"
                  active={value === "mazeExplorer"}
                  onClick={() => onChange("mazeExplorer")}
                />
            </div>
        </>
    );
}

function ProblemCard({
    title,
    description,
    image,
    active,
    onClick,
}: {
    title:       string;
    description: string;
    image?:      string;
    active:      boolean;
    onClick:     () => void;
}) {
    return (
        <div className={`panel panel--interactive problem-card ${active ? "active" : ""}`} onClick={onClick}>
            <div className="problem-image">
                {image && (
                    <img
                        src={image}
                        alt={title}
                        className="problem-image__img"
                    />
                )}
            </div>
            <div className="problem-text">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}
