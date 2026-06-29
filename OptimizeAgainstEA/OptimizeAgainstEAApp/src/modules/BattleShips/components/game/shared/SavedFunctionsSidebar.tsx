import { useState } from 'react';
import { copyCode } from '../../../engine/codeClipboard';
import {
  FUNCTION_CATEGORIES,
  functionsInCategory,
  randomFunctionSpec,
  randomSurfaceSpec,
  encodeFunctionCode,
  type FunctionCategory,
} from '../../../engine/functionProblem';

const CATEGORY_LABEL: Record<FunctionCategory, string> = {
  simple: 'Simple',
  normal: 'Normal',
  complex: 'Complex',
  quirky: 'Quirky',
};

/**
 * A left-edge drawer listing the analytic benchmark functions the player can
 * optimize, grouped by difficulty. Mirrors SavedMapsSidebar and reuses its
 * `saved-maps-*` drawer styling.
 *
 * Copying a specific function produces a *fresh* random surface: a new random
 * affine transform each time, encoded as a shareable code on the clipboard. The
 * "Random every time" button instead copies a sentinel code that re-randomises
 * the whole surface (function + transform) on every load — so even the same code
 * never plays out the same way twice.
 */
export function SavedFunctionsSidebar() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const flash = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied((cur) => (cur === key ? null : cur)), 1500);
  };

  const copyRandom = () => {
    void copyCode(encodeFunctionCode(randomFunctionSpec()));
    flash('__random');
  };

  // Sentinel code: re-randomises the whole surface on every load.
  const copyRandomEveryTime = () => {
    void copyCode(encodeFunctionCode(randomSurfaceSpec()));
    flash('__randomEvery');
  };

  const copyFunction = (id: string) => {
    void copyCode(encodeFunctionCode(randomFunctionSpec(Math.random, { id })));
    flash(id);
  };

  return (
    <>
      <button
        className="saved-maps-toggle"
        onClick={() => setOpen(true)}
        title="Show math functions"
      >
        ƒ(x) Functions
      </button>

      {open && (
        <div
          className="saved-maps-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <aside className="saved-maps-panel" onClick={(e) => e.stopPropagation()}>
            <div className="saved-maps-panel__header">
              <span className="saved-maps-panel__title">Functions</span>
              <button
                className="saved-maps-panel__close"
                onClick={() => setOpen(false)}
                aria-label="Hide functions"
              >
                ✕
              </button>
            </div>

            <div className="saved-maps-panel__body">
              <button
                className="btn btn--outline btn--block"
                onClick={copyRandomEveryTime}
                title="Copy a code that picks a brand-new random surface on every load"
              >
                {copied === '__randomEvery' ? '✓ Code copied' : '🎲 Random every time'}
              </button>

              <button
                className="btn btn--outline btn--block"
                onClick={copyRandom}
                title="Copy a code for one fixed random surface (same every replay)"
              >
                {copied === '__random' ? '✓ Code copied' : '🎲 Random (fixed)'}
              </button>

              {FUNCTION_CATEGORIES.map((cat) => (
                <div key={cat} className="fn-group">
                  <span className="eyebrow">{CATEGORY_LABEL[cat]}</span>
                  <ul className="saved-maps__list">
                    {functionsInCategory(cat).map((fn) => (
                      <li key={fn.id} className="saved-maps__item">
                        <button
                          className="saved-maps__use"
                          onClick={() => copyFunction(fn.id)}
                          title={`Copy a random ${fn.label} surface`}
                        >
                          <span className="saved-maps__id">{fn.label}</span>
                          <span className="saved-maps__meta">
                            {copied === fn.id ? '✓ Code copied' : 'Click to copy a code'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
