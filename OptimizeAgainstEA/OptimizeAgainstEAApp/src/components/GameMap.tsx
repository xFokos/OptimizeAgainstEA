import { useRef, useEffect } from "react";
import type { MathFunction } from "../utils/functions";
import { drawContourLine } from "../utils/marchingSquares";


type Props = {
    selectedPoint: { x: number; y: number } | null;
    points: { x: number; y: number }[];
    onSelect: (x: number, y: number) => void;
    showFunction: boolean;
    fn: MathFunction;
    style?: React.CSSProperties;
};

export default function GameMap({
                                    selectedPoint,
                                    points,
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

        ctx.clearRect(0, 0, width, height);

        // Grid
        ctx.strokeStyle = "#ccc";
        ctx.lineWidth = 1;
        const spacing = 40;
        for (let x = 0; x <= width; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y <= height; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Funktion-Konturlinien
        if (showFunction) {
            const levels = [0.1, 0.5, 1, 2, 5, 10, 13, 15, 20, 40];
            const colors = [
                "rgba(0,150,0,0.8)",
                "rgba(255,200,0,0.7)",
                "rgba(255,150,0,0.6)",
                "rgba(200,0,0,0.5)",
            ];
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

        // bestätigte Punkte
        points.forEach(pt => {
            const { px, py } = toScreen(pt.x, pt.y, width, height);
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = "green";
            ctx.fill();
        });

        // aktueller Punkt
        if (selectedPoint) {
            const { px, py } = toScreen(selectedPoint.x, selectedPoint.y, width, height);
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = "blue";
            ctx.fill();
        }
    }, [selectedPoint, points, showFunction, fn]);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={500}
            style={{
                width: "100%",
                height: "100%",
                cursor: "crosshair",
                backgroundColor: "#f5f5f5",
                ...style,
            }}
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
