import type { ReactNode } from 'react';

export interface GameMode {
    id:    string;
    key:   string;
    label: string;
    sub:   string;
}

interface GameModeSelectorLayoutProps {
    /** Short all-caps title shown large in the center, e.g. "SHOOTER VS EA" */
    title:        string;
    /** Optional subtitle below the title */
    subtitle?:    string;
    /** Two-letter abbreviation shown in the topbar logo chip, e.g. "SG" */
    logoText:     string;
    /** Mode tiles to render in the grid */
    modes:        GameMode[];
    /** Called when a tile is clicked */
    onSelect:     (id: string) => void;
    /** Back button action (topbar left) */
    onBack:       () => void;
    /** Back button label — defaults to "← Zurück" */
    backLabel?:   string;
    /** Optional content for the topbar right side, e.g. <HintToggle /> */
    rightContent?: ReactNode;
}

/**
 * Reusable full-page game mode selector shell.
 * Matches the PeakFinder visual style: animated gradient bg, fixed topbar,
 * large centered title, two-column card grid.
 *
 * Usage:
 *   <GameModeSelectorLayout
 *     title="SHOOTER VS EA"
 *     logoText="SG"
 *     modes={[{ id: 'solo', key: 'S', label: 'Solo Play', sub: '...' }, ...]}
 *     onSelect={handleSelect}
 *     onBack={() => navigate('/dashboard')}
 *   />
 */
export function GameModeSelectorLayout({
    title,
    subtitle,
    logoText: _logoText,
    modes,
    onSelect,
    onBack,
    backLabel = '← Back',
    rightContent,
}: GameModeSelectorLayoutProps) {
    return (
        <div className="game-selector-shell">

            {/* ── Top bar ── */}
            <header className="game-selector-topbar">
                <div className="game-selector-topbar__left">
                    <button className="btn btn--ghost btn--sm" onClick={onBack}>
                        {backLabel}
                    </button>
                </div>

                <div className="game-selector-topbar__center" />

                <div className="game-selector-topbar__right">
                    {rightContent}
                </div>
            </header>

            {/* ── Centered content ── */}
            <main className="game-selector-content">
                <div className="game-mode-selector">

                    <div className="game-mode-selector__header">
                        <h1 className="game-mode-selector__title">{title}</h1>
                        {subtitle && (
                            <p className="game-mode-selector__subtitle">{subtitle}</p>
                        )}
                    </div>

                    <div className="game-mode-selector__grid">
                        {modes.map(mode => (
                            <button
                                key={mode.id}
                                className="panel panel--surface panel--md panel--interactive game-mode-card"
                                onClick={() => onSelect(mode.id)}
                            >
                                <span className="game-mode-card__key">{mode.key}</span>
                                <span className="game-mode-card__label">{mode.label}</span>
                                <span className="game-mode-card__sub">{mode.sub}</span>
                            </button>
                        ))}
                    </div>

                </div>
            </main>

        </div>
    );
}
