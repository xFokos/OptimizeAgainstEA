import { useState, useRef, useEffect, useCallback } from "react";
import type { CSSProperties, MouseEvent } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────

const W = 600;
const H = 600;
const RESOLUTION = 120;
const HIT_THRESHOLD = 0.04;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Minimum {
    x: number;
    y: number;
    depth: number;
    spread: number;
}

interface Guess {
    x: number;
    y: number;
    isHit: boolean;
    dist: string;
    fieldVal: string;
    nearGlobalMin: boolean;
}

interface LandscapeData {
    minima: Minimum[];
    globalIdx: number;
    v: number;
}

type Mode = "menu" | "creator" | "solver" | "import";
type HoveredPoint = { x: number; y: number };

// ─── Pure functions ───────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function gaussian(
    x: number,
    y: number,
    cx: number,
    cy: number,
    depth: number,
    spread: number
): number {
    const dx = x - cx;
    const dy = y - cy;
    return -depth * Math.exp(-(dx * dx + dy * dy) / (2 * spread * spread));
}

function buildField(minima: Minimum[]): Float32Array {
    const field = new Float32Array(RESOLUTION * RESOLUTION);
    for (let row = 0; row < RESOLUTION; row++) {
        for (let col = 0; col < RESOLUTION; col++) {
            const nx = col / (RESOLUTION - 1);
            const ny = row / (RESOLUTION - 1);
            let val = 0;
            for (const m of minima) {
                val += gaussian(nx, ny, m.x, m.y, m.depth, m.spread);
            }
            field[row * RESOLUTION + col] = val;
        }
    }
    return field;
}

function fieldMinMax(field: Float32Array): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const v of field) {
        if (v < min) min = v;
        if (v > max) max = v;
    }
    return { min, max };
}

function encode(minima: Minimum[], globalIdx: number): string {
    const data: LandscapeData = { minima, globalIdx, v: 1 };
    return btoa(JSON.stringify(data));
}

function decode(code: string): LandscapeData | null {
    try {
        return JSON.parse(atob(code)) as LandscapeData;
    } catch {
        return null;
    }
}

function evaluateGuess(
    nx: number,
    ny: number,
    minima: Minimum[],
    globalIdx: number
): Guess {
    const gm = minima[globalIdx];
    const dist = Math.sqrt((nx - gm.x) ** 2 + (ny - gm.y) ** 2);
    const fieldVal = minima.reduce(
        (acc, m) => acc + gaussian(nx, ny, m.x, m.y, m.depth, m.spread),
        0
    );
    const { min: fMin } = fieldMinMax(buildField(minima));
    const relativeDepth = Math.abs(fieldVal - fMin);
    return {
        x: nx,
        y: ny,
        isHit: dist < HIT_THRESHOLD,
        dist: dist.toFixed(3),
        fieldVal: fieldVal.toFixed(4),
        nearGlobalMin: relativeDepth < 0.05,
    };
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function renderField(
    canvas: HTMLCanvasElement,
    field: Float32Array,
    minima: Minimum[],
    globalIdx: number | null,
    mode: Mode,
    guesses: Guess[],
    hoveredCell: HoveredPoint | null
): void {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { min, max } = fieldMinMax(field);
    const range = max - min || 1;

    const imgData = ctx.createImageData(RESOLUTION, RESOLUTION);
    for (let i = 0; i < RESOLUTION * RESOLUTION; i++) {
        const t = (field[i] - min) / range;
        imgData.data[i * 4]     = Math.round(lerp(0x0a, 0x00, t));
        imgData.data[i * 4 + 1] = Math.round(lerp(0x14, 0x8b, t));
        imgData.data[i * 4 + 2] = Math.round(lerp(0x2a, 0xff, t));
        imgData.data[i * 4 + 3] = 255;
    }

    const offscreen = document.createElement("canvas");
    offscreen.width = RESOLUTION;
    offscreen.height = RESOLUTION;
    offscreen.getContext("2d")?.putImageData(imgData, 0, 0);

    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(offscreen, 0, 0, W, H);

    if (mode === "creator") {
        minima.forEach((m, i) => {
            const px = m.x * W;
            const py = m.y * H;
            const isGlobal = i === globalIdx;
            ctx.beginPath();
            ctx.arc(px, py, isGlobal ? 10 : 7, 0, Math.PI * 2);
            ctx.fillStyle = isGlobal ? "#ff4444" : "#ffaa00";
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (isGlobal) {
                ctx.font = "bold 11px monospace";
                ctx.fillStyle = "#fff";
                ctx.fillText("★", px - 5, py + 4);
            }
        });
    }

    if (mode === "solver") {
        guesses.forEach((g, i) => {
            const isLast = i === guesses.length - 1;
            const px = g.x * W;
            const py = g.y * H;
            ctx.beginPath();
            ctx.arc(px, py, isLast ? 9 : 6, 0, Math.PI * 2);
            ctx.fillStyle = g.isHit
                ? "#44ff88"
                : isLast
                    ? "#ff8844"
                    : "rgba(255,255,255,0.4)";
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            if (g.isHit) {
                ctx.font = "bold 12px monospace";
                ctx.fillStyle = "#fff";
                ctx.fillText("✓", px - 5, py + 4);
            }
        });
    }

    if (hoveredCell) {
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(hoveredCell.x * W, 0);
        ctx.lineTo(hoveredCell.x * W, H);
        ctx.moveTo(0, hoveredCell.y * H);
        ctx.lineTo(W, hoveredCell.y * H);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// ─── Shared style helpers ─────────────────────────────────────────────────────

const mono: CSSProperties = { fontFamily: "'Courier New', Courier, monospace" };

const sectionLabel: CSSProperties = {
    fontSize: "10px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "#4a9eff",
    marginBottom: "10px",
    ...mono,
};

const hint: CSSProperties = {
    fontSize: "11px",
    color: "#336699",
    lineHeight: "1.6",
    ...mono,
};

const fieldLabel: CSSProperties = {
    fontSize: "10px",
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "#5a7a9f",
    marginBottom: "3px",
    ...mono,
};

const divider: CSSProperties = {
    borderTop: "1px solid #1e3a5f",
    margin: "14px 0",
};

const inputStyle: CSSProperties = {
    width: "100%",
    background: "#07090f",
    border: "1px solid #1e3a5f",
    borderRadius: "2px",
    color: "#c8d8f0",
    padding: "7px 10px",
    fontSize: "11px",
    boxSizing: "border-box",
    ...mono,
};

function primaryBtn(disabled = false): CSSProperties {
    return {
        width: "100%",
        padding: "8px 12px",
        fontSize: "11px",
        letterSpacing: "2px",
        textTransform: "uppercase",
        border: "1px solid #4a9eff",
        borderRadius: "2px",
        background: "rgba(74,158,255,0.10)",
        color: "#4a9eff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        ...mono,
    };
}

function secondaryBtn(): CSSProperties {
    return {
        width: "100%",
        padding: "8px 12px",
        fontSize: "11px",
        letterSpacing: "2px",
        textTransform: "uppercase",
        border: "1px solid #1e3a5f",
        borderRadius: "2px",
        background: "transparent",
        color: "#5a7a9f",
        cursor: "pointer",
        ...mono,
    };
}

function dangerBtn(): CSSProperties {
    return {
        padding: "2px 7px",
        fontSize: "10px",
        border: "1px solid #3a1a1a",
        borderRadius: "2px",
        background: "transparent",
        color: "#ff4444",
        cursor: "pointer",
        marginLeft: "6px",
        ...mono,
    };
}

function starBtn(): CSSProperties {
    return {
        padding: "2px 7px",
        fontSize: "10px",
        border: "1px solid #2a3a1a",
        borderRadius: "2px",
        background: "transparent",
        color: "#ffaa00",
        cursor: "pointer",
        marginLeft: "4px",
        ...mono,
    };
}

// ─── ProximityPanel (sidebar-right content) ───────────────────────────────────

interface ProximityPanelProps {
    lastGuess: Guess | null;
    guesses: Guess[];
    gameWon: boolean;
}

function ProximityPanel({ lastGuess, guesses, gameWon }: ProximityPanelProps) {
    const dist = lastGuess ? parseFloat(lastGuess.dist) : null;

    const proximityColor =
        dist === null
            ? "#336699"
            : dist < 0.04
                ? "#44ff88"
                : dist < 0.15
                    ? "#ffaa00"
                    : "#ff6644";

    const proximityLabel =
        dist === null
            ? "—"
            : dist < 0.04
                ? "Direct hit!"
                : dist < 0.1
                    ? "Very close"
                    : dist < 0.25
                        ? "Warm"
                        : "Cold";

    const meterWidth =
        dist === null ? 0 : Math.max(0, Math.min(100, (1 - dist / 0.8) * 100));

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", ...mono }}>
            {gameWon && (
                <div
                    style={{
                        border: "1px solid #44ff88",
                        borderRadius: "3px",
                        padding: "12px",
                        background: "rgba(68,255,136,0.05)",
                    }}
                >
                    <div
                        style={{
                            fontSize: "13px",
                            color: "#44ff88",
                            letterSpacing: "2px",
                            marginBottom: "4px",
                        }}
                    >
                        ✓ FOUND IT!
                    </div>
                    <div style={{ fontSize: "11px", color: "#88ccaa" }}>
                        {guesses.length} guess{guesses.length !== 1 ? "es" : ""}
                    </div>
                </div>
            )}

            <div>
                <div style={sectionLabel}>Last Guess</div>
                {!lastGuess ? (
                    <div style={hint}>No guesses yet.</div>
                ) : (
                    <>
                        <div
                            style={{ fontSize: "11px", color: "#4a6a8f", lineHeight: "2.1" }}
                        >
                            <div>
                                Position:{" "}
                                <span style={{ color: "#c8d8f0" }}>
                  ({lastGuess.x.toFixed(3)}, {lastGuess.y.toFixed(3)})
                </span>
                            </div>
                            <div>
                                Field value:{" "}
                                <span style={{ color: "#c8d8f0" }}>{lastGuess.fieldVal}</span>
                            </div>
                            <div>
                                Distance:{" "}
                                <span style={{ color: proximityColor }}>{lastGuess.dist}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: "10px" }}>
                            <div style={fieldLabel}>Proximity</div>
                            <div
                                style={{
                                    height: "6px",
                                    background: "#1e3a5f",
                                    borderRadius: "2px",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${meterWidth}%`,
                                        background: proximityColor,
                                        transition: "width 0.3s, background 0.3s",
                                    }}
                                />
                            </div>
                            <div
                                style={{
                                    marginTop: "5px",
                                    fontSize: "10px",
                                    color: proximityColor,
                                    letterSpacing: "1px",
                                }}
                            >
                                {proximityLabel}
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div style={divider} />

            <div>
                <div style={sectionLabel}>Attempt Log</div>
                <div style={{ maxHeight: "240px", overflowY: "auto" }}>
                    {guesses.length === 0 && <div style={hint}>—</div>}
                    {[...guesses].reverse().map((g, i) => (
                        <div
                            key={i}
                            style={{
                                fontSize: "10px",
                                color: g.isHit ? "#44ff88" : "#4a6a8f",
                                borderBottom: "1px solid #0d1117",
                                padding: "4px 0",
                            }}
                        >
                            {g.isHit ? "★ " : `#${guesses.length - i} `}
                            ({g.x.toFixed(2)}, {g.y.toFixed(2)}) d={g.dist}
                        </div>
                    ))}
                </div>
                <div
                    style={{ marginTop: "8px", fontSize: "11px", color: "#336699" }}
                >
                    Total: {guesses.length}
                </div>
            </div>
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EABattleship() {
    const [mode, setMode] = useState<Mode>("menu");
    const [minima, setMinima] = useState<Minimum[]>([]);
    const [globalIdx, setGlobalIdx] = useState<number | null>(null);
    const [field, setField] = useState<Float32Array | null>(null);
    const [spread, setSpread] = useState(0.12);
    const [depth, setDepth] = useState(1.0);
    const [code, setCode] = useState("");
    const [importCode, setImportCode] = useState("");
    const [importError, setImportError] = useState("");
    const [guesses, setGuesses] = useState<Guess[]>([]);
    const [gameWon, setGameWon] = useState(false);
    const [hovered, setHovered] = useState<HoveredPoint | null>(null);
    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const recomputeField = useCallback((mins: Minimum[]) => {
        setField(mins.length === 0 ? null : buildField(mins));
    }, []);

    useEffect(() => {
        if (minima.length > 0) recomputeField(minima);
    }, [minima, recomputeField]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        if (field) {
            renderField(canvas, field, minima, globalIdx, mode, guesses, hovered);
        } else {
            canvas.getContext("2d")?.clearRect(0, 0, W, H);
        }
    }, [field, minima, globalIdx, mode, guesses, hovered]);

    const getCanvasCoords = (
        e: MouseEvent<HTMLDivElement>
    ): HoveredPoint | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) * (W / rect.width)) / W,
            y: ((e.clientY - rect.top) * (H / rect.height)) / H,
        };
    };

    const handleCanvasClick = (e: MouseEvent<HTMLDivElement>) => {
        const coords = getCanvasCoords(e);
        if (!coords) return;
        const { x: nx, y: ny } = coords;

        if (mode === "creator") {
            setMinima((prev) => [...prev, { x: nx, y: ny, depth, spread }]);
        }
        if (mode === "solver" && !gameWon && globalIdx !== null) {
            const result = evaluateGuess(nx, ny, minima, globalIdx);
            setGuesses((prev) => [...prev, result]);
            if (result.isHit) setGameWon(true);
        }
    };

    const handleRemoveMinima = (i: number) => {
        const next = minima.filter((_, idx) => idx !== i);
        setMinima(next);
        if (globalIdx === i) setGlobalIdx(null);
        else if (globalIdx !== null && globalIdx > i) setGlobalIdx(globalIdx - 1);
        recomputeField(next);
    };

    const handleGenerateCode = () => {
        if (globalIdx === null || minima.length === 0) return;
        setCode(encode(minima, globalIdx));
        setShowCode(true);
    };

    const handleImport = () => {
        const data = decode(importCode.trim());
        if (!data?.minima || data.globalIdx === undefined) {
            setImportError("Invalid code. Please check and try again.");
            return;
        }
        setMinima(data.minima);
        setGlobalIdx(data.globalIdx);
        recomputeField(data.minima);
        setGuesses([]);
        setGameWon(false);
        setImportError("");
        setMode("solver");
    };

    const copyCode = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        });
    };

    const resetAll = () => {
        setMode("menu");
        setMinima([]);
        setGlobalIdx(null);
        setField(null);
        setGuesses([]);
        setGameWon(false);
        setCode("");
        setShowCode(false);
        setImportCode("");
        setImportError("");
    };

    const lastGuess = guesses[guesses.length - 1] ?? null;
    const canvasCursor: CSSProperties["cursor"] =
        mode === "creator" || mode === "solver" ? "crosshair" : "default";

    // ── Menu ───────────────────────────────────────────────────────────────────
    // Renders across all three slots as a centred overlay. Replace with your
    // own routing/modal approach if preferred.

    if (mode === "menu" || mode === "import") {
        const isImport = mode === "import";
        return (
            <>
                {/* sidebar-left — empty during menu */}
                <div className="sidebar-left" />

                {/* game-container wraps game-window + game-bar-down */}
                <div className="game-container">
                    <div
                        className="game-window"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <div
                            style={{
                                maxWidth: "400px",
                                width: "100%",
                                padding: "0 24px",
                                ...mono,
                            }}
                        >
                            {!isImport ? (
                                <>
                                    <div
                                        style={{
                                            fontSize: "22px",
                                            fontWeight: "bold",
                                            color: "#4a9eff",
                                            letterSpacing: "2px",
                                            marginBottom: "8px",
                                        }}
                                    >
                                        FUNCTION SNIPER
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "11px",
                                            color: "#336699",
                                            marginBottom: "28px",
                                            lineHeight: "1.8",
                                        }}
                                    >
                                        A fitness landscape game inspired by how genetic algorithms
                                        search for global optima. Create a landscape and challenge a
                                        friend to find its lowest point.
                                    </div>
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "10px",
                                        }}
                                    >
                                        <button
                                            style={primaryBtn()}
                                            onClick={() => setMode("creator")}
                                        >
                                            ▶ Create a Landscape
                                        </button>
                                        <button
                                            style={secondaryBtn()}
                                            onClick={() => setMode("import")}
                                        >
                                            ↓ Import &amp; Solve
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: "28px",
                                            borderTop: "1px solid #1e3a5f",
                                            paddingTop: "20px",
                                            fontSize: "11px",
                                            color: "#4a6a8f",
                                            lineHeight: "2",
                                        }}
                                    >
                                        1. Place local minima on the landscape
                                        <br />
                                        2. Designate one as the global minimum
                                        <br />
                                        3. Share the code — opponent finds the lowest point
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div
                                        style={{
                                            fontSize: "16px",
                                            color: "#4a9eff",
                                            letterSpacing: "2px",
                                            marginBottom: "6px",
                                        }}
                                    >
                                        IMPORT LANDSCAPE
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "11px",
                                            color: "#336699",
                                            marginBottom: "20px",
                                        }}
                                    >
                                        Paste the code from your opponent.
                                    </div>
                                    <div style={fieldLabel}>Landscape Code</div>
                                    <textarea
                                        style={{
                                            ...inputStyle,
                                            height: "90px",
                                            resize: "vertical",
                                            marginBottom: "10px",
                                        }}
                                        value={importCode}
                                        onChange={(e) => setImportCode(e.target.value)}
                                        placeholder="Paste code here..."
                                    />
                                    {importError && (
                                        <div
                                            style={{
                                                color: "#ff4444",
                                                fontSize: "11px",
                                                marginBottom: "8px",
                                            }}
                                        >
                                            {importError}
                                        </div>
                                    )}
                                    <div style={{ display: "flex", gap: "8px" }}>
                                        <button
                                            style={{
                                                ...secondaryBtn(),
                                                width: "auto",
                                                padding: "8px 16px",
                                            }}
                                            onClick={() => setMode("menu")}
                                        >
                                            ← Back
                                        </button>
                                        <button style={primaryBtn()} onClick={handleImport}>
                                            Load &amp; Play
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="game-bar-down" />
                </div>

                {/* sidebar-right — empty during menu */}
                <div className="sidebar-right" />
            </>
        );
    }

    // ── Creator / Solver ────────────────────────────────────────────────────────

    return (
        <>
            {/* ════════════════════════════════════════════════════════════════════
          sidebar-left — Configuration
          ════════════════════════════════════════════════════════════════════ */}
            <div
                className="sidebar-left"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0",
                    overflowY: "auto",
                    ...mono,
                }}
            >
                {/* Mode badge */}
                <div
                    style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid #1e3a5f",
                        fontSize: "10px",
                        letterSpacing: "2px",
                        color: "#4a9eff",
                        textTransform: "uppercase",
                    }}
                >
                    {mode === "creator" ? "▶ Creator Mode" : "◎ Solver Mode"}
                </div>

                <div
                    style={{
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "14px",
                        flex: 1,
                    }}
                >
                    {/* ── Creator config ── */}
                    {mode === "creator" && (
                        <>
                            <div>
                                <div style={sectionLabel}>Place Minimum</div>
                                <div style={{ ...hint, marginBottom: "12px" }}>
                                    Click the map to drop a local minimum using the settings below.
                                </div>

                                <div style={fieldLabel}>Depth — {depth.toFixed(2)}</div>
                                <input
                                    type="range"
                                    min={0.3}
                                    max={2}
                                    step={0.05}
                                    value={depth}
                                    onChange={(e) => setDepth(Number(e.target.value))}
                                    style={{
                                        width: "100%",
                                        accentColor: "#4a9eff",
                                        marginBottom: "10px",
                                    }}
                                />

                                <div style={fieldLabel}>Spread — {spread.toFixed(2)}</div>
                                <input
                                    type="range"
                                    min={0.04}
                                    max={0.3}
                                    step={0.01}
                                    value={spread}
                                    onChange={(e) => setSpread(Number(e.target.value))}
                                    style={{ width: "100%", accentColor: "#4a9eff" }}
                                />
                            </div>

                            <div style={divider} />

                            <div>
                                <div style={sectionLabel}>Placed Minima</div>
                                {minima.length === 0 && (
                                    <div style={hint}>None yet.</div>
                                )}
                                {minima.map((m, i) => (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "5px 7px",
                                            background: "#0d1117",
                                            border: `1px solid ${globalIdx === i ? "#ffaa00" : "#1e3a5f"}`,
                                            borderRadius: "2px",
                                            marginBottom: "4px",
                                            fontSize: "10px",
                                            color: globalIdx === i ? "#ffaa00" : "#5a7a9f",
                                        }}
                                    >
                    <span>
                      {globalIdx === i ? "★ " : "◦ "}M{i + 1} (
                        {m.x.toFixed(2)}, {m.y.toFixed(2)})
                    </span>
                                        <span>
                      <button
                          style={starBtn()}
                          onClick={() => setGlobalIdx(i)}
                          title="Set as global minimum"
                      >
                        ★
                      </button>
                      <button
                          style={dangerBtn()}
                          onClick={() => handleRemoveMinima(i)}
                          title="Remove"
                      >
                        ✕
                      </button>
                    </span>
                                    </div>
                                ))}
                            </div>

                            <div style={divider} />

                            <div
                                style={{
                                    fontSize: "11px",
                                    color: "#4a6a8f",
                                    lineHeight: "2.1",
                                }}
                            >
                                <div>
                                    Placed:{" "}
                                    <span style={{ color: "#c8d8f0" }}>{minima.length}</span>
                                </div>
                                <div>
                                    Global:{" "}
                                    <span
                                        style={{
                                            color: globalIdx !== null ? "#ffaa00" : "#336699",
                                        }}
                                    >
                    {globalIdx !== null ? `M${globalIdx + 1}` : "not set"}
                  </span>
                                </div>
                            </div>

                            <div style={divider} />

                            <div style={{ fontSize: "10px", color: "#336699", lineHeight: "1.7" }}>
                                <strong style={{ color: "#4a9eff" }}>Tip:</strong> Pack local
                                minima near the global one to trap hill-climbers — just like a
                                deceptive real-world fitness landscape.
                            </div>
                        </>
                    )}

                    {/* ── Solver config ── */}
                    {mode === "solver" && (
                        <>
                            <div>
                                <div style={sectionLabel}>Your Mission</div>
                                <div style={hint}>
                                    Find the{" "}
                                    <strong style={{ color: "#ff4444" }}>global minimum</strong>.
                                    Click the map to place guesses and use the proximity panel on
                                    the right to zero in.
                                </div>
                            </div>

                            <div style={divider} />

                            <div
                                style={{
                                    fontSize: "11px",
                                    color: "#4a6a8f",
                                    lineHeight: "2.1",
                                }}
                            >
                                <div>
                                    Guesses:{" "}
                                    <span style={{ color: "#c8d8f0" }}>{guesses.length}</span>
                                </div>
                                <div>
                                    Status:{" "}
                                    <span style={{ color: gameWon ? "#44ff88" : "#336699" }}>
                    {gameWon ? "Found!" : "Searching…"}
                  </span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
          game-container > game-window — Canvas map
          ════════════════════════════════════════════════════════════════════ */}
            <div className="game-container">
                <div className="game-window">
                    <div
                        style={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            cursor: canvasCursor,
                            overflow: "hidden",
                        }}
                        onClick={handleCanvasClick}
                        onMouseMove={(e) => setHovered(getCanvasCoords(e))}
                        onMouseLeave={() => setHovered(null)}
                    >
                        <canvas
                            ref={canvasRef}
                            width={W}
                            height={H}
                            style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                            }}
                        />

                        {/* Empty state overlay */}
                        {minima.length === 0 && mode === "creator" && (
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    pointerEvents: "none",
                                }}
                            >
                                <div
                                    style={{
                                        textAlign: "center",
                                        color: "#1e3a5f",
                                        ...mono,
                                    }}
                                >
                                    <div style={{ fontSize: "36px", marginBottom: "10px" }}>+</div>
                                    <div style={{ fontSize: "11px", letterSpacing: "2px" }}>
                                        Click to place minima
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Solver hint */}
                        {mode === "solver" && !gameWon && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "8px",
                                    right: "8px",
                                    background: "rgba(7,9,15,0.85)",
                                    border: "1px solid #1e3a5f",
                                    borderRadius: "2px",
                                    padding: "5px 10px",
                                    fontSize: "10px",
                                    color: "#336699",
                                    letterSpacing: "1px",
                                    pointerEvents: "none",
                                    ...mono,
                                }}
                            >
                                Click to guess
                            </div>
                        )}

                        {/* Win banner */}
                        {gameWon && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "10px",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "rgba(7,9,15,0.92)",
                                    border: "1px solid #44ff88",
                                    borderRadius: "2px",
                                    padding: "6px 20px",
                                    fontSize: "11px",
                                    color: "#44ff88",
                                    letterSpacing: "2px",
                                    pointerEvents: "none",
                                    ...mono,
                                }}
                            >
                                ✓ GLOBAL MINIMUM FOUND
                            </div>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════════
            game-bar-down — Action buttons
            ══════════════════════════════════════════════════════════════════ */}
                <div
                    className="game-bar-down"
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "10px 16px",
                        flexWrap: "wrap",
                        ...mono,
                    }}
                >
                    {mode === "creator" && (
                        <>
                            <button
                                style={{
                                    ...primaryBtn(globalIdx === null || minima.length === 0),
                                    width: "auto",
                                    padding: "7px 18px",
                                }}
                                disabled={globalIdx === null || minima.length === 0}
                                onClick={handleGenerateCode}
                            >
                                Generate Code
                            </button>

                            {showCode && code && (
                                <>
                                    <button
                                        style={{
                                            ...secondaryBtn(),
                                            width: "auto",
                                            padding: "7px 18px",
                                        }}
                                        onClick={copyCode}
                                    >
                                        {copied ? "✓ Copied!" : "Copy Code"}
                                    </button>
                                    <div
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            fontSize: "9px",
                                            color: "#44ff88",
                                            background: "#07090f",
                                            border: "1px solid #1e4a00",
                                            borderRadius: "2px",
                                            padding: "6px 10px",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                            ...mono,
                                        }}
                                    >
                                        {code}
                                    </div>
                                </>
                            )}

                            <button
                                style={{
                                    ...dangerBtn(),
                                    marginLeft: "auto",
                                    padding: "7px 14px",
                                    fontSize: "11px",
                                }}
                                onClick={resetAll}
                            >
                                Reset
                            </button>
                        </>
                    )}

                    {mode === "solver" && (
                        <>
                            <div
                                style={{
                                    fontSize: "11px",
                                    color: "#4a6a8f",
                                    letterSpacing: "1px",
                                }}
                            >
                                Guesses:{" "}
                                <span style={{ color: "#c8d8f0" }}>{guesses.length}</span>
                            </div>

                            <button
                                style={{
                                    ...secondaryBtn(),
                                    width: "auto",
                                    padding: "7px 18px",
                                }}
                                onClick={() => {
                                    setGuesses([]);
                                    setGameWon(false);
                                }}
                            >
                                Clear Guesses
                            </button>

                            <button
                                style={{
                                    ...dangerBtn(),
                                    marginLeft: "auto",
                                    padding: "7px 14px",
                                    fontSize: "11px",
                                }}
                                onClick={resetAll}
                            >
                                Back to Menu
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
          sidebar-right — Analytics / Proximity
          ════════════════════════════════════════════════════════════════════ */}
            <div
                className="sidebar-right"
                style={{ overflowY: "auto", ...mono }}
            >
                <h3
                    style={{
                        fontSize: "10px",
                        letterSpacing: "2px",
                        textTransform: "uppercase",
                        color: "#4a9eff",
                        margin: "0 0 16px 0",
                        fontWeight: 400,
                        ...mono,
                    }}
                >
                    Analytics
                </h3>

                {mode === "creator" && (
                    <div style={hint}>
                        Analytics appear here once you switch to Solver mode.
                    </div>
                )}

                {mode === "solver" && (
                    <ProximityPanel
                        lastGuess={lastGuess}
                        guesses={guesses}
                        gameWon={gameWon}
                    />
                )}
            </div>
        </>
    );
}