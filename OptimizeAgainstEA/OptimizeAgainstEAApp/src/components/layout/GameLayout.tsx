import type { CSSProperties, ReactNode, RefObject } from 'react';

// ---- Design Tokens ----
export const LAYOUT = {
    SPACING:      16,
    LEFT_BAR:     240,  // Referenzwert – tatsächliche Breite via clamp() im Grid
    RIGHT_PANEL:  220,  // Referenzwert – tatsächliche Breite via clamp() im Grid
    BORDER_COLOR: 'rgba(255, 255, 255, 0.06)',
    BG_PANEL:     'rgba(0, 0, 0, 0.25)',
} as const;

// ---- Types ----
interface GameLayoutProps {
    children:   ReactNode;
    leftBar?:   ReactNode;
    sidebar?:   ReactNode;
    canvasRef?: RefObject<HTMLDivElement>;  // wird direkt an das Canvas-Area-Div gehängt
}

// ---- Component ----
export function GameLayout({ children, leftBar, sidebar, canvasRef }: GameLayoutProps) {
    return (
        <div style={styles.root}>

            {/* Linke Icon-Bar */}
            <div style={styles.leftBar}>
                {leftBar}
            </div>

            {/* Canvas Bereich – zentriert */}
            <div style={styles.canvasArea} ref={canvasRef}>
                {children}
            </div>

            {/* Rechtes Stats Panel */}
            {sidebar && (
                <div style={styles.sidebar}>
                    {sidebar}
                </div>
            )}

        </div>
    );
}

const styles: Record<string, CSSProperties> = {
    root: {
        display:             'grid',
        gridTemplateColumns: 'var(--col-nav) 1fr var(--col-panel)',
        width:               '100%',
        height:              '100%',
        overflow:            'hidden',
    },
    leftBar: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        `${LAYOUT.SPACING}px 0`,
        borderRight:    `1px solid ${LAYOUT.BORDER_COLOR}`,
        background:     LAYOUT.BG_PANEL,
        overflow:       'hidden',
    },
    canvasArea: {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        LAYOUT.SPACING,
        minWidth:       0,
        overflow:       'hidden',
    },
    sidebar: {
        borderLeft:  `1px solid ${LAYOUT.BORDER_COLOR}`,
        background:  LAYOUT.BG_PANEL,
        overflowY:   'auto',
        padding:     LAYOUT.SPACING,
    },
};
