import { useState } from "react";
import "../styles/specific/dashboard.css";
import { ProblemSelection } from "../modules/selectProblemPage/page/ProblemSelection.tsx";
import SelectionOverview from "../modules/selectProblemPage/components/SelectionOverview.tsx";

type Section = "problemSelect" | "gameSettings" | "algorithmSettings" | "overview";

// Typen exportieren, damit andere Dateien sie verwenden können
export type ProblemId = "tsp" | "mapGame" | "knapsack" | "placeHolder";
export type GameConfig = {
    problem?: ProblemId;
};

export default function DashboardPage() {
    const [active, setActive] = useState<Section>("problemSelect");

    // <-- hier kommt der State für die Spielkonfiguration
    const [config, setConfig] = useState<GameConfig>({ problem: undefined });

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <h2 className="sidebar-title">Game Configuration</h2>
                <nav className="sidebar-menu">
                    <MenuItem
                        label="Optimization Problem"
                        active={active === "problemSelect"}
                        onClick={() => setActive("problemSelect")}
                    />
                    <MenuItem
                        label="Game Settings"
                        active={active === "gameSettings"}
                        onClick={() => setActive("gameSettings")}
                    />
                    <MenuItem
                        label="Algorithm Settings"
                        active={active === "algorithmSettings"}
                        onClick={() => setActive("algorithmSettings")}
                    />
                    <MenuItem
                        label="Overview"
                        active={active === "overview"}
                        onClick={() => setActive("overview")}
                    />
                </nav>
            </aside>

            {/* Content */}
            <main className="content">
                {active === "problemSelect" && (
                    <ProblemSelection
                        value={config.problem}
                        onChange={(p) => setConfig((prev) => ({ ...prev, problem: p }))}
                    />
                )}

                {active === "overview" && <SelectionOverview config={config} />}
                {active === "gameSettings" && <GameSettings />}
                {active === "algorithmSettings" && <AlgorithmSettings />}
            </main>
        </div>
    );
}

function MenuItem({
                      label,
                      active,
                      onClick,
                  }: {
    label: string;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button className={`menu-item ${active ? "active" : ""}`} onClick={onClick}>
            {label}
        </button>
    );
}

function GameSettings() {
    return (
        <>
            <h1 className="page-title">Game Settings</h1>
            <div className="centered"></div>
        </>
    );
}

function AlgorithmSettings() {
    return (
        <>
            <h1 className="page-title">Algorithm</h1>
            <div className="centered"></div>
        </>
    );
}

