import { useState, useRef, useEffect } from "react";
import type { Node, Edge } from "../types";
import NavigatePageButton from "./NavigatePageButton";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

const NODE_RADIUS = 20;
const NODE_COUNT = 20;

export default function TravelingSalesman() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [bestEdges, setBestEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const [undoStack, setUndoStack] = useState<Edge[][]>([]);
    const [redoStack, setRedoStack] = useState<Edge[][]>([]);
    const [isFinished, setIsFinished] = useState(false);

    const [history, setHistory] = useState<number[]>([]);
    const [showButton, setShowButton] = useState(false);

    const chartData = history.map((l, i) => ({
        iteration: i + 1,
        length: l,
    }));


    /* ---------------------------------- */
    /* Node generation with minimum distance */
    /* ---------------------------------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const generated: Node[] = [];
        const MIN_DISTANCE = NODE_RADIUS * 4; // minimum distance between nodes

        function isFarEnough(x: number, y: number) {
            return generated.every(
                n => Math.hypot(n.x - x, n.y - y) >= MIN_DISTANCE
            );
        }

        let attempts = 0;
        while (generated.length < NODE_COUNT && attempts < NODE_COUNT * 50) {
            const x = Math.random() * (canvas.width - NODE_RADIUS * 2) + NODE_RADIUS;
            const y = Math.random() * (canvas.height - NODE_RADIUS * 2) + NODE_RADIUS;

            if (isFarEnough(x, y)) {
                generated.push({ id: generated.length, x, y });
            } else {
                attempts++;
            }
        }

        setNodes(generated);
    }, []);

    /* ---------------------------------- */
    /* Update bestEdges when a new iteration finishes */
    /* ---------------------------------- */
    useEffect(() => {
        if (!isFinished) return;

        if (!bestEdges.length || pathLength() < computePathLength(bestEdges)) {
            setBestEdges(edges);
        }
    }, [isFinished]);


    /* ---------------------------------- */
    /* Drawing                            */
    /* ---------------------------------- */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw best edges first (lower opacity)
        ctx.strokeStyle = "rgba(100,100,100,0.3)"; // semi-transparent gray
        ctx.lineWidth = 2;
        bestEdges.forEach(e => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b) return;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });

        // Draw current edges
        ctx.strokeStyle = "black";
        edges.forEach(e => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b) return;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });

        // Draw nodes
        nodes.forEach(n => {
            const connections = edges.filter(
                e => e.from === n.id || e.to === n.id
            ).length;

            ctx.fillStyle =
                selectedNode?.id === n.id
                    ? "orange"
                    : connections === 2
                        ? "green"
                        : "skyblue";

            ctx.beginPath();
            ctx.arc(n.x, n.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }, [nodes, edges, selectedNode, bestEdges]);

    /* ---------------------------------- */
    /* Helpers                            */
    /* ---------------------------------- */
    function wouldFormCycle(edges: Edge[], from: number, to: number): boolean {
        const adj: Record<number, number[]> = {};
        edges.forEach(e => {
            adj[e.from] ??= [];
            adj[e.to] ??= [];
            adj[e.from].push(e.to);
            adj[e.to].push(e.from);
        });

        const visited = new Set<number>();
        function dfs(n: number): boolean {
            if (n === to) return true;
            visited.add(n);
            return (adj[n] || []).some(x => !visited.has(x) && dfs(x));
        }

        return dfs(from);
    }

    function pathLength(): number {
        return edges.reduce((sum, e) => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b) return sum;
            return sum + Math.hypot(a.x - b.x, a.y - b.y);
        }, 0);
    }

    function selectGraphEnd(edges: Edge[], nodes: Node[]): Node | null {
        if (edges.length === 0) return null;

        // Count degrees
        const degree: Record<number, number> = {};
        edges.forEach(e => {
            degree[e.from] = (degree[e.from] ?? 0) + 1;
            degree[e.to] = (degree[e.to] ?? 0) + 1;
        });

        // Prefer last edge's endpoint if possible
        const last = edges[edges.length - 1];
        if ((degree[last.to] ?? 0) < 2) {
            return nodes.find(n => n.id === last.to) ?? null;
        }

        // Otherwise find any open node
        return (
            nodes.find(n => (degree[n.id] ?? 0) < 2) ?? null
        );
    }

    function computePathLength(edgeArray: Edge[]) {
        return edgeArray.reduce((sum, e) => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b) return sum;
            return sum + Math.hypot(a.x - b.x, a.y - b.y);
        }, 0);
    }


    /* ---------------------------------- */
    /* Click handling                     */
    /* ---------------------------------- */
    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const clicked = nodes.find(
            n => Math.hypot(n.x - x, n.y - y) <= NODE_RADIUS
        );
        if (!clicked) return;

        const conn = edges.filter(
            e => e.from === clicked.id || e.to === clicked.id
        ).length;
        if (conn >= 2) return;

        if (!selectedNode) {
            setSelectedNode(clicked);
            return;
        }

        if (selectedNode.id === clicked.id) return;

        const selectedConn = edges.filter(
            e => e.from === selectedNode.id || e.to === selectedNode.id
        ).length;
        if (selectedConn >= 2) {
            setSelectedNode(clicked);
            return;
        }

        if (
            edges.some(
                e =>
                    (e.from === selectedNode.id && e.to === clicked.id) ||
                    (e.from === clicked.id && e.to === selectedNode.id)
            )
        ) return;

        const remaining = nodes.filter(
            n => edges.filter(e => e.from === n.id || e.to === n.id).length < 2
        ).length;

        if (remaining > 2 && wouldFormCycle(edges, selectedNode.id, clicked.id)) return;

        setUndoStack(u => [...u, edges]);
        setRedoStack([]);
        setEdges(e => [...e, { from: selectedNode.id, to: clicked.id }]);
        setSelectedNode(clicked);
    };

    /* ---------------------------------- */
    /* Completion detection               */
    /* ---------------------------------- */
    useEffect(() => {
        const finished =
            nodes.length > 0 &&
            nodes.every(
                n => edges.filter(e => e.from === n.id || e.to === n.id).length === 2
            );

        if (finished && !isFinished) {
            setHistory(h => [...h, pathLength()]);
            setShowButton(true);
            setIsFinished(true); // 🔒 lock editing
        }
    }, [edges, nodes, isFinished]);


    /* ---------------------------------- */
    /* Controls                           */
    /* ---------------------------------- */
    const undo = () => {
        if (!undoStack.length) return;

        const prevEdges = undoStack.at(-1)!;

        setRedoStack(r => [...r, edges]);
        setEdges(prevEdges);
        setUndoStack(u => u.slice(0, -1));

        setSelectedNode(selectGraphEnd(prevEdges, nodes));
    };


    const redo = () => {
        if (!redoStack.length) return;

        const nextEdges = redoStack.at(-1)!;

        setUndoStack(u => [...u, edges]);
        setEdges(nextEdges);
        setRedoStack(r => r.slice(0, -1));

        setSelectedNode(selectGraphEnd(nextEdges, nodes));
    };


    const newIteration = () => {
        setEdges([]);
        setUndoStack([]);
        setRedoStack([]);
        setSelectedNode(null);
        setShowButton(false);
        setIsFinished(false); // 🔓 unlock editing
    };


    /* ---------------------------------- */
    /* Render                             */
    /* ---------------------------------- */
    return (
        <div
            style={{
                display: "flex",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                backgroundColor: "transparent",
            }}
        >
            {/* LEFT: GAME */}
            <div
                style={{
                    flex: "0 0 auto",
                    padding: 20,
                }}
            >
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    style={{
                        border: "1px solid black",
                        backgroundColor: "rgba(254, 254, 254, 0.1)", // make canvas background transparent
                    }}
                    onClick={handleClick}
                />
            </div>

            {/* RIGHT: ANALYTICS */}
            <div
                style={{
                    flex: "1 1 auto",
                    padding: 20,
                    display: "flex",
                    flexDirection: "column",
                    gap: 20,
                    alignItems: "center",
                }}
            >
                {/* Current Length */}
                <div
                    style={{
                        fontSize: 18,
                        fontWeight: "bold",
                    }}
                >
                    Current Path Length: {pathLength().toFixed(2)}
                </div>

                {/* Chart */}
                <LineChart width={400} height={250} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="iteration" />
                    <YAxis />
                    <Tooltip />
                    <Line
                        dataKey="length"
                        stroke="#8884d8"
                        dot={{ r: 4 }}
                        isAnimationActive={false}
                    />
                </LineChart>

                {history.length === 0 && (
                    <div style={{ fontSize: 12, opacity: 0.6 }}>
                        No completed iterations yet
                    </div>
                )}

                {/* Controls */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                        alignItems: "center",
                    }}
                >
                    <div style={{ display: "flex", gap: 10 }}>
                        <button className={"button"} onClick={undo} disabled={!undoStack.length || isFinished}>
                            Undo
                        </button>
                        <button className={"button"} onClick={redo} disabled={!redoStack.length || isFinished}>
                            Redo
                        </button>
                    </div>

                    <button className={"button"} onClick={newIteration}>New Iteration</button>

                    {showButton && (
                        <NavigatePageButton
                            to="/Analytics"
                            text="View Analytics"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
