import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
        width:        40,
        height:       40,
        border:       'none',
        borderRadius: 8,
        cursor:       'pointer',
        fontSize:     16,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        transition:   'background 0.15s, color 0.15s',
        fontFamily:   'monospace',
    },
    tooltip: {
        position:     'absolute',
        left:         48,
        background:   'rgba(15, 15, 26, 0.95)',
        border:       '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        padding:      '6px 10px',
        fontSize:     12,
        color:        'rgba(255,255,255,0.8)',
        whiteSpace:   'nowrap',
        fontFamily:   'monospace',
        pointerEvents: 'none',
        zIndex:       100,
    },
};
