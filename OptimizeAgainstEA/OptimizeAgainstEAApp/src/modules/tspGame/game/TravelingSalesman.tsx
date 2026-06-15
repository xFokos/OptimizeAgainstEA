// typescript
import {useEffect, useRef, useState} from "react";
import type {Edge, Node} from "../../../types.ts";
import NavigatePageButton from "../../../components/ui/NavigatePageButton.tsx";
import {CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis,} from "recharts";

const NODE_RADIUS = 20;
const NODE_COUNT = 30;

const buttonWidth = "18%";
const buttonHeight = 65;

export default function TravelingSalesman() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const workerRef = useRef<Worker | null>(null);
    const historyRef = useRef<number[]>([]);
    const besteaAnimRef = useRef<number | null>(null);

    const [eaHistory, setEaHistory] = useState<number[]>([]);
    const [besteaEdges, setBesteaEdges] = useState<Edge[]>([]);
    const [besteaDrawCount, setBesteaDrawCount] = useState<number>(0);

    // Visibility toggles
    const [showEAPath, setShowEAPath] = useState<boolean>(true);
    const [showPlayerBest, setShowPlayerBest] = useState<boolean>(true);
    const [showCurrent, setShowCurrent] = useState<boolean>(true);

    // EA animation control
    const [showEASolutionButton, setShowEASolutionButton] = useState<boolean>(false);
    const [isEAAnimating, setIsEAAnimating] = useState<boolean>(false);
    const prevShowPlayerBestRef = useRef<boolean | null>(null);
    const prevShowCurrentRef = useRef<boolean | null>(null);

    const buttonStyle: React.CSSProperties = {
        width: buttonWidth,
        height: buttonHeight,
        minWidth: buttonWidth,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
    };

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
    /* EA Worker */
    /* ---------------------------------- */
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

                // Aktualisiere eaHistory sicher gegen stale closures via historyRef
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
            }
        };


        return () => {
            workerRef.current?.terminate();
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

    // keep historyRef in sync with history
    useEffect(() => { historyRef.current = history; }, [history]);

    /* ---------------------------------- */
    /* EA animation (only when triggered) */
    /* ---------------------------------- */
    useEffect(() => {
        if (!isEAAnimating) return;

        // stop any existing animation
        if (besteaAnimRef.current) {
            clearInterval(besteaAnimRef.current);
            besteaAnimRef.current = null;
        }

        if (!besteaEdges.length) {
            // nothing to animate, end animation immediately
            setIsEAAnimating(false);
            setShowEASolutionButton(false);
            setShowPlayerBest(prevShowPlayerBestRef.current ?? true);
            setShowCurrent(prevShowCurrentRef.current ?? true);
            return;
        }

        setBesteaDrawCount(0);
        let i = 0;
        const intervalMs = 60; // Zeit pro Kante
        besteaAnimRef.current = window.setInterval(() => {
            i++;
            setBesteaDrawCount(i);
            if (i >= besteaEdges.length) {
                if (besteaAnimRef.current) {
                    clearInterval(besteaAnimRef.current);
                    besteaAnimRef.current = null;
                }
                setIsEAAnimating(false);
                // restore toggles
                setShowPlayerBest(prevShowPlayerBestRef.current ?? true);
                setShowCurrent(prevShowCurrentRef.current ?? true);
                // switch to New Iteration
                setShowEASolutionButton(false);
            }
        }, intervalMs);

        return () => {
            if (besteaAnimRef.current) {
                clearInterval(besteaAnimRef.current);
                besteaAnimRef.current = null;
            }
        };
    }, [besteaEdges, isEAAnimating]);

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

        // --- Draw EA best path (animated) ---
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

        // --- Draw user edges (foreground) ---
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
    }, [nodes, edges, selectedNode, bestEdges, besteaEdges, besteaDrawCount, showEAPath, showPlayerBest, showCurrent]);

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
    /* Random connect (new)               */
    /* ---------------------------------- */
    const randomConnect = () => {
        if (!nodes.length || isFinished) return;

        // save current state for undo
        setUndoStack(u => [...u, edges]);
        setRedoStack([]);

        // create shuffled tour
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

        // mark finished and register history immediately
        setHistory(h => {
            const next = [...h, computePathLength(newEdges)];
            historyRef.current = next;
            return next;
        });
        setShowButton(true);
        setIsFinished(true);

        // show EA solution button first
        setShowEASolutionButton(true);

        // trigger EA run (same as normal completion)
        workerRef.current?.postMessage({
            type: "RUN",
            payload: { generations: 5 },
        });
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
            setHistory(h => {
                const next = [...h, pathLength()];
                historyRef.current = next;
                return next;
            });
            setShowButton(true);
            setIsFinished(true);

            // show EA solution button first
            setShowEASolutionButton(true);

            // evolve EA
            workerRef.current?.postMessage({
                type: "RUN",
                payload: { generations: 5 },
            });
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
        setIsFinished(false); // unlock editing
        setShowEASolutionButton(false);
        setBesteaDrawCount(0);
    };

    const playEASolution = () => {
        // don't start if no data
        if (!besteaEdges.length || isEAAnimating) return;

        // remember previous visibility to restore after animation
        prevShowPlayerBestRef.current = showPlayerBest;
        prevShowCurrentRef.current = showCurrent;

        setShowPlayerBest(false);
        setShowCurrent(false);

        // start animation (effect will run)
        setIsEAAnimating(true);
    };

    /* ---------------------------------- */
    /* Render                             */
    /* ---------------------------------- */
    return (
        <div
            style={{
                display: "flex"
            }}
        >
            <div className={"sidebar-left"}>
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
            </div>

            <div className={"game-container"}>

                <div className={"game-window"}>
                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        style={{
                            border: "1px solid black",
                            backgroundColor: "rgba(254, 254, 254, 0.1)",
                        }}
                        onClick={handleClick}
                    />
                </div>
                <div className={"game-bar-down"}>
                    <div style={{ display: "flex", gap: 10 }}>
                        <button
                            className="button"
                            onClick={undo}
                            disabled={!undoStack.length || isFinished}
                            style={buttonStyle}
                        >
                            Undo
                        </button>
                        <button
                            className="button"
                            onClick={redo}
                            disabled={!redoStack.length || isFinished}
                            style={buttonStyle}
                        >
                            Redo
                        </button>
                        {/* Replace New Iteration with EA Solution first when finished */}
                        {isFinished ? (
                            showEASolutionButton ? (
                                <button
                                    className="button"
                                    onClick={playEASolution}
                                    disabled={isEAAnimating || !besteaEdges.length}
                                    style={buttonStyle}
                                >
                                    EA Lösung
                                </button>
                            ) : (
                                <button className="button" onClick={newIteration} style={buttonStyle}>
                                    New Iteration
                                </button>
                            )
                        ) : (
                            <button className="button" onClick={newIteration} style={buttonStyle}>
                                Neue Iteration
                            </button>
                        )}

                        <button
                            className="button"
                            onClick={randomConnect}
                            disabled={isFinished || nodes.length === 0}
                            style={buttonStyle}
                        >
                            Random Connect
                        </button>
                        <div
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: buttonWidth,
                                height: buttonHeight,
                                opacity: showButton ? 1 : 0.4,
                                pointerEvents: showButton ? "auto" : "none",
                                transition: "opacity 0.2s ease",
                            }}
                        >
                            <NavigatePageButton
                                to="/Analytics"
                                text="View Analytics"
                            />
                        </div>

                    </div>
                </div>

            </div>

            <div className={"sidebar-right"}>
                {/* RIGHT: ANALYTICS */}
                <div style={{ fontSize: 18, fontWeight: "bold" }}>
                    Current Path Length: {pathLength().toFixed(2)}
                </div>

                <LineChart width={"90%"} height={250} data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="iteration" />
                    <YAxis />
                    <Tooltip />

                    {/* User */}
                    <Line
                        dataKey="user"
                        stroke="#000000"
                        name="User"
                        dot={{ r: 4 }}
                        isAnimationActive={false}
                    />

                    {/* EA current */}
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
            </div>
        </div>

    );
}
