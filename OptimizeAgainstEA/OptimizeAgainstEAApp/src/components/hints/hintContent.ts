// ─────────────────────────────────────────────────────────────────────────
//  HINT CONTENT — single source of truth (website-wide)
//
//  This is the ONLY file you need to touch to edit, add, or remove hint text.
//  Each entry maps a HintId to its wording and how it should be presented.
//  Other games/pages can add their own entries here (prefix the id, e.g.
//  'shooter.*') — the whole site shares this one registry.
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

// ── DEV CONFIG ────────────────────────────────────────────────────────────
//  Compi is the website mascot (an old CRT PC with a face). Flip this flag to
//  choose how ALL hints are presented site-wide:
//    true  → every hint speaks through Compi, a Clippy-style speech bubble
//            anchored bottom-right (modals, toasts, and button coachmarks alike)
//    false → plain hints: corner toasts, centered modals, and popovers pinned
//            to their button (the original behaviour)
//  This is a developer switch, not a user-facing toggle.
export const COMPI_MODE = true;

export type HintId =
  | 'selector.welcome'
  | 'create.start'
  | 'create.place'
  | 'create.pickGlobal'
  | 'create.done'
  | 'play.start'
  | 'play.firstProbe'
  | 'vsEa.start'
  | 'vsEa.settingsButton'
  | 'vsEa.settingsPanel'
  | 'vsEa.replayButton'
  | 'vsEa.eaMovementButton'
  | 'vsEa.playerWon'
  | 'vsEa.eaWon'
  | 'shooter.dnaChangeDuringRound';

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
    title: 'Welcome to Peak Finder',
    body:
      'In this game you try to find the highest peak on an unexplored map. ' +
      'Create your own map to get a feel for how they work, ' +
      'play your own, random, or other players\' maps, ' +
      'or challenge yourself against an Evolutionary Algorithm. ' +
      'You can toggle hints anytime in the top-right corner.',
    style: 'modal',
    once: true,
  },

  // ── Create mode: intro modal, then one toast per phase ───────────────────
  'create.start': {
    title: 'Build a map',
    body:
      'You build your own map step by step here. ' +
      'Start by placing mountains — scatter them strategically to trap players. ' +
      'Select the global peak, which is the only winning spot. ' +
      'Once you are done, you will get a code to share and play your map.',
    style: 'modal',
    once: true,
    pauses: true,
  },

  // ── Create mode: one per phase, fired once on first entry this session ────
  'create.place': {
    title: 'Step 1 — Place Mountains',
    body:
      'Scatter a few decoys away from where you\'ll hide the real one — ' +
      'the more tempting the traps, the harder the map. You need at least two.',
    style: 'toast',
    once: true,
    sticky: true,
  },

  'create.pickGlobal': {
    title: 'Step 2 — Pick the Global Peak',
    body:
      'Click the dot that wins the game — the true highest peak players must ' +
      'find. Tucking it behind a cluster of deep decoys makes for a sneaky map.',
    style: 'toast',
    once: true,
    sticky: true,
  },

  'create.done': {
    title: 'Your map is ready',
    body:
      'Copy the code to share your map, or jump straight into Play or Vs EA ' +
      'to try it yourself. ',
    style: 'toast',
    once: true,
    sticky: true,
  },

  // ── Play mode: blocking modals (pauses = dismiss only via the button) ─────
  'play.start': {
    title: 'Hunt the global peak',
    body:
      'Somewhere on this map is a hidden global peak. Click anywhere to ' +
      'drop a probe — it reveals the surface around that spot and reads a ' +
      'value. Higher is better: 1 means you\'ve found it. Use the readings to ' +
      'close in, and try to win in as few probes as possible. ',
    style: 'modal',
    once: true,
    pauses: true,
  },

  'play.firstProbe': {
    title: 'Read the surface',
    body:
      'That number is how close your probe is to a peak — higher means ' +
      'closer. The colours around it show the slope: a colder colour leads to a better result. ' +
      'Beware deceptive local peaks that look ' +
      'good but aren\'t the true global one. There is only one true global peak.',
    style: 'modal',
    once: true,
    pauses: true,
  },

  // ── Vs EA race: blocking modal fired once when the race screen loads ──────
  'vsEa.start': {
    title: 'Playing against the Algorithm',
    body:
      'It works the same as play mode — but now you\'re racing an evolutionary algorithm. ' +
      'Each probe you drop lets the EA evolve its ' +
      'population a step on its own map. Find the peak in fewer moves than ' +
      'it takes the EA to converge, and you win. ',
    style: 'modal',
    once: true,
    pauses: true,
  },

  // ── Vs EA loader: anchored coachmarks (style/pauses ignored for popovers) ──
  'vsEa.settingsButton': {
    title: 'Tune the EA',
    body:
      'Open this to change the algorithm. ' +
      'Experiment with different settings and see how it makes a difference.',
    style: 'toast',
    once: true,
  },

  'vsEa.settingsPanel': {
    title: 'EA Settings',
    body:
      'These settings shape how the EA searches. ' +
      'Have fun experimenting with the values here and see how it changes the solving process.',
    style: 'toast',
    once: true,
  },

  // Anchored coachmark — rendered next to the replay button via <HintPopover>.
  // (style/pauses are ignored for popovers; only title/body/once apply.)
  'vsEa.replayButton': {
    title: 'See what the EA did',
    body:
      'The EA has also made its move. To see how it evolves from ' +
      'its current state to the next one, you can always press the "Evolution Step" button.',
    style: 'toast',
    once: true,
  },

  // Anchored coachmark — pinned to the "Watch EA Movement" button after a few
  // moves. Non-blocking; stays until the player dismisses it (see HintPopover).
  'vsEa.eaMovementButton': {
    title: 'Watch the EA move',
    body:
      'You\'ve made a few moves now, and so has the EA. To see' +
      ' how all the probes shifted across the generations, you can' +
      ' watch the replay with the "EA Movement" button.',
    style: 'toast',
    once: true,
  },

  // ── End-of-race modals (one per outcome) ──────────────────────────────────
  'vsEa.playerWon': {
    title: 'You beat the EA!',
    body:
      'Despite the odds being against you, you reached the global peak first. ' +
      'Can you keep it up though? Try adjusting the algorithm and see if you can keep beating it!',
    style: 'modal',
    once: true,
  },

  'vsEa.eaWon': {
    title: 'The EA got there first',
    body:
      'The algorithm found the global peak first. Don\'t worry about it — ' +
      'its tools are far more powerful than yours, which makes them great for optimization. ' +
      'More importantly, did you understand how it got there in the first place? ' +
      'You can watch the replay, as well as change the settings and try again.',
    style: 'modal',
    once: true,
  },

  'shooter.dnaChangeDuringRound': {
    title: 'Achtung: DNA geändert',
    body:
      'Du hast die Starter-DNA geändert, obwohl bereits Runden gespielt wurden. ' +
      'Der EA hat sich bis jetzt auf Basis der alten DNA entwickelt — ' +
      'ein Wechsel mittendrin kann die Lernkurve verfälschen. ' +
      'Für einen sauberen Neustart empfiehlt sich ein Reset.',
    style: 'toast',
    once: true,
    sticky: true,
  },
};
