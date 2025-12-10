// src/pages/JumpGame.tsx
import React, { useState, useEffect } from "react";
import "../styles/JumpGame.css";
import NavigatePageButton from "../components/NavigatePageButton.tsx";


const JumpGame: React.FC = () => {
    const [isJumping, setIsJumping] = useState<boolean>(false);
    const [jumpCount, setJumpCount] = useState<number>(0);

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
            <NavigatePageButton to={"/Analytics"} text={"View Analytics"} />
        </div>
    );
};

export default JumpGame;
