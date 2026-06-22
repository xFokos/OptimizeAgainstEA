import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameStore } from '../../modules/shooterGame/game/gameStore';
import type { GameState } from '../../modules/shooterGame/shooter.types';

// ---- Icon Button ----
interface IconButtonProps {
    icon:    string;
    label:   string;
    onClick: () => void;
    color?:  string;
}

function IconButton({ icon, label, onClick, color = 'rgba(255,255,255,0.5)' }: IconButtonProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <div style={styles.iconWrapper}>
            {/* Tooltip */}
            {hovered && (
                <div style={styles.tooltip}>
                    {label}
                </div>
            )}
            <button
                style={{
                    ...styles.iconBtn,
                    color,
                    background: hovered ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
                onClick={onClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {icon}
            </button>
        </div>
    );
}

// ---- Live Stats ----
function StatRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={statStyles.row}>
            <span style={statStyles.label}>{label}</span>
            <span style={statStyles.value}>{value}</span>
        </div>
    );
}

function LiveStats() {
    const [state, setState] = useState<GameState | null>(() => gameStore.state ?? null);

    useEffect(() => {
        return gameStore.subscribe(() => setState(gameStore.state));
    }, []);

    if (!state || state.phase === 'idle') return null;

    const s     = state.agent.stats;
    const timer = Math.ceil(Math.max(0, state.roundTimer));

    return (
        <div style={statStyles.section}>
            <div style={statStyles.sectionTitle}>Stats</div>
            <div style={statStyles.roundLabel}>Runde {state.roundNumber}</div>
            <StatRow label="Zeit" value={`${timer}s`} />
            <div style={statStyles.divider} />
            <StatRow label="Treffer" value={String(s.hitsReceived)} />
            <StatRow label="Kassiert" value={String(s.hitsLanded)} />
            <StatRow label="Ausgewichen" value={String(s.dodgedBullets)} />
            {state.population && (
                <>
                    <div style={statStyles.divider} />
                    <StatRow label="Generation" value={String(state.population.generation)} />
                </>
            )}
        </div>
    );
}

const statStyles: Record<string, React.CSSProperties> = {
    section: {
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        width:         '100%',
        padding:       '0 16px',
        boxSizing:     'border-box',
        fontFamily:    'var(--font)',
    },
    sectionTitle: {
        fontSize:      11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color:         'var(--text-muted)',
        marginBottom:  4,
    },
    roundLabel: {
        fontSize:      18,
        fontWeight:    600,
        color:         'var(--text)',
        textAlign:     'center',
    },
    row: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
    },
    label: {
        fontSize: 13,
        color:    'var(--text-dim)',
    },
    value: {
        fontSize:   16,
        fontWeight: 600,
        color:      'var(--text)',
    },
    divider: {
        height:     1,
        background: 'var(--border)',
        margin:     '2px 0',
    },
};

// ---- Shooter Left Bar ----
interface ShooterLeftBarProps {
    onAnalytics?: () => void;
}

export function ShooterLeftBar({ onAnalytics }: ShooterLeftBarProps) {
    const navigate = useNavigate();

    return (
        <>
            {/* Top – Navigation */}
            <div style={styles.group}>
                <IconButton
                    icon="⬅"
                    label="Zurück zur Lobby"
                    onClick={() => navigate('/lobby/shooter')}
                />
                {onAnalytics && (
                    <IconButton
                        icon="📊"
                        label="Analytics"
                        onClick={onAnalytics}
                    />
                )}
            </div>

            {/* Middle – Live Stats */}
            <LiveStats />

            {/* Bottom – Quit */}
            <div style={styles.group}>
                <IconButton
                    icon="✕"
                    label="Spiel beenden"
                    color="rgba(239, 83, 80, 0.6)"
                    onClick={() => navigate('/Dashboard')}
                />
            </div>
        </>
    );
}

const styles: Record<string, React.CSSProperties> = {
    group: {
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           8,
    },
    iconWrapper: {
        position: 'relative',
        display:  'flex',
        alignItems: 'center',
    },
    iconBtn: {
        width:          44,
        height:         44,
        border:         'none',
        borderRadius:   'var(--r-md)',
        cursor:         'pointer',
        fontSize:       18,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        transition:     'background 0.15s, color 0.15s',
        fontFamily:     'var(--font)',
    },
    tooltip: {
        position:      'absolute',
        left:          52,
        background:    'rgba(11, 20, 26, 0.97)',
        border:        '1px solid var(--border-strong)',
        borderRadius:  'var(--r-md)',
        padding:       '8px 12px',
        fontSize:      13,
        color:         'var(--text)',
        whiteSpace:    'nowrap',
        fontFamily:    'var(--font)',
        pointerEvents: 'none',
        zIndex:        100,
    },
};
