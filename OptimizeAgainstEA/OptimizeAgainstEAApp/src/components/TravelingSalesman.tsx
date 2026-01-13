// File: OptimizeAgainstEAApp/src/components/TravelingSalesman.tsx
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
const NODE_COUNT = 30;
const MAIN_W = 800;
const MAIN_H = 600;
const SMALL_W = 220;
const SMALL_H = 165;
const SMALL_SCALE_X = SMALL_W / MAIN_W;
const SMALL_SCALE_Y = SMALL_H / MAIN_H;

export default function TravelingSalesman() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const parentARef = useRef<HTMLCanvasElement>(null);
    const parentBRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);

    const historyRef = useRef<number[]>([]);
    const besteaAnimRef = useRef<number | null>(null);
    const offspringAnimRef = useRef<number | null>(null);

    const [eaHistory, setEaHistory] = useState<number[]>([]);
    const [besteaEdges, setBesteaEdges] = useState<Edge[]>([]);
    const [besteaDrawCount, setBesteaDrawCount] = useState<number>(0);

    // visualization of parents / offspring
    const [parentAEdges, setParentAEdges] = useState<Edge[]>([]);
    const [parentBEdges, setParentBEdges] = useState<Edge[]>([]);
    const [childBeforeEdges, setChildBeforeEdges] = useState<Edge[]>([]);
    const [childAfterEdges, setChildAfterEdges] = useState<Edge[]>([]);
    const [offspringDrawCount, setOffspringDrawCount] = useState<number>(0);
    const [mutationDiffEdges, setMutationDiffEdges] = useState<Set<string>>(new Set());

    // Visibility toggles
    const [showEAPath, setShowEAPath] = useState<boolean>(true);
    const [showPlayerBest, setShowPlayerBest] = useState<boolean>(true);
    const [showCurrent, setShowCurrent] = useState<boolean>(true);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [bestEdges, setBestEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const [undoStack, setUndoStack] = useState<Edge[][]>([]);
    const [redoStack, setRedoStack] = useState<Edge[][]>([]);
    const [isFinished, setIsFinished] = useState(false);

    const [history, setHistory] = useState<number[]>([]);
    const [showButton, setShowButton] = useState(false);

    const chartData = history.map((userLength, i) => {
        const ea = eaHistory[i] ?? null;
        let eaBest: number | null = null;
        if (eaHistory.length > 0) {
            const upto = Math.min(i + 1, eaHistory.length);
            eaBest = Math.min(...eaHistory.slice(0, upto));
        }
        return {
            iteration: i + 1,
            user: userLength,
            ea,
            eaBest,
        };
    });

    /* Node generation */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const generated: Node[] = [];
        const MIN_DISTANCE = NODE_RADIUS * 4;

        function isFarEnough(x: number, y: number) {
            return generated.every(
                n => Math.hypot(n.x - x, n.y - y) >= MIN_DISTANCE
            );
        }

        let attempts = 0;
        while (generated.length < NODE_COUNT && attempts < NODE_COUNT * 50) {
            const x = Math.random() * (MAIN_W - NODE_RADIUS * 2) + NODE_RADIUS;
            const y = Math.random() * (MAIN_H - NODE_RADIUS * 2) + NODE_RADIUS;

            if (isFarEnough(x, y)) {
                generated.push({ id: generated.length, x, y });
            } else {
                attempts++;
            }
        }

        setNodes(generated);
    }, []);

    /* EA Worker */
    useEffect(() => {
        if (!nodes.length) return;

        workerRef.current = new Worker(
            new URL("../workers/tspWorker.ts", import.meta.url)
        );

        workerRef.current.postMessage({
            type: "INIT",
            payload: { nodes },
        });

        workerRef.current.onmessage = (e) => {
            if (e.data.type === "BEST") {
                const eaEdges = convertPathToEdges(e.data.payload.path);
                setBesteaEdges(eaEdges);
                const eaLength = computePathLength(eaEdges);

                setEaHistory(prev => {
                    const completedIterations = historyRef.current.length;
                    if (prev.length < completedIterations) {
                        return [...prev, eaLength];
                    }
                    if (prev.length === 0) return [eaLength];
                    const copy = [...prev];
                    copy[copy.length - 1] = eaLength;
                    return copy;
                });
            } else if (e.data.type === "BEST_DETAILED") {
                const { parentA, parentB, childBefore, childAfter, mutated } = e.data.payload;

                setParentAEdges(convertPathToEdges(parentA));
                setParentBEdges(convertPathToEdges(parentB));
                setChildBeforeEdges(convertPathToEdges(childBefore));
                setChildAfterEdges(convertPathToEdges(childAfter));

                // prepare mutation diff set (edges that changed due to mutation)
                const beforeSet = new Set(convertPathToEdges(childBefore).map(keyEdge));
                const afterArr = convertPathToEdges(childAfter);
                const diff = new Set<string>();
                if (mutated) {
                    afterArr.forEach(e => {
                        const k = keyEdge(e);
                        if (!beforeSet.has(k)) diff.add(k);
                    });
                }
                setMutationDiffEdges(diff);

                // start offspring animation on main canvas
                if (offspringAnimRef.current) {
                    clearInterval(offspringAnimRef.current);
                    offspringAnimRef.current = null;
                }
                setOffspringDrawCount(0);
                let i = 0;
                const id = window.setInterval(() => {
                    i++;
                    setOffspringDrawCount(i);
                    if (i >= afterArr.length) {
                        if (offspringAnimRef.current) {
                            clearInterval(offspringAnimRef.current);
                            offspringAnimRef.current = null;
                        }
                    }
                }, 50);
                offspringAnimRef.current = id;

                // also treat EA best path as before (to overlay if desired)
                const eaEdges = convertPathToEdges(e.data.payload.path);
                setBesteaEdges(eaEdges);
            }
        };

        return () => {
            workerRef.current?.terminate();
        };
    }, [nodes]);

    useEffect(() => {
        return () => {
            if (besteaAnimRef.current) {
                clearInterval(besteaAnimRef.current);
                besteaAnimRef.current = null;
            }
            if (offspringAnimRef.current) {
                clearInterval(offspringAnimRef.current);
                offspringAnimRef.current = null;
            }
        };
    }, []);

    useEffect(() => { historyRef.current = history; }, [history]);

    /* Animate EA edges when besteaEdges changes (kept) */
    useEffect(() => {
        if (besteaAnimRef.current) {
            clearInterval(besteaAnimRef.current);
            besteaAnimRef.current = null;
        }

        if (!besteaEdges.length) {
            setBesteaDrawCount(0);
            return;
        }

        setBesteaDrawCount(0);
        let i = 0;
        const intervalMs = 60;
        const id = window.setInterval(() => {
            i++;
            setBesteaDrawCount(i);
            if (i >= besteaEdges.length) {
                if (besteaAnimRef.current) {
                    clearInterval(besteaAnimRef.current);
                    besteaAnimRef.current = null;
                }
            }
        }, intervalMs);
        besteaAnimRef.current = id;
        return () => {
            if (besteaAnimRef.current) {
                clearInterval(besteaAnimRef.current);
                besteaAnimRef.current = null;
            }
        };
    }, [besteaEdges]);

    /* Update bestEdges when a new iteration finishes */
    useEffect(() => {
        if (!isFinished) return;

        if (!bestEdges.length || pathLength() < computePathLength(bestEdges)) {
            setBestEdges(edges);
        }
    }, [isFinished]);

    /* Drawing - main canvas and small parent canvases */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, MAIN_W, MAIN_H);

        // Draw best user path (background)
        if (bestEdges.length && showPlayerBest) {
            ctx.save();
            ctx.strokeStyle = "rgba(0, 205, 242, 1)";
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
            ctx.restore();
        }

        // Draw EA best path (animated, thicker)
        if (showEAPath && besteaEdges.length && besteaDrawCount > 0) {
            ctx.save();
            ctx.strokeStyle = "rgba(160, 120, 255, 0.6)";
            ctx.lineWidth = 6;
            ctx.lineCap = "round";
            const count = Math.min(besteaDrawCount, besteaEdges.length);
            for (let idx = 0; idx < count; idx++) {
                const e = besteaEdges[idx];
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) continue;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Draw current user edges
        if (showCurrent) {
            ctx.strokeStyle = "black";
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            edges.forEach(e => {
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) return;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            });
        }

        // Draw offspring (childAfter) progressive animation on top
        if (childAfterEdges.length && offspringDrawCount > 0) {
            ctx.save();
            ctx.lineWidth = 4;
            ctx.lineCap = "round";
            const count = Math.min(offspringDrawCount, childAfterEdges.length);
            for (let idx = 0; idx < count; idx++) {
                const e = childAfterEdges[idx];
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) continue;
                const key = keyEdge(e);
                // if this edge is part of mutation diff, draw in red after full animation
                if (mutationDiffEdges.has(key) && idx >= count - 1) {
                    ctx.strokeStyle = "red";
                } else {
                    ctx.strokeStyle = "rgba(200, 120, 255, 0.9)";
                }
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.restore();
        }

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
    }, [nodes, edges, selectedNode, bestEdges, besteaEdges, besteaDrawCount, childAfterEdges, offspringDrawCount, mutationDiffEdges, showEAPath, showPlayerBest, showCurrent]);

    /* Draw parent canvases separately */
    useEffect(() => {
        const drawSmall = (ref: HTMLCanvasElement | null, edgesToDraw: Edge[]) => {
            if (!ref || !nodes.length) return;
            const ctx = ref.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, SMALL_W, SMALL_H);

            // draw edges
            ctx.save();
            ctx.strokeStyle = "rgba(80,80,80,0.9)";
            ctx.lineWidth = 2;
            edgesToDraw.forEach(e => {
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) return;
                ctx.beginPath();
                ctx.moveTo(a.x * SMALL_SCALE_X, a.y * SMALL_SCALE_Y);
                ctx.lineTo(b.x * SMALL_SCALE_X, b.y * SMALL_SCALE_Y);
                ctx.stroke();
            });
            ctx.restore();

            // draw nodes
            nodes.forEach(n => {
                ctx.fillStyle = "skyblue";
                ctx.beginPath();
                ctx.arc(n.x * SMALL_SCALE_X, n.y * SMALL_SCALE_Y, NODE_RADIUS * SMALL_SCALE_X, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        };

        drawSmall(parentARef.current, parentAEdges);
        drawSmall(parentBRef.current, parentBEdges);
    }, [parentAEdges, parentBEdges, nodes]);

    /* Helpers */
    function keyEdge(e: Edge) {
        // undirected key
        return e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    }

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
        const degree: Record<number, number> = {};
        edges.forEach(e => {
            degree[e.from] = (degree[e.from] ?? 0) + 1;
            degree[e.to] = (degree[e.to] ?? 0) + 1;
        });
        const last = edges[edges.length - 1];
        if ((degree[last.to] ?? 0) < 2) {
            return nodes.find(n => n.id === last.to) ?? null;
        }
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

    function convertPathToEdges(path: number[]): Edge[] {
        const edges: Edge[] = [];
        for (let i = 0; i < path.length; i++) {
            edges.push({
                from: path[i],
                to: path[(i + 1) % path.length],
            });
        }
        return edges;
    }

    /* Click handling */
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

    /* Random connect */
    const randomConnect = () => {
        if (!nodes.length || isFinished) return;

        setUndoStack(u => [...u, edges]);
        setRedoStack([]);

        const ids = nodes.map(n => n.id);
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [ids[i], ids[j]] = [ids[j], ids[i]];
        }

        const newEdges: Edge[] = ids.map((id, idx) => ({
            from: id,
            to: ids[(idx + 1) % ids.length],
        }));

        setEdges(newEdges);
        setSelectedNode(selectGraphEnd(newEdges, nodes));

        setHistory(h => {
            const next = [...h, computePathLength(newEdges)];
            historyRef.current = next;
            return next;
        });
        setShowButton(true);
        setIsFinished(true);

        workerRef.current?.postMessage({
            type: "RUN",
            payload: { generations: 5 },
        });
    };

    /* Completion detection */
    useEffect(() => {
        const finished =
            nodes.length > 0 &&
            nodes.every(
                n => edges.filter(e => e.from === n.id || e.to === n.id).length === 2
            );

        if (finished && !isFinished) {
            setHistory(h => {
                const next = [...h, pathLength()];
                historyRef.current = next;
                return next;
            });
            setShowButton(true);
            setIsFinished(true);

            workerRef.current?.postMessage({
                type: "RUN",
                payload: { generations: 5 },
            });
        }

    }, [edges, nodes, isFinished]);

    /* Controls */
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
        setIsFinished(false);
    };

    /* Render */
    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
            }}
        >
            <div
                style={{
                    display: "flex",
                    width: "1200px",
                    boxSizing: "border-box",
                }}
            >
                {/* LEFT: small parent canvases + MAIN canvas */}
                <div
                    style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        padding: 20,
                        gap: 12,
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 12 }}>Parent A</div>
                        <canvas ref={parentARef} width={SMALL_W} height={SMALL_H} style={{ border: "1px solid #333", background: "#fafafa" }} />
                        <div style={{ fontSize: 12 }}>Parent B</div>
                        <canvas ref={parentBRef} width={SMALL_W} height={SMALL_H} style={{ border: "1px solid #333", background: "#fafafa" }} />
                    </div>

                    <canvas
                        ref={canvasRef}
                        width={MAIN_W}
                        height={MAIN_H}
                        style={{
                            border: "1px solid black",
                            backgroundColor: "rgba(254, 254, 254, 0.1)",
                        }}
                        onClick={handleClick}
                    />
                </div>

                {/* RIGHT: Analytics */}
                <div
                    style={{
                        width: 400,
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        gap: 20,
                        alignItems: "center",
                    }}
                >
                    <div style={{ fontSize: 18, fontWeight: "bold" }}>
                        Current Path Length: {pathLength().toFixed(2)}
                    </div>

                    <LineChart width={400} height={250} data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="iteration" />
                        <YAxis />
                        <Tooltip />

                        <Line
                            dataKey="user"
                            stroke="#000000"
                            name="User"
                            dot={{ r: 4 }}
                            isAnimationActive={false}
                        />

                        <Line
                            dataKey="ea"
                            stroke="#a078ff"
                            name="Evolutionary Algorithm"
                            strokeDasharray="5 5"
                            dot={false}
                            isAnimationActive={false}
                        />
                    </LineChart>

                    {history.length === 0 && (
                        <div style={{ fontSize: 12, opacity: 0.6 }}>
                            No completed iterations yet
                        </div>
                    )}

                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 12,
                            alignItems: "center",
                        }}
                    >
                        <div style={{ display: "flex", gap: 10 }}>
                            <button
                                className="button"
                                onClick={undo}
                                disabled={!undoStack.length || isFinished}
                            >
                                Undo
                            </button>
                            <button
                                className="button"
                                onClick={redo}
                                disabled={!redoStack.length || isFinished}
                            >
                                Redo
                            </button>
                        </div>

                        <div style={{ display: "flex", gap: 10 }}>
                            <button className="button" onClick={newIteration}>
                                New Iteration
                            </button>
                            <button
                                className="button"
                                onClick={randomConnect}
                                disabled={isFinished || nodes.length === 0}
                            >
                                Random Connect
                            </button>
                        </div>

                        {/* Visibility Toggles */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                            <label style={{ fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={showEAPath}
                                    onChange={() => setShowEAPath(s => !s)}
                                    style={{ marginRight: 8 }}
                                />
                                EA-Lösung anzeigen
                            </label>
                            <label style={{ fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={showPlayerBest}
                                    onChange={() => setShowPlayerBest(s => !s)}
                                    style={{ marginRight: 8 }}
                                />
                                Bester Spielpfad anzeigen
                            </label>
                            <label style={{ fontSize: 13 }}>
                                <input
                                    type="checkbox"
                                    checked={showCurrent}
                                    onChange={() => setShowCurrent(s => !s)}
                                    style={{ marginRight: 8 }}
                                />
                                Aktuellen Pfad anzeigen
                            </label>
                        </div>

                        {showButton && (
                            <NavigatePageButton
                                to="/Analytics"
                                text="View Analytics"
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
