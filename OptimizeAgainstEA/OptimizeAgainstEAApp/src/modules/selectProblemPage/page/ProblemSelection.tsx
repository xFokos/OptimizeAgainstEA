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
                    active={value === "battleShips"}
                    onClick={() => onChange("battleShips")}
                />
                <ProblemCard
                    title="Shooter vs EA"
                    description="Kämpfe gegen einen lernenden genetischen Algorithmus."
                    active={value === "shooter"}
                    onClick={() => onChange("shooter")}
                />
                <ProblemCard
                    title="Horde Mode"
                    description="Überlebe Wellen von EA-Agenten die sich anpassen."
                    active={value === "horde"}
                    onClick={() => onChange("horde")}
                />
            </div>
        </>
    );
}

function ProblemCard({
                         title,
                         description,
                         active,
                         onClick,
                     }: {
    title: string;
    description: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <div className={`panel panel--interactive problem-card ${active ? "active" : ""}`} onClick={onClick}>
            <div className="problem-image" />
            <div className="problem-text">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}
