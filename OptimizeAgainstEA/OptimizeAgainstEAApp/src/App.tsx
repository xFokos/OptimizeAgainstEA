import {Route, Routes} from "react-router-dom";
import {SettingsProvider} from "./context/SettingsContext"; // neu
import "./App.css";
import HomePage from "./pages/HomePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import GamePage from "./pages/GamePage.tsx";
import AnalyticsPage from "./pages/AnalyticsPage.tsx";
import ProblemPage from "./pages/ProblemPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import ShooterGamePage from "./pages/ShooterGamePage.tsx";
import BattleShipsPage from "./pages/BattleShipsPage.tsx";
import MazeGamePage from "./pages/MazeGamePage.tsx";
import ShooterLobbyPage from "./pages/lobby/ShooterLobbyPage";
import HordeGamePage from "./pages/HordeGamePage.tsx";
import HordeMapEditorPage from "./pages/HordeMapEditorPage.tsx";
import ButtonsPage from "./pages/ButtonsPage.tsx";
import FunctionTunerPage from "./pages/FunctionTunerPage.tsx";

export default function App() {
    return (
        <SettingsProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/Settings" element={<SettingsPage />} />
                <Route path="/Game" element={<GamePage />} />
                <Route path="/Analytics" element={<AnalyticsPage />} />
                <Route path="/PeakFinder" element={<BattleShipsPage />} />
                <Route path="/MazeExplorer" element={<MazeGamePage />} />
                <Route path="Problem" element={<ProblemPage />}/>
                <Route path="Dashboard" element={<DashboardPage />}/>
                <Route path="ShooterGame" element={<ShooterGamePage/>}/>
                <Route path="/lobby/shooter" element={<ShooterLobbyPage />} />
                <Route path="/HordeGame" element={<HordeGamePage />} />
                <Route path="/HordeMapEditor" element={<HordeMapEditorPage />} />
                <Route path="/Buttons" element={<ButtonsPage />} />
                <Route path="/FunctionTuner" element={<FunctionTunerPage />} />
            </Routes>
        </SettingsProvider>
);
}