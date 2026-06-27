import type { GameConfig } from "../../../pages/DashboardPage.tsx";
import NavigatePageButton from "../../../components/ui/NavigatePageButton.tsx";

export default function SelectionOverview({ config }: { config: GameConfig }) {
    const routes: Record<string, string> = {
        tsp: "/TravelingSalesman",
        mapGame: "/MapGame",
        knapsack: "/",
        battleShips: "/PeakFinder",
        shooter:     "/lobby/shooter",
        horde:       "/lobby/horde",
        placeHolder: "/Game",
        vrp: "/vrp",
    };

    const path = config.problem ? routes[config.problem] : "";

    return (
        <>
            <h1 className="page-title">Overview</h1>

            <div className="blocks">
                <div className="block">
                    <h3>Problem: {config.problem ?? "—"}</h3>
                </div>
            </div>

            {/* Button-Container */}
            <div
                style={{
                    height: "60px",           // fester Platz für den Button
                    display: "flex",
                    justifyContent: "center", // horizontal zentrieren
                    alignItems: "center",     // vertikal zentrieren
                    marginTop: "20px",        // optional: Abstand nach oben
                }}
            >
                {path ? (
                    <NavigatePageButton
                        to={path}
                        text="Start Game"
                        width="200px"
                        height="50px"
                    />
                ) : (
                    <button className="primary-button" disabled>
                        Bitte wähle zuerst ein Problem
                    </button>
                )}
            </div>
        </>
    );
}

