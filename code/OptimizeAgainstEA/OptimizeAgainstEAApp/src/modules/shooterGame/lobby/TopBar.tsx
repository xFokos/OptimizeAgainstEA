import { HintToggle } from '../../../components/hints';

// ---- Top Bar (lobby modes only) ----

export function TopBar({ onBack }: { onBack: () => void }) {
    return (
        <div style={topBarStyles.bar}>
            <div style={topBarStyles.side}>
                <button className="btn btn--ghost btn--sm" onClick={onBack}>
                    ← Mode
                </button>
            </div>

            <div style={topBarStyles.center} />

            <div style={{ ...topBarStyles.side, justifyContent: 'flex-end' }}>
                <HintToggle />
            </div>
        </div>
    );
}

const topBarStyles: Record<string, React.CSSProperties> = {
    bar: {
        width:          '100%',
        height:         56,
        flexShrink:     0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 16px',
        boxSizing:      'border-box',
        background:     'rgba(0,0,0,0.35)',
        borderBottom:   '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
    },
    side: {
        display:    'flex',
        alignItems: 'center',
        minWidth:   120,
    },
    center: {
        display:    'flex',
        alignItems: 'center',
        gap:        10,
    },
    logoMark: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.06em',
        color:         '#4fc3f7',
        background:    'rgba(79,195,247,0.12)',
        border:        '1px solid rgba(79,195,247,0.22)',
        borderRadius:  6,
        padding:       '2px 7px',
    },
    centerTitle: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      13,
        fontWeight:    600,
        letterSpacing: '0.08em',
        color:         'rgba(255,255,255,0.55)',
        textTransform: 'uppercase',
    },
};
