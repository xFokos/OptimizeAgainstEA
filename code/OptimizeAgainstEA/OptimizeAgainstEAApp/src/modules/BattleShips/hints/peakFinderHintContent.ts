// ─────────────────────────────────────────────────────────────────────────
//  PEAK FINDER HINT CONTENT — the Peak Finder game's slice of the site-wide
//  hint registry.
//
//  This is the ONLY file to touch for Peak Finder hint text. The ids and defs
//  here are merged into HINTS in components/hints/hintContent.ts, so
//  everything works exactly like any other hint:
//
//      const { showHint } = useHints();
//      showHint('vsEa.start');
//
//  Field meanings (style / once / pauses / sticky, {placeholders} + vars) are
//  documented in components/hints/hintContent.ts.
// ─────────────────────────────────────────────────────────────────────────
import type { HintDef } from '../../../components/hints/hintContent';

export type PeakFinderHintId =
  | 'selector.welcome'
  | 'create.start'
  | 'create.place'
  | 'create.pickGlobal'
  | 'create.done'
  | 'play.start'
  | 'play.firstProbe'
  | 'loader.chooseMap'
  | 'vsEa.start'
  | 'vsEa.settingsButton'
  | 'vsEa.settingsPanel'
  | 'vsEa.replayButton'
  | 'vsEa.eaMovementButton'
  | 'vsEa.playerWon'
  | 'vsEa.eaWon';

export const PEAKFINDER_HINTS: Record<PeakFinderHintId, HintDef> = {
  'selector.welcome': {
    title: 'Welcome to Peak Finder',
    body:
      'In this game you try to find the highest peak on an unexplored map. ' +
      'Create your own map to get a feel for how they work, ' +
      'play your own, random, or other players\' maps, ' +
      'or challenge yourself against an Evolutionary Algorithm. ' +
      'You can toggle hints anytime in the top-right corner.',
    style: 'modal',
    once: false,
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
    once: false,
    pauses: true,
  },

  // ── Create mode: one per phase, fired on entering the phase ──────────────
  'create.place': {
    title: 'Step 1 — Place Mountains',
    body:
      'Scatter a few decoys away from where you\'ll hide the real one — ' +
      'the more tempting the traps, the harder the map. You need at least two.',
    style: 'toast',
    once: false,
    sticky: true,
  },

  'create.pickGlobal': {
    title: 'Step 2 — Pick the Global Peak',
    body:
      'Click the dot that wins the game — the true highest peak players must ' +
      'find. Tucking it behind a cluster of tall decoys makes for a sneaky map.',
    style: 'toast',
    once: false,
    sticky: true,
  },

  'create.done': {
    title: 'Your map is ready',
    body:
      'Copy the code to share your map, or jump straight into Play or Vs EA ' +
      'to try it yourself. ',
    style: 'toast',
    once: false,
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
    once: false,
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
    once: false,
    pauses: true,
  },

  // ── Map/function loader: shown on the loader once the player has saved at
  //    least one map. Points them to the two places they can load from. Fires
  //    after the game-mode intro and, in Vs EA, before the EA-settings coachmark. ─
  'loader.chooseMap': {
    title: 'Where to find maps & functions',
    body:
      'Need something to load? Your own creations live under "Your Maps" at the ' +
      'top-left, and a whole library of mathematical functions sits in the ' +
      '"Functions" tab beside it. Open either one, copy a code, and paste it ' +
      'here to play.',
    style: 'toast',
    once: false,
  },

  // ── Vs EA race: blocking modal fired when the race screen loads ──────────
  'vsEa.start': {
    title: 'Playing against the Algorithm',
    body:
      'It works the same as play mode — but now you\'re racing an evolutionary algorithm. ' +
      'Each probe you drop lets the EA evolve its ' +
      'population a step on its own map. Find the peak in fewer moves than ' +
      'it takes the EA to converge, and you win. ',
    style: 'modal',
    once: false,
    pauses: true,
  },

  // ── Vs EA loader: anchored coachmarks (style/pauses ignored for popovers) ──
  'vsEa.settingsButton': {
    title: 'Tune the EA',
    body:
      'Open the EA settings to change the algorithm. ' +
      'Experiment with different settings and see how it makes a difference.',
    style: 'toast',
    once: false,
  },

  'vsEa.settingsPanel': {
    title: 'EA Settings',
    body:
      'These settings shape how the EA searches. ' +
      'Have fun experimenting with the values here and see how it changes the solving process.',
    style: 'toast',
    once: false,
  },

  // Anchored coachmark — rendered next to the replay button via <HintPopover>.
  // (style/pauses are ignored for popovers; only title/body/once apply.)
  'vsEa.replayButton': {
    title: 'See what the EA did',
    body:
      'The EA has also made its move. To see how it evolves from ' +
      'its current state to the next one, you can always press the "Evolution Step" button.',
    style: 'toast',
    once: false,
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
    once: false,
  },

  // ── End-of-race modals (one per outcome) ──────────────────────────────────
  'vsEa.playerWon': {
    title: 'You beat the EA!',
    body:
      'Despite the odds being against you, you reached the global peak first. ' +
      'Can you keep it up though? Try adjusting the algorithm and see if you can keep beating it!',
    style: 'modal',
    once: false,
  },

  'vsEa.eaWon': {
    title: 'The EA got there first',
    body:
      'The algorithm found the global peak first. Don\'t worry about it — ' +
      'its tools are far more powerful than yours, which makes them great for optimization. ' +
      'More importantly, did you understand how it got there in the first place? ' +
      'You can watch the replay, as well as change the settings and try again.',
    style: 'modal',
    once: false,
  },
};
