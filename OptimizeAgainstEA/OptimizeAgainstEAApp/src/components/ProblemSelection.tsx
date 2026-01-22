// ProblemSelection.tsx
import type { ProblemId } from "../pages/DashboardPage";

export type ProblemSelectionProps = {
    value?: ProblemId;                  // Aktuell ausgewähltes Problem
    onChange: (p: ProblemId) => void;  // Callback, um den State zu ändern
};

export function ProblemSelection({ value, onChange }: ProblemSelectionProps) {
    return (
        <>
            <h1 className="page-title">Choose Optimization Problem</h1>
            <div className="problem-list">
                <ProblemCard
                    title="Map Game"
                    description="Find the right place on the map."
                    active={value === "mapGame"}
                    onClick={() => onChange("mapGame")}
                />
                <ProblemCard
                    title="Traveling Salesman"
                    description="Find the shortest route."
                    active={value === "tsp"}
                    onClick={() => onChange("tsp")}
                />
                <ProblemCard
                    title="Placeholder"
                    description="Example problem."
                    active={value === "placeHolder"}
                    onClick={() => onChange("placeHolder")}
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
        <div className={`problem-card ${active ? "active" : ""}`} onClick={onClick}>
            <div className="problem-image" />
            <div className="problem-text">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}
