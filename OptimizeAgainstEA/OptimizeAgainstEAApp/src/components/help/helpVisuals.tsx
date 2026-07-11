// Small, self-contained visual widgets for Help modal content — styled with
// the site's real tokens (colors, fonts, bar/pill shapes) so they read as
// "part of the website" rather than illustrations bolted on top of it.
// Deliberately simple/static (no canvas, no animation) rather than reusing
// the lobby's live preview canvases — much lower risk to build and just as
// legible for a "here's the shape of the concept" explanation.

import type { ReactNode } from 'react';

// ── Layout: visual on one side, short heading + 1-2 sentence caption on the other ──

export function HelpConceptCard({ heading, visual, children }: {
    heading:  string;
    visual?:  ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="help-card">
            {visual && <div className="help-card__visual">{visual}</div>}
            <div className="help-card__text">
                <h3 className="help-card__heading">{heading}</h3>
                <p className="help-card__body">{children}</p>
            </div>
        </div>
    );
}

// ── DNA gene bars — same visual language as DnaGeneRow in the lobby ──

export function HelpDnaBars({ genes }: {
    genes: { label: string; value: number; delta?: number }[];
}) {
    return (
        <div className="help-dna">
            {genes.map(g => (
                <div key={g.label} className="help-dna__row">
                    <div className="help-dna__head">
                        <span className="help-dna__label">{g.label}</span>
                        <span className="help-dna__value">
                            {g.value.toFixed(2)}
                            {g.delta !== undefined && Math.abs(g.delta) >= 0.005 && (
                                <span className={`help-dna__delta ${g.delta > 0 ? 'help-dna__delta--up' : 'help-dna__delta--down'}`}>
                                    {g.delta > 0 ? '+' : ''}{g.delta.toFixed(2)}
                                </span>
                            )}
                        </span>
                    </div>
                    <div className="help-dna__track">
                        <div className="help-dna__fill" style={{ width: `${g.value * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── Difficulty-style preset pills — same colors as the real presets ──

export function HelpPresetRow({ presets, activeId }: {
    presets:   { id: string; label: string; color: string }[];
    activeId?: string;
}) {
    return (
        <div className="help-presets">
            {presets.map(p => (
                <span
                    key={p.id}
                    className="help-presets__pill"
                    style={p.id === activeId
                        ? { borderColor: p.color, color: p.color, background: `${p.color}18` }
                        : undefined}
                >
                    {p.label}
                </span>
            ))}
        </div>
    );
}

// ── Population dots — evolving gene pool. `elite` of the `count` dots are
// highlighted as survivors; the rest represent the rest of the population. ──

export function HelpPopulationDots({ count = 16, elite = 3 }: { count?: number; elite?: number }) {
    return (
        <div className="help-pop">
            {Array.from({ length: count }, (_, i) => (
                <span key={i} className={i < elite ? 'help-pop__dot help-pop__dot--elite' : 'help-pop__dot'} />
            ))}
        </div>
    );
}

// ── Evaluation-progress dots — same idea as the Raidboss lobby's progress row ──

export function HelpProgressDots({ total = 12, done = 7 }: { total?: number; done?: number }) {
    return (
        <div className="help-pop">
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    className={
                        i < done             ? 'help-pop__dot help-pop__dot--rb-done' :
                        i === done           ? 'help-pop__dot help-pop__dot--rb-next' :
                                                'help-pop__dot'
                    }
                />
            ))}
        </div>
    );
}

// ── Tiny static map diagram — obstacles + spawn-edge glow, no canvas needed ──

export function HelpMapDiagram({ obstacles, spawnSides }: {
    obstacles:  { x: number; y: number; w: number; h: number; blocksBullets: boolean }[];
    spawnSides: ('top' | 'right' | 'bottom' | 'left')[];
}) {
    return (
        <div className="help-map">
            {spawnSides.map(side => <span key={side} className={`help-map__glow help-map__glow--${side}`} />)}
            {obstacles.map((o, i) => (
                <span
                    key={i}
                    className={o.blocksBullets ? 'help-map__obstacle help-map__obstacle--solid' : 'help-map__obstacle help-map__obstacle--dashed'}
                    style={{ left: `${o.x}%`, top: `${o.y}%`, width: `${o.w}%`, height: `${o.h}%` }}
                />
            ))}
            <span className="help-map__player" />
        </div>
    );
}

// ── Mod / powerup icon row ──

export function HelpModRow({ mods }: { mods: { icon: string; name: string }[] }) {
    return (
        <div className="help-mods">
            {mods.map(m => (
                <span key={m.name} className="help-mods__slot">
                    <span className="help-mods__icon">{m.icon}</span>
                    <span className="help-mods__name">{m.name}</span>
                </span>
            ))}
        </div>
    );
}
