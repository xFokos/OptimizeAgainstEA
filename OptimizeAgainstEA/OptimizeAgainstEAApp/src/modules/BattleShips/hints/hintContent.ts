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
//    sticky  (toast only) do NOT auto-dismiss — the toast stays until the
//            player clicks its × close button.
//
//  Dynamic values: put {placeholders} in `body` and pass `vars` at the call
//  site, e.g. showHint('vsEa.afterProbe', { vars: { gens: '3' } }).
//
//  "once" hints are remembered in sessionStorage, so they reappear in a new
//  browser session or after the player hits the "Reset hints" button.
// ─────────────────────────────────────────────────────────────────────────

export type HintId =
  | 'selector.welcome'
  | 'create.place'
  | 'create.tune'
  | 'create.pickGlobal'
  | 'create.done'
  | 'play.start'
  | 'play.firstProbe'
  | 'vsEa.settingsButton'
  | 'vsEa.settingsPanel'
  | 'vsEa.replayButton';

export interface HintDef {
  title?: string;
  body: string;
  style: 'modal' | 'toast';
  once?: boolean;
  pauses?: boolean;
  sticky?: boolean;
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

  // ── Create mode: one per phase, fired once on first entry this session ────
  'create.place': {
    title: 'Step 1 — Place Minima',
    body:
      'Click empty map space to drop a local minimum; click a dot to remove ' +
      'it. Scatter a few decoys away from where you\'ll hide the real one — ' +
      'the more tempting the traps, the harder the map. You need at least two.',
    style: 'toast',
    once: true,
    sticky: true,
  },

  'create.tune': {
    title: 'Step 2 — Tune Depths',
    body:
      'A minimum\'s depth is the value a probe reads at its center. Make a ' +
      'decoy almost as deep as the global and it becomes a convincing trap. ' +
      'Any dot you leave alone keeps a random depth.',
    style: 'toast',
    once: true,
    sticky: true,
  },

  'create.pickGlobal': {
    title: 'Step 3 — Pick the Global Minimum',
    body:
      'Click the dot that wins the game — the true lowest point players must ' +
      'find. Tucking it behind a cluster of deep decoys makes for a sneaky map.',
    style: 'toast',
    once: true,
    sticky: true,
  },

  'create.done': {
    title: 'Your map is ready',
    body:
      'Copy the code to share your map, or jump straight into Play or Vs EA ' +
      'to try it yourself. Hit "Create Another" to build a new one.',
    style: 'toast',
    once: true,
    sticky: true,
  },

  // ── Play mode: blocking modals (pauses = dismiss only via the button) ─────
  'play.start': {
    title: 'Hunt the global minimum',
    body:
      'Somewhere on this map is a hidden global minimum. Click anywhere to ' +
      'drop a probe — it reveals the surface around that spot and reads a ' +
      'value. Lower is better: 0 means you\'ve found it. Use the readings to ' +
      'close in, and try to win in as few probes as possible.',
    style: 'modal',
    once: true,
    pauses: true,
  },

  'play.firstProbe': {
    title: 'Read the surface',
    body:
      'That number is how close your probe is to a minimum — lower means ' +
      'closer. The colours around it show the slope: follow them downhill ' +
      'toward the deepest point. Beware deceptive local minima that look ' +
      'good but aren\'t the true global one.',
    style: 'modal',
    once: true,
    pauses: true,
  },

  // ── Vs EA loader: anchored coachmarks (style/pauses ignored for popovers) ──
  'vsEa.settingsButton': {
    title: 'Tune the EA',
    body:
      'Open this to change the algorithm — population size, operators, and ' +
      'how many generations it evolves per move you make.',
    style: 'toast',
    once: true,
  },

  'vsEa.settingsPanel': {
    title: 'Your opponent\'s brain',
    body:
      'These settings shape how the EA searches. Stronger operators and more ' +
      'generations per probe make it a tougher rival. Tweak, then close and ' +
      'hit Start to race.',
    style: 'toast',
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
