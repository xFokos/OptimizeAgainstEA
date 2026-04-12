import { useRef, useEffect } from "react";
import type { MathFunction } from "../../../utils/functions.ts";
import { drawContourLine } from "../../../utils/marchingSquares.ts";


type Props = {
    points: { x: number; y: number }[];
    selectedPoint: { x: number; y: number } | null;
    hoveredPointIndex?: number | null;
    onSelect: (x: number, y: number) => void;
    showFunction: boolean;
    fn: MathFunction;
    style?: React.CSSProperties;
};

export default function GameMap({
                                    selectedPoint,
                                    hoveredPointIndex,
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

    const getColorForValue = (value: number) => {
        const levels = [0.1, 0.5, 1, 2, 5, 10, 13, 15, 20, 40];
        const colors = [
            "rgba(64,224,208,1)",   // helles Türkis → beste Punkte
            "rgba(0,200,150,1)",    // sattes Grün
            "rgba(50,205,50,1)",    // LimeGreen
            "rgba(173,255,47,1)",   // gelbgrün
            "rgb(220,220,14)",    // Gelb
            "rgba(255,200,0,1)",    // Orange
            "rgba(255,150,0,1)",    // dunkleres Orange
            "rgba(255,100,50,1)",   // rötlich-orange
            "rgba(255,50,0,1)",     // Rot
            "rgba(200,0,0,1)",      // dunkelrot → schlechteste Punkte
        ];

        // Finde das erste Level, das größer als value ist
        for (let i = 0; i < levels.length; i++) {
            if (value <= levels[i]) return colors[i] ?? "rgba(200,0,0,0.4)";
        }
        return colors[colors.length - 1];
    };

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
                "rgba(64,224,208,1)",   // helles Türkis → beste Punkte
                "rgba(0,200,150,1)",    // sattes Grün
                "rgba(50,205,50,1)",    // LimeGreen
                "rgba(173,255,47,1)",   // gelbgrün
                "rgb(220,220,14)",    // Gelb
                "rgba(255,200,0,1)",    // Orange
                "rgba(255,150,0,1)",    // dunkleres Orange
                "rgba(255,100,50,1)",   // rötlich-orange
                "rgba(255,50,0,1)",     // Rot
                "rgba(200,0,0,1)",      // dunkelrot → schlechteste Punkte
            ];
            levels.forEach((level, i) => {
                ctx.strokeStyle = colors[i] ?? "rgba(200,0,0,0.4)";
                //ctx.lineWidth = i === 0 ? 2.5 : 1.5;
                ctx.lineWidth = 2;
                drawContourLine(
                    ctx,
                    fn,
                    level,
                    (px, py) => toWorld(px, py, width, height),
                    width,
                    height,
                    { step: 5 }
                );
            });
        }

        // bestätigte Punkte
        points.forEach((pt, i) => {
            const { px, py } = toScreen(pt.x, pt.y, width, height);
            const value = fn(pt.x, pt.y);

            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = getColorForValue(value);
            ctx.fill();

            if (i === hoveredPointIndex) {
                ctx.lineWidth = 3;
                ctx.strokeStyle = "black";
                ctx.stroke();
            }
        });

        // aktueller Punkt
        if (selectedPoint) {
            const { px, py } = toScreen(selectedPoint.x, selectedPoint.y, width, height);
            ctx.beginPath();
            ctx.arc(px, py, 6, 0, Math.PI * 2);
            ctx.fillStyle = "blue";
            ctx.fill();
        }
    }, [selectedPoint, points, showFunction, fn, hoveredPointIndex]);

    return (
        <canvas
            ref={canvasRef}
            width={1000}
            height={1000}
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
