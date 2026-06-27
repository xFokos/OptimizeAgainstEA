import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/specific/dashboard.css";
import { ProblemSelection } from "../modules/selectProblemPage/page/ProblemSelection.tsx";

type Section = "gameSelect" | "settings" | "eaExplained" | "tab4";

export type ProblemId = "battleShips" | "shooter" | "horde";
export type GameConfig = {
    problem?: ProblemId;
};

const ROUTES: Record<ProblemId, string> = {
    battleShips: "/PeakFinder",
    shooter:     "/lobby/shooter",
    horde:       "/lobby/horde",
};

export default function DashboardPage() {
    const [active, setActive] = useState<Section>("gameSelect");
    const [config, setConfig] = useState<GameConfig>({ problem: undefined });

    return (
        <div className="layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <div className="sidebar-logo">OAE</div>
                    <span className="sidebar-brand-name">Optimize Against EA</span>
                </div>

                <nav className="sidebar-menu">
                    <MenuItem
                        label="Game Selection"
                        active={active === "gameSelect"}
                        onClick={() => setActive("gameSelect")}
                    />
                    <MenuItem
                        label="Settings"
                        active={active === "settings"}
                        onClick={() => setActive("settings")}
                    />
                    <MenuItem
                        label="EA Explained"
                        active={active === "eaExplained"}
                        onClick={() => setActive("eaExplained")}
                    />
                    <MenuItem
                        label="Tab 4"
                        active={active === "tab4"}
                        onClick={() => setActive("tab4")}
                    />
                </nav>
            </aside>

            <main className="content">
                {active === "gameSelect" && (
                    <>
                        <ProblemSelection
                            value={config.problem}
                            onChange={(p) => setConfig((prev) => ({ ...prev, problem: p }))}
                        />
                        <div className="game-select-launch">
                            <LaunchButton problemId={config.problem} />
                        </div>
                    </>
                )}

                {active === "settings"    && <EmptyTab title="Settings" />}
                {active === "eaExplained" && <EmptyTab title="EA Explained" />}
                {active === "tab4"        && <EmptyTab title="Tab 4" />}
            </main>
        </div>
    );
}

function LaunchButton({ problemId }: { problemId?: ProblemId }) {
    const navigate = useNavigate();
    const enabled = problemId != null;

    return (
        <button
            className="launch-btn"
            disabled={!enabled}
            onClick={() => { if (enabled) navigate(ROUTES[problemId]); }}
        >
            {enabled ? "▶  Start Game" : "Select a game first"}
        </button>
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

function EmptyTab({ title }: { title: string }) {
    return (
        <>
            <h1 className="page-title">{title}</h1>
            <div className="centered">
                <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Coming soon</p>
            </div>
        </>
    );
}
