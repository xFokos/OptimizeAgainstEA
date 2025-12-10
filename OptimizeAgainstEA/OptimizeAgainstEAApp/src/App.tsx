import { Routes, Route } from "react-router-dom";

import HomePage from "./pages/HomePage.tsx";
import SettingsPage from "./pages/SettingsPage.tsx";
import GamePage from "./pages/GamePage.tsx";
import AnalyticsPage from "./pages/AnalyticsPage.tsx";
import "./App.css";

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/Settings" element={<SettingsPage />} />
            <Route path="/Game" element={<GamePage />} />
            <Route path="/Analytics" element={<AnalyticsPage />} />
        </Routes>
    );
}