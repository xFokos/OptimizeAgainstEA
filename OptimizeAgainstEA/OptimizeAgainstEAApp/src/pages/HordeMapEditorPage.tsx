import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '../components/layout/PageContainer';
import { ARENA, GAME_CONFIG } from '../modules/shooterGame/shooter.types';
import type { HordeObstacle, HordeSpawnSide } from '../modules/shooterGame/horde/hordeTypes';
import { circleIntersectsObstacle } from '../modules/shooterGame/horde/hordeCollision';
import { useSettings } from '../context/SettingsContext';

const HC          = '#fb923c';
const EDITOR_SIZE = 560;                      // px on screen — ARENA is square, so one scale factor covers both axes
const SCALE       = EDITOR_SIZE / ARENA.WIDTH;
const MIN_SIZE    = 20;                       // arena-space px — drags smaller than this are discarded as accidental clicks
const MOVE_DEADZONE = 4;                      // screen px before a mousedown-on-obstacle counts as a move, not a select
const MAX_OBSTACLES = 18;                     // soft cap — keeps agents*obstacles collision cost and occupancy-grid build bounded
const SPAWN_RADIUS = GAME_CONFIG.PLAYER_RADIUS;
const SPAWN_MOVE_INDEX = -1;                  // sentinel moveState.index meaning "dragging the player spawn marker"

const SIDES: { side: HordeSpawnSide; label: string }[] = [
    { side: 'top',    label: 'Top' },
    { side: 'right',  label: 'Right' },
    { side: 'bottom', label: 'Bottom' },
    { side: 'left',   label: 'Left' },
];

function glowStyle(side: HordeSpawnSide): React.CSSProperties {
    const base: React.CSSProperties = { position: 'absolute', pointerEvents: 'none' };
    const GLOW = 44;
    switch (side) {
        case 'top':    return { ...base, top: 0, left: 0, right: 0, height: GLOW, background: 'linear-gradient(rgba(251,146,60,0.45), transparent)' };
        case 'bottom': return { ...base, bottom: 0, left: 0, right: 0, height: GLOW, background: 'linear-gradient(transparent, rgba(251,146,60,0.45))' };
        case 'left':   return { ...base, top: 0, bottom: 0, left: 0, width: GLOW, background: 'linear-gradient(90deg, rgba(251,146,60,0.45), transparent)' };
        default:       return { ...base, top: 0, bottom: 0, right: 0, width: GLOW, background: 'linear-gradient(90deg, transparent, rgba(251,146,60,0.45))' };
    }
}

interface MoveState {
    index:       number;
    startPxX:    number;
    startPxY:    number;
    startX:      number;
    startY:      number;
    moved:       boolean;
}

export default function HordeMapEditorPage() {
    const navigate = useNavigate();
    const { hordeSettings, setHordeSettings } = useSettings();

    const fieldRef = useRef<HTMLDivElement>(null);
    const [obstacles, setObstacles] = useState<HordeObstacle[]>(hordeSettings.customObstacles);
    const [playerSpawn, setPlayerSpawn] = useState(hordeSettings.customPlayerSpawn);
    const spawnSides = hordeSettings.customSpawnSides;

    const [selected, setSelected] = useState<number | null>(null);
    const [newBlocksBullets, setNewBlocksBullets] = useState(true);
    const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
    const moveState = useRef<MoveState | null>(null);

    const commitObstacles = (next: HordeObstacle[]) => {
        setObstacles(next);
        setHordeSettings({ ...hordeSettings, mapId: 'custom', customObstacles: next });
    };

    const commitPlayerSpawn = (next: { x: number; y: number }) => {
        setPlayerSpawn(next);
        setHordeSettings({ ...hordeSettings, mapId: 'custom', customPlayerSpawn: next });
    };

    const toggleSpawnSide = (side: HordeSpawnSide) => {
        const next = spawnSides.includes(side) ? spawnSides.filter(s => s !== side) : [...spawnSides, side];
        setHordeSettings({ ...hordeSettings, mapId: 'custom', customSpawnSides: next });
    };

    const arenaPos = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
        const rect = fieldRef.current!.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(ARENA.WIDTH,  (e.clientX - rect.left) / SCALE)),
            y: Math.max(0, Math.min(ARENA.HEIGHT, (e.clientY - rect.top)  / SCALE)),
        };
    };

    const handleFieldMouseDown = (e: React.MouseEvent) => {
        setSelected(null);
        if (obstacles.length >= MAX_OBSTACLES) return;
        const p = arenaPos(e);
        setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    };

    const handleFieldMouseMove = (e: React.MouseEvent) => {
        if (draft) {
            const p = arenaPos(e);
            setDraft({ ...draft, x1: p.x, y1: p.y });
        } else if (moveState.current) {
            const m = moveState.current;
            if (!m.moved && Math.hypot(e.clientX - m.startPxX, e.clientY - m.startPxY) < MOVE_DEADZONE) return;
            m.moved = true;
            if (m.index === SPAWN_MOVE_INDEX) {
                const nx = Math.max(SPAWN_RADIUS, Math.min(ARENA.WIDTH  - SPAWN_RADIUS, m.startX + (e.clientX - m.startPxX) / SCALE));
                const ny = Math.max(SPAWN_RADIUS, Math.min(ARENA.HEIGHT - SPAWN_RADIUS, m.startY + (e.clientY - m.startPxY) / SCALE));
                setPlayerSpawn({ x: nx, y: ny });
            } else {
                const o  = obstacles[m.index];
                const nx = Math.max(0, Math.min(ARENA.WIDTH  - o.w, m.startX + (e.clientX - m.startPxX) / SCALE));
                const ny = Math.max(0, Math.min(ARENA.HEIGHT - o.h, m.startY + (e.clientY - m.startPxY) / SCALE));
                setObstacles(obstacles.map((ob, i) => i === m.index ? { ...ob, x: nx, y: ny } : ob));
            }
        }
    };

    const handleFieldMouseUp = () => {
        if (draft) {
            const x = Math.min(draft.x0, draft.x1), y = Math.min(draft.y0, draft.y1);
            const w = Math.abs(draft.x1 - draft.x0), h = Math.abs(draft.y1 - draft.y0);
            setDraft(null);
            if (w >= MIN_SIZE && h >= MIN_SIZE) {
                const next = [...obstacles, { x, y, w, h, blocksBullets: newBlocksBullets }];
                commitObstacles(next);
                setSelected(next.length - 1);
            }
        } else if (moveState.current) {
            const m = moveState.current;
            moveState.current = null;
            if (m.index === SPAWN_MOVE_INDEX) {
                if (m.moved) commitPlayerSpawn(playerSpawn);
            } else if (m.moved) {
                commitObstacles(obstacles);
            } else {
                setSelected(m.index);
            }
        }
    };

    const startMoveObstacle = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        const o = obstacles[index];
        moveState.current = { index, startPxX: e.clientX, startPxY: e.clientY, startX: o.x, startY: o.y, moved: false };
    };

    const startMoveSpawn = (e: React.MouseEvent) => {
        e.stopPropagation();
        moveState.current = {
            index: SPAWN_MOVE_INDEX, startPxX: e.clientX, startPxY: e.clientY,
            startX: playerSpawn.x, startY: playerSpawn.y, moved: false,
        };
    };

    const toggleSelectedBlocksBullets = () => {
        if (selected === null) return;
        commitObstacles(obstacles.map((o, i) => i === selected ? { ...o, blocksBullets: !o.blocksBullets } : o));
    };

    const deleteSelected = () => {
        if (selected === null) return;
        const next = obstacles.filter((_, i) => i !== selected);
        setSelected(null);
        commitObstacles(next);
    };

    const clearAll = () => {
        setSelected(null);
        commitObstacles([]);
    };

    const selectedObstacle = selected !== null ? obstacles[selected] : null;
    const spawnBlocked = obstacles.some(o => circleIntersectsObstacle(playerSpawn.x, playerSpawn.y, SPAWN_RADIUS, o));

    return (
        <PageContainer>
            <div style={{
                width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 16, padding: 20, boxSizing: 'border-box', overflow: 'auto',
                fontFamily: '"JetBrains Mono", monospace', color: '#fff',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: EDITOR_SIZE }}>
                    <button
                        onClick={() => navigate('/lobby/shooter', { state: { mode: 'horde', hordeTab: 'Map' } })}
                        style={{
                            background: 'transparent', border: `1px solid ${HC}`, borderRadius: 6, color: HC,
                            fontFamily: 'inherit', fontSize: 12, padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.04em',
                        }}
                    >
                        ← Back to Map
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: HC, letterSpacing: '0.08em' }}>MAP EDITOR</span>
                        <span style={{
                            fontSize: 10,
                            color: obstacles.length >= MAX_OBSTACLES ? '#f87171' : 'rgba(255,255,255,0.35)',
                        }}>
                            {obstacles.length} / {MAX_OBSTACLES} obstacles{obstacles.length >= MAX_OBSTACLES ? ' — max reached' : ''}
                        </span>
                    </div>
                    <button
                        onClick={clearAll}
                        disabled={obstacles.length === 0}
                        style={{
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6,
                            color: obstacles.length === 0 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)',
                            fontFamily: 'inherit', fontSize: 12, padding: '6px 14px',
                            cursor: obstacles.length === 0 ? 'default' : 'pointer', letterSpacing: '0.04em',
                        }}
                    >
                        Clear All
                    </button>
                </div>

                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                    <div
                        ref={fieldRef}
                        onMouseDown={handleFieldMouseDown}
                        onMouseMove={handleFieldMouseMove}
                        onMouseUp={handleFieldMouseUp}
                        onMouseLeave={handleFieldMouseUp}
                        style={{
                            position: 'relative', width: EDITOR_SIZE, height: EDITOR_SIZE, flexShrink: 0,
                            background: '#0f0f1a', border: '2px solid rgba(251,146,60,0.3)', borderRadius: 4,
                            cursor: 'crosshair', userSelect: 'none', overflow: 'hidden',
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), ' +
                                'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
                            backgroundSize: `${40 * SCALE}px ${40 * SCALE}px`,
                        }}
                    >
                        {spawnSides.map(side => <div key={side} style={glowStyle(side)} />)}

                        {obstacles.map((o, i) => (
                            <div
                                key={i}
                                onMouseDown={(e) => startMoveObstacle(e, i)}
                                style={{
                                    position: 'absolute',
                                    left: o.x * SCALE, top: o.y * SCALE, width: o.w * SCALE, height: o.h * SCALE,
                                    boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', cursor: 'move',
                                    border: `2px ${o.blocksBullets ? 'solid' : 'dashed'} ${
                                        selected === i ? '#ffffff' : o.blocksBullets ? 'rgba(251,146,60,0.65)' : 'rgba(255,255,255,0.35)'
                                    }`,
                                }}
                            />
                        ))}

                        {draft && (() => {
                            const x = Math.min(draft.x0, draft.x1) * SCALE;
                            const y = Math.min(draft.y0, draft.y1) * SCALE;
                            const w = Math.abs(draft.x1 - draft.x0) * SCALE;
                            const h = Math.abs(draft.y1 - draft.y0) * SCALE;
                            return (
                                <div style={{
                                    position: 'absolute', left: x, top: y, width: w, height: h, boxSizing: 'border-box',
                                    border: '2px dashed rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none',
                                }} />
                            );
                        })()}

                        {/* Player spawn marker — drag to reposition */}
                        <div
                            onMouseDown={startMoveSpawn}
                            style={{
                                position: 'absolute',
                                left: playerSpawn.x * SCALE - 8, top: playerSpawn.y * SCALE - 8,
                                width: 16, height: 16, borderRadius: '50%', cursor: 'move',
                                background: spawnBlocked ? '#ef5350' : '#4fc3f7',
                                boxShadow: spawnBlocked ? '0 0 0 5px rgba(239,83,80,0.35)' : '0 0 0 5px rgba(79,195,247,0.25)',
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 220, flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                                Enemy Spawn Sides
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                                {SIDES.map(({ side, label }) => {
                                    const active = spawnSides.includes(side);
                                    return (
                                        <button
                                            key={side}
                                            onClick={() => toggleSpawnSide(side)}
                                            style={{
                                                padding: '6px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                                                fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
                                                border: `1px solid ${active ? HC : 'rgba(255,255,255,0.2)'}`,
                                                color: active ? HC : 'rgba(255,255,255,0.5)',
                                                background: active ? 'rgba(251,146,60,0.1)' : 'transparent',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            {spawnSides.length === 0 && (
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5 }}>
                                    None selected — agents will spawn from every side.
                                </span>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                                New Obstacle Type
                            </span>
                            <button
                                onClick={() => setNewBlocksBullets(v => !v)}
                                style={{
                                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                                    fontSize: 11, fontWeight: 700, letterSpacing: '0.02em', textAlign: 'left',
                                    border: `1px solid ${HC}`, color: HC, background: 'rgba(251,146,60,0.08)',
                                }}
                            >
                                {newBlocksBullets ? 'Cover — blocks bullets too' : 'Wall — blocks movement only'}
                            </button>
                        </div>

                        {selectedObstacle && (
                            <div style={{
                                display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
                                border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, background: 'rgba(255,255,255,0.03)',
                            }}>
                                <span style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
                                    Selected Obstacle
                                </span>
                                <button
                                    onClick={toggleSelectedBlocksBullets}
                                    style={{
                                        padding: '6px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                                        fontSize: 11, textAlign: 'left', border: '1px solid rgba(255,255,255,0.25)',
                                        color: 'rgba(255,255,255,0.75)', background: 'transparent',
                                    }}
                                >
                                    {selectedObstacle.blocksBullets ? '✓ Blocks bullets (click to make wall-only)' : '✕ Wall-only (click to make cover)'}
                                </button>
                                <button
                                    onClick={deleteSelected}
                                    className="btn btn--outline btn--c-danger"
                                    style={{ fontSize: 11 }}
                                >
                                    Delete
                                </button>
                            </div>
                        )}

                        {spawnBlocked && (
                            <span style={{ fontSize: 10, color: '#f87171', lineHeight: 1.5 }}>
                                ⚠ Spawn point is inside an obstacle — move it clear.
                            </span>
                        )}

                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, margin: 0 }}>
                            Drag on the field to add an obstacle. Drag an existing one to move it,
                            or click it (no drag) to select and edit it. Drag the blue dot to move
                            the player's spawn point.
                        </p>
                    </div>
                </div>
            </div>
        </PageContainer>
    );
}
