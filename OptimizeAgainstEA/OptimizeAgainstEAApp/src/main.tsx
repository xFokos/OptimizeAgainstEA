import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import SettingsPage from "./pages/SettingsPage.tsx";
import AnalyticsPage from "./pages/AnalyticsPage.tsx";
import GamePage from "./pages/GamePage.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/Settings" element={<SettingsPage />} />
                <Route path="/Game" element={<GamePage />} />
                <Route path="/Analytics" element={<AnalyticsPage />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
