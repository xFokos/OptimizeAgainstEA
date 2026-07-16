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

// A game with many hints may keep them in its own module and be merged into the
// registry at the bottom of this file — see MAZE_HINTS ('maze.*') and
// PEAKFINDER_HINTS ('selector.*' / 'create.*' / 'play.*' / 'loader.*' / 'vsEa.*').
import { MAZE_HINTS } from '../../modules/mazeGame/hints/mazeHintContent';
import type { MazeHintId } from '../../modules/mazeGame/hints/mazeHintContent';
import { PEAKFINDER_HINTS } from '../../modules/BattleShips/hints/peakFinderHintContent';
import type { PeakFinderHintId } from '../../modules/BattleShips/hints/peakFinderHintContent';

/** Ids defined in this file. The full site-wide union is `HintId` below. */
type CoreHintId =
  | 'shooter.dnaChangeDuringRound'
  | 'shooter.tour.welcome'
  | 'shooter.tour.modes'
  | 'shooter.tour.difficulty'
  | 'shooter.tour.dna'
  | 'shooter.tour.start'
  | 'horde.tour.welcome'
  | 'horde.tour.modes'
  | 'horde.tour.difficulty'
  | 'horde.tour.dna'
  | 'horde.tour.map'
  | 'horde.tour.start'
  | 'functions.intro';

export type HintId = CoreHintId | MazeHintId | PeakFinderHintId;

/** Which screen corner an ambient (non-anchored) Compi bubble appears in.
 * Ignored for blocking modals (always centered) and for HintPopover-anchored
 * hints (positioned near their control instead — see HintPopover.tsx). */
export type CompiPosition = 'bottom-right' | 'top-right' | 'bottom-left' | 'top-left';

export interface HintDef {
  title?: string;
  body: string;
  style: 'modal' | 'toast';
  once?: boolean;
  pauses?: boolean;
  sticky?: boolean;
  /** Default 'bottom-right' — set per hint if it should appear somewhere else
   * (e.g. it would otherwise sit on top of other fixed UI in a corner). */
  position?: CompiPosition;
}

const CORE_HINTS: Record<CoreHintId, HintDef> = {
  'shooter.dnaChangeDuringRound': {
    title: 'Settings changed mid-run',
    body:
      'You changed the settings after rounds have already been played. ' +
      'The EA has been evolving based on the previous values — ' +
      'changing them mid-run can skew the learning curve. ' +
      'A reset is recommended for a clean start.',
    style: 'toast',
    once: true,
    sticky: true,
  },
  // ── Solo lobby guided tour: chained step-by-step, wired up in
  //    ShooterLobbyPage.tsx (the "Next"/"Skip" actions live at the call site,
  //    not here — see startShooterTour there). 'welcome' fires once on the
  //    first visit; the other steps are re-triggerable via the "Take the
  //    Tour" button, so they deliberately don't set `once`. ──────────────────
  'shooter.tour.welcome': {
    title: 'New here?',
    body:
      'Want a quick walkthrough of the Solo Play lobby before you jump in? ' +
      'It only takes a few seconds.',
    style: 'modal',
    once: true,
  },

  'shooter.tour.modes': {
    title: 'Step 1 — Tabs',
    body:
      'Overview, Algorithm, DNA & Round and Player — each tab controls a ' +
      'different part of the fight. Overview has quick difficulty presets; ' +
      'the others let you fine-tune everything by hand.',
    style: 'toast',
  },

  'shooter.tour.difficulty': {
    title: 'Step 2 — Difficulty',
    body:
      'Easy, Medium and Hard set the opponent\'s starting DNA and how many ' +
      'generations it secretly pre-trains before round one even begins. ' +
      'Higher difficulty means it walks in already sharper.',
    style: 'toast',
  },

  'shooter.tour.dna': {
    title: 'Step 3 — DNA',
    body:
      'Those bars in the preview are the opponent\'s entire behavior — ' +
      'pursuit, dodge, accuracy and more. No hidden neural net, just 8 ' +
      'numbers that evolve a little more after every round you play.',
    style: 'toast',
  },

  'shooter.tour.start': {
    title: 'Step 4 — Play',
    body:
      'When you\'re ready, hit "Play" to start round one. Land more hits ' +
      'than you take in 20 seconds to win — the opponent evolves to counter ' +
      'you a little more each round after that.',
    style: 'toast',
  },

  // ── Horde lobby guided tour: same spotlight mechanism as the Solo tour
  //    (see startTour in ShooterLobbyPage.tsx's HordeLobby). 'welcome' fires
  //    once on first visit; the rest are re-triggerable via "Take the Tour",
  //    so they deliberately don't set `once`. ────────────────────────────────
  'horde.tour.welcome': {
    title: 'New here?',
    body:
      'Want a quick walkthrough of the Horde lobby before you jump in? ' +
      'It only takes a few seconds.',
    style: 'modal',
    once: true,
  },

  'horde.tour.modes': {
    title: 'Step 1 — Tabs',
    body:
      'Overview, Algorithm, DNA & Wave, Map and Player — each tab controls a ' +
      'different part of the swarm. Overview has quick difficulty presets; ' +
      'the others let you fine-tune everything by hand.',
    style: 'toast',
  },

  'horde.tour.difficulty': {
    title: 'Step 2 — Difficulty',
    body:
      'Each preset sets the wave size and how aggressively the swarm ' +
      'mutates and crosses over between deaths. Bigger waves and faster ' +
      'mutation mean the horde adapts to you quicker.',
    style: 'toast',
  },

  'horde.tour.dna': {
    title: 'Step 3 — DNA',
    body:
      'These bars are every agent\'s starting behavior — aggression, dodge, ' +
      'speed and more. There\'s no round reset here: every kill evolves the ' +
      'next spawn, forever, for as long as you survive.',
    style: 'toast',
  },

  'horde.tour.map': {
    title: 'Step 4 — The Map',
    body:
      'Solid-bordered obstacles block bullets — duck behind one for cover. ' +
      'Dashed ones only block movement, so you can still shoot straight over ' +
      'them. Switch maps (or build your own) in the Map tab.',
    style: 'toast',
  },

  'horde.tour.start': {
    title: 'Step 5 — Play',
    body:
      'When you\'re ready, hit "Play Horde". One touch from an agent ends the ' +
      'run — but every couple of kills you\'ll get to pick a powerup to help ' +
      'you survive a little longer.',
    style: 'toast',
  },

  // ── Functions drawer: fired once the first time the player opens it ────────
  'functions.intro': {
    title: 'Math functions play differently',
    body:
      'These are mathematical functions rather than hand-built maps, so they ' +
      'behave a little differently. Instead of a single hidden peak, a function ' +
      'can have several winning areas — any spot that reaches the optimal ' +
      'value counts as a win, and those spots can form larger regions or ' +
      'appear in more than one place. Explore and see how each one feels!',
    style: 'modal',
    once: true,
    pauses: true,
  },
};

/** The site-wide registry the hint system reads: core hints + every game's own. */
export const HINTS: Record<HintId, HintDef> = {
  ...CORE_HINTS,
  ...MAZE_HINTS,
  ...PEAKFINDER_HINTS,
};
