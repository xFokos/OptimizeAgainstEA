import { Routes, Route } from "react-router-dom";

import "./App.css";
import HomePage from "./pages/HomePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import GamePage from "./pages/GamePage.tsx";
import AnalyticsPage from "./pages/AnalyticsPage.tsx";
import JumpGamePage from "./pages/JumpGamePage.tsx";
import TravelingSalesmanPage from "./pages/TravelingSalesmanPage.tsx";
import ProblemPage from "./pages/ProblemPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/Settings" element={<SettingsPage />} />
            <Route path="/Game" element={<GamePage />} />
            <Route path="/Analytics" element={<AnalyticsPage />} />
            <Route path="/JumpGame" element={<JumpGamePage />} />
            <Route path="/TravelingSalesman" element={<TravelingSalesmanPage />} />
            <Route path="Problem" element={<ProblemPage />}/>
            <Route path="Dashboard" element={<DashboardPage />}/>
        </Routes>
    );
}