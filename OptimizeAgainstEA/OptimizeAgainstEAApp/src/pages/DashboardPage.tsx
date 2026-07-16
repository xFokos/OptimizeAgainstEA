import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/specific/dashboard.css";
import { ProblemSelection } from "../modules/selectProblemPage/page/ProblemSelection.tsx";
import { EAExplainedTab } from "./EAExplainedTab.tsx";

type Section = "gameSelect" | "eaExplained";

export type ProblemId = "battleShips" | "shooter" | "mazeExplorer";
export type GameConfig = {
    problem?: ProblemId;
};

const ROUTES: Record<ProblemId, string> = {
    battleShips: "/PeakFinder",
    shooter:     "/lobby/shooter",
    mazeExplorer: "/mazeExplorer",
};

export default function DashboardPage() {
    // ?tab=ea — womit die Homepage direkt in die Erklärung springen kann,
    // statt auf der Spielauswahl zu landen.
    const [params] = useSearchParams();
    const [active, setActive] = useState<Section>(
        params.get("tab") === "ea" ? "eaExplained" : "gameSelect",
    );
    const [config, setConfig] = useState<GameConfig>({ problem: undefined });
    const [sidebarOpen, setSidebarOpen] = useState(false);

    function handleNav(section: Section) {
        setActive(section);
        setSidebarOpen(false);
    }

    return (
        <div className="layout">
            <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen((o) => !o)}
                aria-label="Toggle sidebar"
            >
                {sidebarOpen ? "✕" : "☰"}
            </button>

            {sidebarOpen && (
                <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
                <div className="sidebar-brand">
                    <div className="sidebar-logo">OAE</div>
                    <span className="sidebar-brand-name">Optimize Against EA</span>
                </div>

                {/* EA Explained steht bewusst oben: wer neu ist, soll erst
                    verstehen, wogegen er gleich spielt. */}
                <nav className="sidebar-menu">
                    <MenuItem
                        label="EA Explained"
                        active={active === "eaExplained"}
                        onClick={() => handleNav("eaExplained")}
                    />
                    <MenuItem
                        label="Game Selection"
                        active={active === "gameSelect"}
                        onClick={() => handleNav("gameSelect")}
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

                {active === "eaExplained" && (
                    <EAExplainedTab onFinish={() => handleNav("gameSelect")} />
                )}
            </main>
        </div>
    );
}

function LaunchButton({ problemId }: { problemId?: ProblemId }) {
    const navigate = useNavigate();
    const enabled = problemId != null;

    return (
        <button
            className="btn btn--primary launch-btn"
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

