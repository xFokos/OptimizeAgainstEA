// ─────────────────────────────────────────────────────────────────────────
//  HINT CONTENT — single source of truth
//
//  This is the ONLY file you need to touch to edit, add, or remove hint text.
//  Each entry maps a HintId to its wording and how it should be presented.
//
//    style   'modal' = blocking pop-up (freezes the game until dismissed)
//            'toast' = small non-blocking popup in the corner, auto-dismisses
//    once    show only the first time it is triggered this session (see below)
//    pauses  (modal only) clicking the backdrop will NOT close it — the player
//            must use a button. Use for hints that interrupt play on purpose.
//
//  Dynamic values: put {placeholders} in `body` and pass `vars` at the call
//  site, e.g. showHint('vsEa.afterProbe', { vars: { gens: '3' } }).
//
//  "once" hints are remembered in sessionStorage, so they reappear in a new
//  browser session or after the player hits the "Reset hints" button.
// ─────────────────────────────────────────────────────────────────────────

export type HintId =
  | 'selector.welcome'
  | 'vsEa.replayButton';

export interface HintDef {
  title?: string;
  body: string;
  style: 'modal' | 'toast';
  once?: boolean;
  pauses?: boolean;
}

export const HINTS: Record<HintId, HintDef> = {
  'selector.welcome': {
    title: 'Welcome to Battleships',
    body:
      'Like the board game — but for optimization. Pick a mode below: ' +
      'Create your own map, Play to hunt the hidden global minimum, or race ' +
      'an evolutionary algorithm in Vs EA. New here? Leave these hints on; ' +
      'you can toggle them anytime with the button in the top-right corner.',
    style: 'modal',
    once: true,
  },

  // Anchored coachmark — rendered next to the replay button via <HintPopover>.
  // (style/pauses are ignored for popovers; only title/body/once apply.)
  'vsEa.replayButton': {
    title: 'See what the EA did',
    body:
      'After each move you make, the algorithm breeds a new generation. ' +
      'Click here to replay its last step move-by-move.',
    style: 'toast',
    once: true,
  },
};
