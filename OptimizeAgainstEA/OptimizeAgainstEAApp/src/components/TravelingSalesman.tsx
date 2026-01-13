// TypeScript
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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const parentARef = useRef<HTMLCanvasElement | null>(null);
    const parentBRef = useRef<HTMLCanvasElement | null>(null);
    const workerRef = useRef<Worker | null>(null);

    const historyRef = useRef<number[]>([]);
    const besteaAnimRef = useRef<number | null>(null);

    const [eaHistory, setEaHistory] = useState<number[]>([]);
    const [besteaEdges, setBesteaEdges] = useState<Edge[]>([]);
    const [besteaDrawCount, setBesteaDrawCount] = useState<number>(0);

    // parents & usage highlighting
    const [parentAEdges, setParentAEdges] = useState<Edge[]>([]);
    const [parentBEdges, setParentBEdges] = useState<Edge[]>([]);
    const [parentAUsed, setParentAUsed] = useState<Set<string>>(new Set());
    const [parentBUsed, setParentBUsed] = useState<Set<string>>(new Set());

    // child before (used to compute diffs) - this is read and used
    const [childBeforeEdges, setChildBeforeEdges] = useState<Edge[]>([]);
    // mutation diff keys (edges that changed due to mutation) -> drawn red on main
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

    /* Helpers */
    function keyEdge(e: Edge) {
        return e.from < e.to ? `${e.from}-${e.to}` : `${e.to}-${e.from}`;
    }

    function convertPathToEdges(path: number[]): Edge[] {
        const out: Edge[] = [];
        for (let i = 0; i < path.length; i++) {
            out.push({ from: path[i], to: path[(i + 1) % path.length] });
        }
        return out;
    }

    function computePathLength(edgeArray: Edge[]) {
        return edgeArray.reduce((sum, e) => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b) return sum;
            return sum + Math.hypot(a.x - b.x, a.y - b.y);
        }, 0);
    }

    function pathLength(): number {
        return edges.reduce((sum, e) => {
            const a = nodes.find(n => n.id === e.from);
            const b = nodes.find(n => n.id === e.to);
            if (!a || !b) return sum;
            return sum + Math.hypot(a.x - b.x, a.y - b.y);
        }, 0);
    }

    function wouldFormCycle(edgesArr: Edge[], from: number, to: number): boolean {
        const adj: Record<number, number[]> = {};
        edgesArr.forEach(e => {
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

    function selectGraphEnd(edgesArr: Edge[], nodesArr: Node[]): Node | null {
        if (edgesArr.length === 0) return null;
        const degree: Record<number, number> = {};
        edgesArr.forEach(e => {
            degree[e.from] = (degree[e.from] ?? 0) + 1;
            degree[e.to] = (degree[e.to] ?? 0) + 1;
        });
        const last = edgesArr[edgesArr.length - 1];
        if ((degree[last.to] ?? 0) < 2) {
            return nodesArr.find(n => n.id === last.to) ?? null;
        }
        return nodesArr.find(n => (degree[n.id] ?? 0) < 2) ?? null;
    }

    /* Node generation */
    useEffect(() => {
        // create a hidden canvas-size independent node placement
        const generated: Node[] = [];
        const MIN_DISTANCE = NODE_RADIUS * 4;
        function isFarEnough(x: number, y: number) {
            return generated.every(n => Math.hypot(n.x - x, n.y - y) >= MIN_DISTANCE);
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
        workerRef.current = new Worker(new URL("../workers/tspWorker.ts", import.meta.url));
        workerRef.current.postMessage({ type: "INIT", payload: { nodes } });

        workerRef.current.onmessage = (e) => {
            const { type, payload } = e.data || {};
            if (type === "BEST") {
                // backward-compatible simple best (keep EA history)
                setEaHistory(h => [...h, payload.length]);
            } else if (type === "BEST_DETAILED") {
                // payload: path, length, parentA, parentB, childBefore, childAfter, mutated, mutationSwap
                const { parentA, parentB, childBefore, childAfter } = payload;

                // convert to edges
                const pAedges = convertPathToEdges(parentA);
                const pBedges = convertPathToEdges(parentB);
                const cbEdges = convertPathToEdges(childBefore);
                const caEdges = convertPathToEdges(childAfter);

                // mark parents & used edges
                setParentAEdges(pAedges);
                setParentBEdges(pBedges);
                setChildBeforeEdges(cbEdges);

                // used edges in parents = those parent edges that appear in childBefore
                const cbSet = new Set(cbEdges.map(keyEdge));
                setParentAUsed(new Set(pAedges.filter(e => cbSet.has(keyEdge(e))).map(keyEdge)));
                setParentBUsed(new Set(pBedges.filter(e => cbSet.has(keyEdge(e))).map(keyEdge)));

                // mutation diffs: edges that are in childAfter but not in childBefore
                const caSet = new Set(caEdges.map(keyEdge));
                const diff = new Set<string>([...caSet].filter(k => !cbSet.has(k)));
                setMutationDiffEdges(diff);

                // set besteaEdges to the child's edges (edit existing EA graph) and animate via besteaEdges -> besteaDrawCount effect
                setBesteaEdges(caEdges);
                setEaHistory(h => [...h, payload.length]);
            }
        };

        return () => {
            workerRef.current?.terminate();
            workerRef.current = null;
        };
    }, [nodes]);

    // clear animation interval on unmount
    useEffect(() => {
        return () => {
            if (besteaAnimRef.current) {
                clearInterval(besteaAnimRef.current);
                besteaAnimRef.current = null;
            }
        };
    }, []);

    // animate when besteaEdges changes (reused for offspring animation)
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

    /* Drawing - main canvas */
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !nodes.length) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, MAIN_W, MAIN_H);

        // --- Draw best path (background) ---
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

        // --- Draw EA best path (besteaEdges) animated ---
        if (showEAPath && besteaEdges.length && besteaDrawCount > 0) {
            ctx.save();
            const count = Math.min(besteaDrawCount, besteaEdges.length);
            for (let idx = 0; idx < count; idx++) {
                const e = besteaEdges[idx];
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) continue;
                const key = keyEdge(e);
                // if edge is part of mutation diff -> highlight red
                if (mutationDiffEdges.has(key)) {
                    ctx.strokeStyle = "rgba(220, 30, 30, 1)";
                    ctx.lineWidth = 5;
                } else {
                    ctx.strokeStyle = "rgba(160, 120, 255, 0.9)";
                    ctx.lineWidth = 5;
                }
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
            ctx.restore();
        }

        // --- Draw user edges (foreground) ---
        if (showCurrent) {
            ctx.save();
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
            ctx.restore();
        }

        // Draw nodes
        nodes.forEach(n => {
            const connections = edges.filter(e => e.from === n.id || e.to === n.id).length;
            ctx.fillStyle = selectedNode?.id === n.id ? "#ffea8a" : "#ffffff";
            ctx.beginPath();
            ctx.arc(n.x, n.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#333";
            ctx.stroke();
        });
    }, [
        nodes,
        edges,
        selectedNode,
        bestEdges,
        besteaEdges,
        besteaDrawCount,
        mutationDiffEdges,
        showEAPath,
        showPlayerBest,
        showCurrent,
    ]);

    /* Draw parent canvases separately */
    useEffect(() => {
        const drawSmall = (ref: HTMLCanvasElement | null, edgesToDraw: Edge[], usedSet: Set<string>) => {
            if (!ref || !nodes.length) return;
            const ctx = ref.getContext("2d");
            if (!ctx) return;
            ctx.clearRect(0, 0, SMALL_W, SMALL_H);

            // draw edges: used in green, others grey
            ctx.save();
            edgesToDraw.forEach(e => {
                const a = nodes.find(n => n.id === e.from);
                const b = nodes.find(n => n.id === e.to);
                if (!a || !b) return;
                const key = keyEdge(e);
                if (usedSet.has(key)) {
                    ctx.strokeStyle = "rgba(50,180,80,0.95)"; // green
                    ctx.lineWidth = 3;
                } else {
                    ctx.strokeStyle = "rgba(80,80,80,0.9)";
                    ctx.lineWidth = 2;
                }
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
                ctx.arc(n.x * SMALL_SCALE_X, n.y * SMALL_SCALE_Y, Math.max(3, NODE_RADIUS * SMALL_SCALE_X), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#333";
                ctx.stroke();
            });
        };

        drawSmall(parentARef.current, parentAEdges, parentAUsed);
        drawSmall(parentBRef.current, parentBEdges, parentBUsed);
    }, [parentAEdges, parentBEdges, parentAUsed, parentBUsed, nodes]);

    /* Click handling */
    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const clicked = nodes.find(n => Math.hypot(n.x - x, n.y - y) <= NODE_RADIUS);
        if (!clicked) return;

        const conn = edges.filter(ed => ed.from === clicked.id || ed.to === clicked.id).length;
        if (conn >= 2) return;

        if (!selectedNode) {
            setSelectedNode(clicked);
            return;
        }
        if (selectedNode.id === clicked.id) return;

        const selectedConn = edges.filter(ed => ed.from === selectedNode.id || ed.to === selectedNode.id).length;
        if (selectedConn >= 2) {
            setSelectedNode(clicked);
            return;
        }

        if (edges.some(ed =>
            (ed.from === selectedNode.id && ed.to === clicked.id) ||
            (ed.to === selectedNode.id && ed.from === clicked.id)
        )) return;

        const remaining = nodes.filter(n => edges.filter(ed => ed.from === n.id || ed.to === n.id).length < 2).length;
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
        const newEdges: Edge[] = ids.map((id, idx) => ({ from: id, to: ids[(idx + 1) % ids.length] }));
        setEdges(newEdges);
        setSelectedNode(selectGraphEnd(newEdges, nodes));
        setHistory(h => {
            const next = [...h, computePathLength(newEdges)];
            historyRef.current = next;
            return next;
        });
        setShowButton(true);
        setIsFinished(true);
        workerRef.current?.postMessage({ type: "RUN", payload: { generations: 5 } });
    };

    /* Completion detection */
    useEffect(() => {
        const finished =
            nodes.length > 0 &&
            nodes.every(n => edges.filter(e => e.from === n.id || e.to === n.id).length === 2);
        if (finished && !isFinished) {
            setHistory(h => {
                const next = [...h, pathLength()];
                historyRef.current = next;
                return next;
            });
            setShowButton(true);
            setIsFinished(true);
            workerRef.current?.postMessage({ type: "RUN", payload: { generations: 5 } });
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
                        style={{ border: "1px solid #ccc", background: "#fff" }}
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
                        <Line type="monotone" dataKey="user" stroke="#000" dot={false} />
                        <Line type="monotone" dataKey="eaBest" stroke="#a078ff" dot={false} />
                    </LineChart>

                    <div style={{ display: "flex", gap: 10 }}>
                        <button onClick={randomConnect}>Random connect</button>
                        <button onClick={undo} disabled={!undoStack.length}>Undo</button>
                        <button onClick={redo} disabled={!redoStack.length}>Redo</button>
                        <button onClick={newIteration}>New</button>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <label><input type="checkbox" checked={showEAPath} onChange={e => setShowEAPath(e.target.checked)} /> Show EA</label>
                        <label><input type="checkbox" checked={showPlayerBest} onChange={e => setShowPlayerBest(e.target.checked)} /> Show Player Best</label>
                        <label><input type="checkbox" checked={showCurrent} onChange={e => setShowCurrent(e.target.checked)} /> Show Current</label>
                    </div>

                    {showButton && (
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => workerRef.current?.postMessage({ type: "RUN", payload: { generations: 20 } })}>Run EA</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
