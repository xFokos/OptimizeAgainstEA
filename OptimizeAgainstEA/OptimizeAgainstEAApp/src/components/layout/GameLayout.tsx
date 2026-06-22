import type { ReactNode } from 'react';

// ---- Design Tokens ----
export const LAYOUT = {
    SPACING:      16,   // Basis-Spacing
    LEFT_BAR:     240,   // Breite der linken Icon-Bar
    RIGHT_PANEL:  160,  // Breite des rechten Panels
    BORDER_COLOR: 'rgba(255, 255, 255, 0.06)',
    BG_PANEL:     'rgba(0, 0, 0, 0.25)',
} as const;

// ---- Types ----
interface GameLayoutProps {
    children:   ReactNode;  // Canvas
    leftBar?:   ReactNode;  // Icon-Buttons links
    sidebar?:   ReactNode;  // Stats/DNA rechts
}

// ---- Component ----
export function GameLayout({ children, leftBar, sidebar }: GameLayoutProps) {
    return (
        <div style={styles.root}>

            {/* Linke Icon-Bar */}
            <div style={styles.leftBar}>
                {leftBar}
            </div>

            {/* Canvas Bereich – zentriert */}
            <div style={styles.canvasArea}>
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

const styles: Record<string, React.CSSProperties> = {
    root: {
        display:   'flex',
        width:     '100%',
        height:    '100%',
        gap:       0,
        overflow:  'hidden',
    },
    leftBar: {
        width:          LAYOUT.LEFT_BAR,
        flexShrink:     0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        `${LAYOUT.SPACING}px 0`,
        borderRight:    `1px solid ${LAYOUT.BORDER_COLOR}`,
        background:     LAYOUT.BG_PANEL,
        boxSizing:      'border-box',
    },
    canvasArea: {
        flex:           1,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        LAYOUT.SPACING,
        minWidth:       0,
        boxSizing:      'border-box',
    },
    sidebar: {
        width:       LAYOUT.RIGHT_PANEL,
        flexShrink:  0,
        borderLeft:  `1px solid ${LAYOUT.BORDER_COLOR}`,
        background:  LAYOUT.BG_PANEL,
        overflowY:   'auto',
        boxSizing:   'border-box',
        padding:     LAYOUT.SPACING,
    },
};
