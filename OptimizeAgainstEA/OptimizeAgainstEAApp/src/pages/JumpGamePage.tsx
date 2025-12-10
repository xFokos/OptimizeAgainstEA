// src/pages/JumpGame.tsx
import React, { useState, useEffect } from "react";
import "../styles/JumpGame.css";
import { useNavigate } from "react-router-dom";


const JumpGame: React.FC = () => {
    const [isJumping, setIsJumping] = useState<boolean>(false);
    const [jumpCount, setJumpCount] = useState<number>(0);
    const navigate = useNavigate();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === "Space") {
                setIsJumping(true);
                setJumpCount((prev) => prev + 1);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (isJumping) {
            const timer = setTimeout(() => setIsJumping(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isJumping]);

    return (
        <div className="jump-game-page">
            <div className="game-container">
                <div className={`player ${isJumping ? "jump" : ""}`}></div>
            </div>
            <p>Sprünge: {jumpCount}</p>
            <button onClick={() => navigate("/")}>Zurück zur Startseite</button>
        </div>
    );
};

export default JumpGame;
