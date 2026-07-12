import { useState } from 'react';
import type { ReactNode } from 'react';
import type { HintAction } from '../hints';
import compiImg from '../../assets/CompiDerpy.webp';
import './explainer.css';

export interface ExplainerStep {
    id:      string;
    title:   string;
    body:    string;
    /** Optional illustration for this step — the visual is the star of the
     * layout (see ./eaConceptVisuals.tsx for the EA-concept ones). */
    visual?: ReactNode;
    /** Extra panel shown beside the step's text (instead of stacked above
     * it) — for a live demo that should sit alongside the explanation, not
     * compete with `visual` for the same spot. Falls back to stacking below
     * on narrow screens. */
    sideVisual?: ReactNode;
}

interface ExplainerFlowProps {
    steps: ExplainerStep[];
    /** Called when the player clicks the action on the last step. Omit for a
     * flow that has nowhere further to go (the button just won't render). */
    onFinish?:     () => void;
    /** Button label on the last step. Default 'Got it'. */
    finishLabel?:  string;
    /** Show clickable progress dots that jump straight to a step, instead of
     * only allowing linear Back/Next. Default true — most explainers benefit
     * from letting the reader jump back to re-read something. */
    allowJump?:    boolean;
    /** Smaller mascot, tucked back into a corner instead of the large
     * top-left companion — for hosts with much less room than the Dashboard
     * (e.g. an 800px-wide game canvas overlay). Default false. */
    compact?:      boolean;
}

/**
 * Shared step-by-step explainer, "cinematic" layout: each step's visual is
 * the large, centered focal point; Compi's narration sits below it as a
 * slim caption bar (not a floating speech bubble) so nothing competes with
 * the visual for attention. Always in normal document flow — never
 * overlaps whatever else is on screen. Used for the Dashboard's "EA
 * Explained" tab and reused inside in-game tutorials.
 */
export function ExplainerFlow({ steps, onFinish, finishLabel = 'Got it', allowJump = true, compact = false }: ExplainerFlowProps) {
    const [index, setIndex]         = useState(0);
    const [direction, setDirection] = useState<'forward' | 'back'>('forward');

    const step   = steps[index];
    const isLast = index === steps.length - 1;

    const goTo = (next: number) => {
        if (next < 0 || next >= steps.length || next === index) return;
        setDirection(next > index ? 'forward' : 'back');
        setIndex(next);
    };

    const actions: HintAction[] = [
        ...(index > 0 ? [{ label: '← Back', onClick: () => goTo(index - 1), variant: 'ghost' as const }] : []),
        ...(isLast
            ? (onFinish ? [{ label: finishLabel, onClick: onFinish, variant: 'primary' as const }] : [])
            : [{ label: 'Next →', onClick: () => goTo(index + 1), variant: 'primary' as const }]),
    ];

    return (
        <div className={`explainer${compact ? ' explainer--compact' : ''}`}>
            {/* Anchored left of the whole tutorial area — a persistent
             * companion rather than something tied to a single caption row. */}
            <img className="explainer__mascot" src={compiImg} alt="Compi the PC mascot" />

            <div className="explainer__body">
                <div className="explainer__progress">
                    {steps.map((s, i) => (
                        <button
                            key={s.id}
                            type="button"
                            className={`explainer__dot${i === index ? ' explainer__dot--active' : ''}${i < index ? ' explainer__dot--done' : ''}`}
                            onClick={() => allowJump && goTo(i)}
                            disabled={!allowJump}
                            aria-label={`Step ${i + 1} of ${steps.length}: ${s.title}`}
                            aria-current={i === index}
                        />
                    ))}
                </div>

                {/* Re-mounted per step (key) so the enter animation replays on every transition */}
                <div key={step.id} className={`explainer__stage explainer__stage--${direction}${step.sideVisual ? ' explainer__stage--split' : ''}`}>
                    <div className="explainer__main">
                        {step.visual && <div className="explainer__visual">{step.visual}</div>}

                        <div className="explainer__caption">
                            <div className="explainer__captionTitle">{step.title}</div>
                            <p className="explainer__captionBody">{step.body}</p>
                            {actions.length > 0 && (
                                <div className="explainer__captionActions">
                                    {actions.map((a, i) => (
                                        <button
                                            key={i}
                                            className={`btn btn--sm ${a.variant === 'primary' ? 'btn--primary' : 'btn--ghost'}`}
                                            onClick={a.onClick}
                                        >
                                            {a.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Slides in with a slight extra delay after the main
                     * column, so it reads as "content settles, then the live
                     * demo appears" instead of everything arriving at once. */}
                    {step.sideVisual && <div className="explainer__side">{step.sideVisual}</div>}
                </div>
            </div>
        </div>
    );
}
