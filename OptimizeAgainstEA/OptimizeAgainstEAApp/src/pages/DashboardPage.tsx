import { useState } from "react";
import "../styles/dashboard.css";

type Section = "problemSelect" | "gameSettings" | "algorithmSettings" | "overview";

export default function DashboardPage() {
    const [active, setActive] = useState<Section>("problemSelect");

    return (
        <div className="layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <h2 className="sidebar-title">Game Configuration </h2>

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
                        label="Algorithm  Settings"
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
                {active === "problemSelect" && <ProblemSelection />}
                {active === "gameSettings" && <GameSettings />}
                {active === "algorithmSettings" && <AlgorithmSettings />}
                {active === "overview" && <Overview />}
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
        <button
            className={`menu-item ${active ? "active" : ""}`}
            onClick={onClick}
        >
            {label}
        </button>
    );
}

/* ---------- Views ---------- */

function ProblemSelection() {
    return (
        <>
            <h1 className="page-title">Choose Optimization Problem</h1>

            <div className="problem-list">
                <ProblemCard
                    title="Traveling Salesman"
                    description="Find the shortest possible route visiting each city exactly once."
                />
                <ProblemCard
                    title="Knapsack Problem"
                    description="Maximize value while staying within a fixed weight limit."
                />
                <ProblemCard
                    title="Job Scheduling"
                    description="Optimize execution order under time constraints."
                />
                <ProblemCard
                    title="Vehicle Routing"
                    description="Plan optimal delivery routes for multiple vehicles."
                />
            </div>
        </>
    );
}
function ProblemCard({
                         title,
                         description,
                     }: {
    title: string;
    description: string;
}) {
    return (
        <div className="problem-card">
            <div className="problem-image" />
            <div className="problem-text">
                <h3>{title}</h3>
                <p>{description}</p>
            </div>
        </div>
    );
}


function GameSettings() {
    return (
        <>
            <h1 className="page-title">Game Settings</h1>
            <div className="centered">

            </div>
        </>

    );
}
function AlgorithmSettings() {
    return (
        <>
            <h1 className="page-title">Algorithm</h1>
            <div className="centered">

            </div>
        </>

    );
}

function Overview() {
    return (
        <>
            <h1 className="page-title">Dashboard</h1>
            <div className="blocks">
                <Block title="Block A" />
            </div>
        </>
    );
}

function Block({ title, wide }: { title: string; wide?: boolean }) {
    return (
        <div className={`block ${wide ? "wide" : ""}`}>
            <h3>{title}</h3>
        </div>
    );
}
