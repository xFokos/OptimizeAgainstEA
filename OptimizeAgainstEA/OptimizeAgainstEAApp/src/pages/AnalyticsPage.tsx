import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer,
} from 'recharts';
import { analyticsStore, type RoundRecord } from '../modules/shooterGame/game/analyticsStore';
import { GAME_CONFIG, ARENA } from '../modules/shooterGame/shooter.types';

// ---- Tokens ----
const C = {
    bg:          '#0b141a',
    panel:       'rgba(255,255,255,0.04)',
    panelHover:  'rgba(255,255,255,0.06)',
    border:      'rgba(255,255,255,0.07)',
    borderStrong:'#2a3a44',
    accent:      '#4fc3f7',
    danger:      '#ef5350',
    success:     '#66bb6a',
    warn:        '#ffa726',
    text:        'rgba(255,255,255,0.87)',
    textDim:     'rgba(255,255,255,0.50)',
    textMuted:   'rgba(255,255,255,0.28)',
    font:        "'Inter', system-ui, sans-serif",
    mono:        "'JetBrains Mono', monospace",
} as const;

// ============================================================
// Shared components
// ============================================================

function StatCard({ label, value, sub, accent = C.accent }: {
    label: string; value: string; sub?: string; accent?: string;
}) {
    return (
        <div style={sh.card}>
            <div style={sh.cardLabel}>{label}</div>
            <div style={{ ...sh.cardValue, color: accent }}>{value}</div>
            {sub && <div style={sh.cardSub}>{sub}</div>}
        </div>
    );
}

function Panel({ title, children, style }: {
    title: string; children: React.ReactNode; style?: React.CSSProperties;
}) {
    return (
        <div style={{ ...sh.panel, ...style }}>
            <div style={sh.panelTitle}>{title}</div>
            {children}
        </div>
    );
}

function ChartTip({ active, payload, label }: {
    active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string;
}) {
    if (!active || !payload?.length) return null;
    return (
        <div style={sh.tip}>
            <div style={sh.tipLabel}>Runde {label}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color, fontSize: 12, marginTop: 2 }}>
                    {p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</strong>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
    return (
        <div style={sh.empty}>
            <div style={{ fontSize: 48, opacity: 0.2 }}>📊</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: C.textDim }}>Noch keine Daten</div>
            <div style={{ fontSize: 13, color: C.textMuted, textAlign: 'center', maxWidth: 300 }}>
                Spiele mindestens eine Runde im Shooter-Game, um Statistiken zu sehen.
            </div>
            <button style={sh.accentBtn} onClick={onNavigate}>Zum Spiel →</button>
        </div>
    );
}

// ============================================================
// Tab 1: Übersicht
// ============================================================

function OverviewTab({ rounds }: { rounds: RoundRecord[] }) {
    const totalRounds     = rounds.length;
    const avgAccuracy     = rounds.reduce((a, r) => a + r.accuracy, 0) / totalRounds;
    const avgHitsOnPlayer = rounds.reduce((a, r) => a + r.hitsLanded, 0) / totalRounds;
    const bestFitness     = Math.max(...rounds.map(r => r.fitness));

    const data = rounds.map(r => ({
        runde:       r.round,
        'Fitness':              Math.round(r.fitness),
        'Treffer (Agent→Spieler)': r.hitsLanded,
        'Treffer (Spieler→Agent)': r.hitsReceived,
        'Genauigkeit %':        Math.round(r.accuracy * 100),
        'Ausgewichen':          r.dodged,
    }));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                <StatCard label="Runden"          value={String(totalRounds)} />
                <StatCard label="Beste Fitness"   value={Math.round(bestFitness).toString()} accent={C.success} />
                <StatCard label="Ø Genauigkeit"   value={`${Math.round(avgAccuracy * 100)} %`} />
                <StatCard label="Ø Treffer/Runde" value={avgHitsOnPlayer.toFixed(1)} accent={C.danger}
                          sub="Agent trifft Spieler" />
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1, minHeight: 0 }}>
                <Panel title="Fitness über Runden" style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="runde" stroke={C.textMuted} tick={{ fontSize: 11 }} />
                            <YAxis stroke={C.textMuted} tick={{ fontSize: 11 }} />
                            <Tooltip content={<ChartTip />} />
                            <Line dataKey="Fitness" stroke={C.accent} strokeWidth={2}
                                  dot={{ r: 3, fill: C.accent }} isAnimationActive={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </Panel>

                <Panel title="Treffer & Genauigkeit" style={{ flex: 1, minHeight: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                            <XAxis dataKey="runde" stroke={C.textMuted} tick={{ fontSize: 11 }} />
                            <YAxis stroke={C.textMuted} tick={{ fontSize: 11 }} />
                            <Tooltip content={<ChartTip />} />
                            <Legend wrapperStyle={{ fontSize: 11, color: C.textDim }} />
                            <Bar dataKey="Treffer (Agent→Spieler)" fill={C.danger}  radius={[3,3,0,0]} />
                            <Bar dataKey="Treffer (Spieler→Agent)" fill={C.accent} radius={[3,3,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </Panel>
            </div>
        </div>
    );
}

// ============================================================
// Tab 2: Verlauf (Tabelle)
// ============================================================

function VerlaufTab({ rounds }: { rounds: RoundRecord[] }) {
    const cols = [
        { key: 'round',        label: 'Runde',       color: C.textDim },
        { key: 'hitsLanded',   label: 'Treffer ↑',   color: C.danger  },
        { key: 'hitsReceived', label: 'Kassiert ↑',  color: C.accent  },
        { key: 'bulletsFired', label: 'Geschossen',  color: C.textDim },
        { key: 'accuracy',     label: 'Genauigkeit', color: C.textDim },
        { key: 'dodged',       label: 'Ausgewichen', color: C.warn    },
        { key: 'fitness',      label: 'Fitness',     color: C.success },
        { key: 'generation',   label: 'Gen.',        color: C.textMuted },
    ] as const;

    const fmt = (r: RoundRecord, key: typeof cols[number]['key']) => {
        if (key === 'accuracy') return `${Math.round(r.accuracy * 100)} %`;
        if (key === 'fitness')  return Math.round(r.fitness).toString();
        return String(r[key]);
    };

    return (
        <div style={{ height: '100%', overflowY: 'auto' }}>
            <table style={sh.table}>
                <thead style={{ position: 'sticky', top: 0, background: C.bg, zIndex: 1 }}>
                    <tr>
                        {cols.map(c => <th key={c.key} style={sh.th}>{c.label}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {[...rounds].reverse().map(r => (
                        <tr key={r.round} style={sh.tr}>
                            {cols.map(c => (
                                <td key={c.key} style={{ ...sh.td, color: c.color }}>
                                    {fmt(r, c.key)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ============================================================
// Tab 3: Replay
// ============================================================

const REPLAY_SIZE   = 480;
const SCALE         = REPLAY_SIZE / ARENA.WIDTH;
const BULLET_SPEED  = GAME_CONFIG.BULLET_SPEED  * SCALE;
const BULLET_LIFE   = GAME_CONFIG.BULLET_LIFETIME;
const PLAYER_R      = GAME_CONFIG.PLAYER_RADIUS * SCALE;
const AGENT_R       = GAME_CONFIG.AGENT_RADIUS  * SCALE;
const BULLET_R      = GAME_CONFIG.BULLET_RADIUS * SCALE;

interface RBullet { x: number; y: number; vx: number; vy: number; life: number; owner: 'player'|'agent'; }

function ReplayCanvas({ record }: { record: RoundRecord }) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const stateRef   = useRef({
        frameIdx:  0,
        playing:   false,
        speed:     1,
        bullets:   [] as RBullet[],
        lastTime:  0,
        fracFrame: 0,
    });
    const [frameIdx, setFrameIdx] = useState(0);
    const [playing,  setPlaying]  = useState(false);
    const [speed,    setSpeed]    = useState(1);
    const animRef = useRef<number>(0);
    const totalFrames = record.playerFrames.length;

    // Bullet sim: advance bullet state from `from` to `to` frame
    const advanceBullets = useCallback((bullets: RBullet[], from: number, to: number, dt_frame: number): RBullet[] => {
        let bs = bullets;
        for (let i = from; i < to; i++) {
            const pf = record.playerFrames[i];
            const af = record.agentFrames[i];
            if (!pf || !af) break;

            // spawn
            if (pf.shot) {
                bs = [...bs, {
                    x: pf.position.x * SCALE, y: pf.position.y * SCALE,
                    vx: Math.cos(pf.rotation) * BULLET_SPEED,
                    vy: Math.sin(pf.rotation) * BULLET_SPEED,
                    life: BULLET_LIFE, owner: 'player',
                }];
            }
            if (af.shot) {
                bs = [...bs, {
                    x: af.position.x * SCALE, y: af.position.y * SCALE,
                    vx: Math.cos(af.rotation) * BULLET_SPEED,
                    vy: Math.sin(af.rotation) * BULLET_SPEED,
                    life: BULLET_LIFE, owner: 'agent',
                }];
            }

            // move & prune
            bs = bs
                .map(b => ({ ...b, x: b.x + b.vx * dt_frame, y: b.y + b.vy * dt_frame, life: b.life - dt_frame }))
                .filter(b => b.life > 0 && b.x > 0 && b.x < REPLAY_SIZE && b.y > 0 && b.y < REPLAY_SIZE);
        }
        return bs;
    }, [record]);

    const draw = useCallback((fi: number, bullets: RBullet[]) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const pf = record.playerFrames[fi];
        const af = record.agentFrames[fi];
        if (!pf || !af) return;

        // Arena
        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, REPLAY_SIZE, REPLAY_SIZE);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let x = 0; x <= REPLAY_SIZE; x += 40 * SCALE) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, REPLAY_SIZE); ctx.stroke();
        }
        for (let y = 0; y <= REPLAY_SIZE; y += 40 * SCALE) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(REPLAY_SIZE, y); ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(1, 1, REPLAY_SIZE - 2, REPLAY_SIZE - 2);

        // Bullets
        for (const b of bullets) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(b.x, b.y, BULLET_R, 0, Math.PI * 2);
            ctx.fillStyle   = b.owner === 'player' ? '#80d8ff' : '#ff8a80';
            ctx.shadowColor = b.owner === 'player' ? '#4fc3f7'  : '#ef5350';
            ctx.shadowBlur  = 6;
            ctx.fill();
            ctx.restore();
        }

        // Player
        const drawEntity = (x: number, y: number, rot: number, r: number, color: string, glow: string) => {
            ctx.save();
            ctx.translate(x * SCALE, y * SCALE);
            ctx.rotate(rot);
            ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fillStyle = color; ctx.fill();
            ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(r + 8 * SCALE, 0);
            ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, r + 3 * SCALE, 0, Math.PI * 2);
            ctx.strokeStyle = glow; ctx.lineWidth = 2; ctx.stroke();
            ctx.restore();
        };

        drawEntity(pf.position.x, pf.position.y, pf.rotation, PLAYER_R, '#4fc3f7', 'rgba(79,195,247,0.3)');
        drawEntity(af.position.x, af.position.y, af.rotation, AGENT_R,  '#ef5350', 'rgba(239,83,80,0.3)');

        // Time overlay
        const t = pf.time != null ? Math.ceil(pf.time) : '';
        ctx.font = `500 ${Math.round(14 * SCALE)}px JetBrains Mono, monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.textAlign = 'center';
        ctx.fillText(`${t}s`, REPLAY_SIZE / 2, 18 * SCALE);
    }, [record]);

    // seek: reset bullets and fast-forward to target
    const seekTo = useCallback((fi: number) => {
        const bullets = advanceBullets([], 0, fi, 1 / 60);
        stateRef.current.frameIdx  = fi;
        stateRef.current.bullets   = bullets;
        stateRef.current.fracFrame = fi;
        setFrameIdx(fi);
        draw(fi, bullets);
    }, [advanceBullets, draw]);

    // animation loop
    const loop = useCallback((ts: number) => {
        const st = stateRef.current;
        if (!st.playing) return;

        const dt  = Math.min((ts - st.lastTime) / 1000, 0.1);
        st.lastTime = ts;

        const advance = dt * 60 * st.speed;
        const newFrac = st.fracFrame + advance;
        const oldIdx  = Math.floor(st.fracFrame);
        const newIdx  = Math.min(Math.floor(newFrac), totalFrames - 1);

        if (newIdx !== oldIdx) {
            st.bullets   = advanceBullets(st.bullets, oldIdx, newIdx, 1 / 60);
            st.frameIdx  = newIdx;
            setFrameIdx(newIdx);
        }
        st.fracFrame = newFrac >= totalFrames ? totalFrames - 1 : newFrac;

        draw(st.frameIdx, st.bullets);

        if (newFrac >= totalFrames - 1) {
            stateRef.current.playing = false;
            setPlaying(false);
            return;
        }
        animRef.current = requestAnimationFrame(loop);
    }, [totalFrames, advanceBullets, draw]);

    // play/pause
    const togglePlay = () => {
        const st = stateRef.current;
        if (st.frameIdx >= totalFrames - 1) seekTo(0);
        st.playing  = !st.playing;
        st.lastTime = performance.now();
        setPlaying(st.playing);
        if (st.playing) animRef.current = requestAnimationFrame(loop);
        else cancelAnimationFrame(animRef.current);
    };

    // sync speed ref
    useEffect(() => { stateRef.current.speed = speed; }, [speed]);

    // draw on mount
    useEffect(() => { seekTo(0); }, [seekTo]);

    // cleanup
    useEffect(() => () => cancelAnimationFrame(animRef.current), []);

    const pct = totalFrames > 1 ? (frameIdx / (totalFrames - 1)) * 100 : 0;

    return (
        <div style={{ display: 'flex', gap: 20, height: '100%', alignItems: 'flex-start' }}>
            {/* Canvas */}
            <canvas
                ref={canvasRef}
                width={REPLAY_SIZE}
                height={REPLAY_SIZE}
                style={{ borderRadius: 8, border: `1px solid ${C.border}`, flexShrink: 0 }}
            />

            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                {/* Play / Speed */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button style={{ ...sh.ctrlBtn, minWidth: 80 }} onClick={togglePlay}>
                        {playing ? '⏸ Pause' : '▶ Play'}
                    </button>
                    {([0.25, 0.5, 1, 2] as const).map(s => (
                        <button
                            key={s}
                            style={{ ...sh.ctrlBtn, background: speed === s ? 'rgba(79,195,247,0.15)' : undefined, color: speed === s ? C.accent : C.textDim }}
                            onClick={() => { setSpeed(s); stateRef.current.speed = s; }}
                        >
                            {s}×
                        </button>
                    ))}
                </div>

                {/* Scrubber */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <input
                        type="range" min={0} max={totalFrames - 1} value={frameIdx}
                        onChange={e => { cancelAnimationFrame(animRef.current); stateRef.current.playing = false; setPlaying(false); seekTo(Number(e.target.value)); }}
                        style={{ width: '100%', accentColor: C.accent }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.textMuted, fontFamily: C.mono }}>
                        <span>Frame {frameIdx}</span>
                        <span>{Math.round(pct)} %</span>
                        <span>{totalFrames} frames</span>
                    </div>
                </div>

                {/* Frame stats */}
                {(() => {
                    const pf = record.playerFrames[frameIdx];
                    if (!pf) return null;
                    return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={sh.panelTitle}>Aktueller Frame</div>
                            <FrameStat label="Zeit" value={`${Math.ceil(Math.max(0, pf.time))} s`} />
                            <FrameStat label="Spieler X" value={Math.round(pf.position.x).toString()} />
                            <FrameStat label="Spieler Y" value={Math.round(pf.position.y).toString()} />
                        </div>
                    );
                })()}

                {/* DNA mini-display */}
                <div style={{ marginTop: 'auto' }}>
                    <div style={sh.panelTitle}>Agent DNA dieser Runde</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
                        {['Aggression','Dodge','Accuracy','Range','Speed','Lead','Fire Rate'].map((name, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 72, fontSize: 11, color: C.textMuted }}>{name}</span>
                                <div style={{ flex: 1, height: 5, background: C.panel, borderRadius: 3, overflow: 'hidden' }}>
                                    <div style={{ width: `${(record.agentDna[i] ?? 0) * 100}%`, height: '100%', background: C.accent, borderRadius: 3 }} />
                                </div>
                                <span style={{ width: 32, fontSize: 11, color: C.textDim, fontFamily: C.mono, textAlign: 'right' }}>
                                    {(record.agentDna[i] ?? 0).toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function FrameStat({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: C.textMuted }}>{label}</span>
            <span style={{ color: C.text, fontFamily: C.mono }}>{value}</span>
        </div>
    );
}

function ReplayTab({ rounds }: { rounds: RoundRecord[] }) {
    const [selected, setSelected] = useState(rounds[rounds.length - 1]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {/* Round selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: C.textMuted }}>Runde auswählen:</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {rounds.map(r => (
                        <button
                            key={r.round}
                            onClick={() => setSelected(r)}
                            style={{
                                ...sh.ctrlBtn,
                                background: selected.round === r.round ? 'rgba(79,195,247,0.15)' : undefined,
                                color:      selected.round === r.round ? C.accent : C.textDim,
                                border:     `1px solid ${selected.round === r.round ? C.accent : C.borderStrong}`,
                            }}
                        >
                            {r.round}
                        </button>
                    ))}
                </div>
            </div>

            {/* Canvas + Controls */}
            <div style={{ flex: 1, minHeight: 0 }}>
                {selected.playerFrames.length > 0
                    ? <ReplayCanvas key={selected.round} record={selected} />
                    : <div style={{ ...sh.empty, fontSize: 13, color: C.textMuted }}>
                        Keine Frame-Daten für Runde {selected.round}
                      </div>
                }
            </div>
        </div>
    );
}

// ============================================================
// Main Page
// ============================================================

type Tab = 'overview' | 'verlauf' | 'replay';

export default function AnalyticsPage() {
    const navigate = useNavigate();
    const [rounds, setRounds] = useState<RoundRecord[]>(() => [...analyticsStore.rounds]);
    const [tab, setTab]       = useState<Tab>('overview');

    useEffect(() => analyticsStore.subscribe(() => setRounds([...analyticsStore.rounds])), []);

    const hasData = rounds.length > 0;

    const TABS: { id: Tab; label: string }[] = [
        { id: 'overview', label: 'Übersicht'  },
        { id: 'verlauf',  label: 'Verlauf'    },
        { id: 'replay',   label: 'Replay'     },
    ];

    return (
        <div style={sh.root}>

            {/* Header */}
            <div style={sh.header}>
                <button style={sh.backBtn} onClick={() => navigate(-1)}>← Zurück</button>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, fontFamily: C.mono, letterSpacing: '0.05em' }}>Analytics</span>
                    <span style={{ fontSize: 10, color: C.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Shooter vs EA</span>
                </div>
                <div style={{ width: 100 }} />
            </div>

            {/* Tab bar */}
            {hasData && (
                <div style={sh.tabBar}>
                    {TABS.map(t => (
                        <button
                            key={t.id}
                            style={{ ...sh.tabBtn, ...(tab === t.id ? sh.tabActive : {}) }}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Body */}
            <div style={sh.body}>
                {!hasData
                    ? <EmptyState onNavigate={() => navigate('/lobby/shooter')} />
                    : tab === 'overview' ? <OverviewTab rounds={rounds} />
                    : tab === 'verlauf'  ? <VerlaufTab  rounds={rounds} />
                    :                     <ReplayTab    rounds={rounds} />
                }
            </div>
        </div>
    );
}

// ============================================================
// Styles
// ============================================================

const sh: Record<string, React.CSSProperties> = {
    root: {
        display:       'flex',
        flexDirection: 'column',
        height:        '100vh',
        background:    C.bg,
        fontFamily:    C.font,
        color:         C.text,
        overflow:      'hidden',
    },
    header: {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '12px 20px',
        borderBottom:   `1px solid ${C.border}`,
        background:     'rgba(0,0,0,0.2)',
        flexShrink:     0,
    },
    backBtn: {
        padding:      '7px 14px',
        background:   'rgba(255,255,255,0.04)',
        border:       `1px solid ${C.borderStrong}`,
        borderRadius: 8,
        color:        C.textDim,
        fontSize:     13,
        cursor:       'pointer',
        width:        100,
    },
    clearBtn: {
        padding:      '7px 14px',
        background:   'rgba(239,83,80,0.06)',
        border:       '1px solid rgba(239,83,80,0.3)',
        borderRadius: 8,
        color:        C.danger,
        fontSize:     13,
        cursor:       'pointer',
        width:        100,
    },
    tabBar: {
        display:     'flex',
        gap:         4,
        padding:     '8px 20px',
        borderBottom:`1px solid ${C.border}`,
        background:  'rgba(0,0,0,0.1)',
        flexShrink:  0,
    },
    tabBtn: {
        padding:      '6px 18px',
        borderRadius: 6,
        border:       'none',
        background:   'transparent',
        color:        C.textDim,
        fontSize:     13,
        cursor:       'pointer',
        fontFamily:   C.font,
        transition:   'background 0.12s, color 0.12s',
    },
    tabActive: {
        background: 'rgba(79,195,247,0.12)',
        color:      C.accent,
    },
    body: {
        flex:    1,
        padding: 16,
        overflow:'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    panel: {
        background:    C.panel,
        border:        `1px solid ${C.border}`,
        borderRadius:  10,
        padding:       '12px 16px',
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
    },
    panelTitle: {
        fontSize:      11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color:         C.textMuted,
    },
    card: {
        background:    C.panel,
        border:        `1px solid ${C.border}`,
        borderRadius:  10,
        padding:       '14px 18px',
        display:       'flex',
        flexDirection: 'column',
        gap:           5,
    },
    cardLabel: {
        fontSize:      11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color:         C.textMuted,
    },
    cardValue: {
        fontSize:   26,
        fontWeight: 700,
        fontFamily: C.mono,
        lineHeight: 1,
    },
    cardSub: { fontSize: 11, color: C.textMuted },
    table: {
        width:          '100%',
        borderCollapse: 'collapse',
        fontSize:       13,
        fontFamily:     C.mono,
    },
    th: {
        padding:       '8px 14px',
        fontSize:      10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color:         C.textMuted,
        borderBottom:  `1px solid ${C.border}`,
        textAlign:     'left',
        whiteSpace:    'nowrap',
    },
    td: {
        padding:      '9px 14px',
        borderBottom: `1px solid ${C.border}`,
    },
    tr: { transition: 'background 0.1s' },
    ctrlBtn: {
        padding:      '6px 12px',
        borderRadius: 6,
        border:       `1px solid ${C.borderStrong}`,
        background:   C.panel,
        color:        C.text,
        fontSize:     12,
        cursor:       'pointer',
        fontFamily:   C.mono,
    },
    accentBtn: {
        marginTop:    8,
        padding:      '10px 24px',
        background:   'rgba(79,195,247,0.08)',
        border:       `1px solid ${C.accent}`,
        borderRadius: 8,
        color:        C.accent,
        fontSize:     14,
        cursor:       'pointer',
        fontFamily:   C.font,
    },
    tip: {
        background:   'rgba(11,20,26,0.97)',
        border:       `1px solid ${C.borderStrong}`,
        borderRadius: 8,
        padding:      '8px 12px',
        fontFamily:   C.font,
    },
    tipLabel: { fontSize: 11, color: C.textMuted, marginBottom: 3 },
    empty: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        flex:           1,
        gap:            14,
    },
};
