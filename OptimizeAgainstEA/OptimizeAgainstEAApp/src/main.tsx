import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter} from "react-router-dom";
import App from "./App";
import "./index.css";
import "./styles/primitives/buttons.css";
import "./styles/primitives/sliders.css";
import "./styles/primitives/switch.css";
import "./styles/primitives/overlays.css";
import "./styles/primitives/panels.css";
import "./styles/primitives/badges.css";
import "./styles/primitives/eyebrows.css";
import "./styles/specific/GameModeSelector.css";
import "./styles/specific/EASettingsPanel.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
