// components/GameMap.tsx
import { useRef, useEffect } from "react";
import type { MathFunction } from "../utils/functions";
import { drawContourLine } from "../utils/marchingSquares";

type Props = {
    selectedPoint: { x: number; y: number } | null;        // temporärer Punkt
    confirmedPoints: { x: number; y: number }[];          // alle bestätigten Punkte
    onSelect: (x: number, y: number) => void;
    showFunction: boolean;
    fn: MathFunction;
    style?: React.CSSProperties;
};

export default function GameMap({
                                    selectedPoint,
                                    confirmedPoints,
                                    onSelect,
                                    showFunction,
                                    fn,
                                    style,
                                }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const WORLD_MIN = -4;
    const WORLD_MAX = 4;

    const toWorld = (px: number, py: number, w: number, h: number) => ({
        x: WORLD_MIN + (px / w) * (WORLD_MAX - WORLD_MIN),
        y: WORLD_MAX - (py / h) * (WORLD_MAX - WORLD_MIN),
    });

    const toScreen = (x: number, y: number, w: number, h: number) => ({
        px: ((x - WORLD_MIN) / (WORLD_MAX - WORLD_MIN)) * w,
        py: ((WORLD_MAX - y) / (WORLD_MAX - WORLD_MIN)) * h,
    });

    useEffect(() => {
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const { width, height } = canvas;

        // Hintergrund + Grid
        ctx.clearRect(0, 0, width, height);
        if (style?.backgroundColor) {
            ctx.fillStyle = style.backgroundColor;
            ctx.fillRect(0, 0, width, height);
        }

        if (style?.backgroundImage) {
            // Grid wird via CSS gesetzt, Canvas selbst kann optional noch Linien zeichnen
        }

        // Funktionslinien
        if (showFunction) {
            const levels = [0.1, 0.5, 1, 2, 5, 10, 13, 15, 20, 40];
            const colors = [
                "rgba(0,150,0,0.8)",
                "rgba(255,200,0,0.7)",
                "rgba(255,150,0,0.6)",
                "rgba(200,0,0,0.5)",
            ];

            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            levels.forEach((level, i) => {
                ctx.strokeStyle = colors[i] ?? "rgba(200,0,0,0.4)";
                ctx.lineWidth = i === 0 ? 2.5 : 1.5;

                drawContourLine(
                    ctx,
                    fn,
                    level,
                    (px, py) => toWorld(px, py, width, height),
                    width,
                    height,
                    { step: 2 }
                );
            });
        }

        // Bestätigte Punkte
        confirmedPoints.forEach(point => {
            const { px, py } = toScreen(point.x, point.y, width, height);
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = "blue";
            ctx.fill();
        });

        // Temporärer Punkt
        if (selectedPoint) {
            const { px, py } = toScreen(selectedPoint.x, selectedPoint.y, width, height);
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = "red";
            ctx.fill();
        }

    }, [selectedPoint, confirmedPoints, showFunction, fn, style]);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={500}
            style={{ width: "100%", height: "100%", cursor: "crosshair", ...style }}
            onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = toWorld(
                    e.clientX - rect.left,
                    e.clientY - rect.top,
                    rect.width,
                    rect.height
                );
                onSelect(pos.x, pos.y);
            }}
        />
    );
}
