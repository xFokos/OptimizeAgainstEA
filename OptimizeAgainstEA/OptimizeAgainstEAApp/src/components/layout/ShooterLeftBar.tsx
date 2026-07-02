import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameStore } from '../../modules/shooterGame/game/gameStore';
import type { GameState } from '../../modules/shooterGame/shooter.types';

// ---- Nav Button ----
const VARIANTS = {
    neutral: { color: 'rgba(255,255,255,0.6)',  border: 'rgba(255,255,255,0.18)', bg: 'rgba(255,255,255,0.04)', bgHover: 'rgba(255,255,255,0.08)' },
    blue:    { color: '#4fc3f7',                border: 'rgba(79,195,247,0.4)',   bg: 'rgba(79,195,247,0.06)',  bgHover: 'rgba(79,195,247,0.12)'  },
    red:     { color: '#ef5350',                border: 'rgba(239,83,80,0.4)',    bg: 'rgba(239,83,80,0.06)',   bgHover: 'rgba(239,83,80,0.12)'   },
} as const;

interface NavButtonProps {
    label:    string;
    onClick:  () => void;
    variant?: keyof typeof VARIANTS;
}

function NavButton({ label, onClick, variant = 'neutral' }: NavButtonProps) {
    const [hovered, setHovered] = useState(false);
    const v = VARIANTS[variant];

    return (
        <button
            style={{
                ...styles.navBtn,
                color:      v.color,
                border:     `1px solid ${v.border}`,
                background: hovered ? v.bgHover : v.bg,
            }}
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {label}
        </button>
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
            <div style={statStyles.roundLabel}>Round {state.roundNumber}</div>
            <StatRow label="Time" value={`${timer}s`} />
            <div style={statStyles.divider} />
            <StatRow label="Hits" value={String(s.hitsReceived)} />
            <StatRow label="Taken" value={String(s.hitsLanded)} />
            <StatRow label="Dodged" value={String(s.dodgedBullets)} />
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
    onLobby?:     () => void | Promise<void>;
}

export function ShooterLeftBar({ onAnalytics, onLobby }: ShooterLeftBarProps) {
    const navigate = useNavigate();

    return (
        <>
            {/* Top – Navigation */}
            <div style={styles.group}>
                <NavButton
                    label="← Lobby"
                    onClick={onLobby ?? (() => navigate('/lobby/shooter'))}
                />
                {onAnalytics && (
                    <NavButton
                        label="Analytics"
                        variant="blue"
                        onClick={onAnalytics}
                    />
                )}
            </div>

            {/* Middle – Live Stats */}
            <LiveStats />

            {/* Bottom – Quit */}
            <div style={styles.group}>
                <NavButton
                    label="Quit"
                    variant="red"
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
        alignItems:    'stretch',
        gap:           8,
        width:         '100%',
        padding:       '0 16px',
        boxSizing:     'border-box',
    },
    navBtn: {
        padding:       '10px 16px',
        borderRadius:  '8px',
        cursor:        'pointer',
        fontSize:      13,
        fontFamily:    'var(--font)',
        fontWeight:    500,
        letterSpacing: '0.04em',
        textAlign:     'center',
        transition:    'background 0.15s',
        width:         '100%',
    },
};
