import type { CSSProperties, ReactNode, RefObject } from 'react';
import styles from './GameLayout.module.css';

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
    children:    ReactNode;
    leftBar?:    ReactNode;
    sidebar?:    ReactNode;
    canvasRef?:  RefObject<HTMLDivElement | null>;  // wird direkt an das Canvas-Area-Div gehängt
    touchLayout?: boolean;  // true → Seitenpanels ohne Padding (für Touch-Zonen)
}

// ---- Component ----
export function GameLayout({ children, leftBar, sidebar, canvasRef, touchLayout }: GameLayoutProps) {
    const leftStyle  = touchLayout ? { ...panelStyles.leftBar,  padding: 0 } : panelStyles.leftBar;
    const rightStyle = touchLayout ? { ...panelStyles.sidebar,  padding: 0 } : panelStyles.sidebar;

    return (
        <div className={`${styles.root}${touchLayout ? ` ${styles.touchLayout}` : ''}`}>

            {/* Linke Icon-Bar */}
            <div className={styles.leftBar} style={leftStyle}>
                {leftBar}
            </div>

            {/* Canvas Bereich – zentriert */}
            <div style={panelStyles.canvasArea} ref={canvasRef}>
                {children}
            </div>

            {/* Rechtes Stats Panel */}
            {sidebar && (
                <div className={styles.sidebar} style={rightStyle}>
                    {sidebar}
                </div>
            )}

        </div>
    );
}

const panelStyles: Record<string, CSSProperties> = {
    leftBar: {
        padding:     `${LAYOUT.SPACING}px 0`,
        borderRight: `1px solid ${LAYOUT.BORDER_COLOR}`,
        background:  LAYOUT.BG_PANEL,
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
        borderLeft: `1px solid ${LAYOUT.BORDER_COLOR}`,
        background: LAYOUT.BG_PANEL,
        padding:    LAYOUT.SPACING,
    },
};
