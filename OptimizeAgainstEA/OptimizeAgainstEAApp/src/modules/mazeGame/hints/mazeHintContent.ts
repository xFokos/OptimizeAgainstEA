// ─────────────────────────────────────────────────────────────────────────
//  MAZE HINT CONTENT — the maze game's slice of the site-wide hint registry.
//
//  This is the ONLY file to touch for maze hint text. The ids and defs here
//  are merged into HINTS in components/hints/hintContent.ts, so everything
//  works exactly like any other hint:
//
//      const { showHint } = useHints();
//      showHint('maze.play.start');
//
//  Field meanings (style / once / pauses / sticky, {placeholders} + vars) are
//  documented in components/hints/hintContent.ts.
// ─────────────────────────────────────────────────────────────────────────
import type { HintDef } from '../../../components/hints/hintContent';

export type MazeHintId =
  | 'maze.play.start'
  | 'maze.play.submit'
  | 'maze.play.filmstrip'
  | 'maze.play.readyToRun'
  | 'maze.play.firstRun'
  | 'maze.play.fitness'
  | 'maze.play.mutation'
  | 'maze.experiment.start'
  | 'maze.experiment.walkPlay'
  | 'maze.experiment.evolve'
  | 'maze.experiment.dissect'
  | 'maze.experiment.goalReached';

export const MAZE_HINTS: Record<MazeHintId, HintDef> = {
  // ── Solve mode: blocking modal fired once the maze is loaded ─────────────
  'maze.play.start': {
    title: 'You are the EA',
    body:
      'In this mode you try to solve a maze like an EA would. ' +
      'You will build a string of Inputs and then watch the probe explore the maze in that order. ' +
      'After that you can edit your string and repeat the process till you find the goal.',
    style: 'modal',
    once: false,
    pauses: true,
  },

  // ── Solve mode: a TourSpotlight on the Submit button — the screen dims
  //    except a cutout around it (same presentation as the shooter lobby tour).
  //    Fired once the intro modal is out of the way, until the first submission.
  //    `style` is unused for spotlights; only title/body/once apply.
  //    {moves} = the maze's genome length, filled in by MazePlayMode. ─────────
  'maze.play.submit': {
    title: 'Fill the whole string',
    body:
      'A genome has a fixed length: Submit only unlocks once all {moves} moves ' +
      'are written. Bumping into a wall wastes that move but costs you nothing ' +
      'else, so fill every slot — even a rough guess is a starting point you ' +
      'can improve on. You can submit moves by using the Buttons (or your arrow keys).',
    style: 'toast',
    once: false,
  },

  // ── Solve mode: a second TourSpotlight, this one on the filmstrips. Fires
  //    once the player has written 10% of the string (see FILMSTRIP_HINT_AT in
  //    MazePlayMode) — by then they've used the D-pad and the strip has enough
  //    on it to be worth explaining. Spotlight, so `style` is unused. ─────────
  'maze.play.filmstrip': {
    title: 'Your string, move by move',
    body:
      'Here you can view, play and edit your string. ' +
      'You always see your last submitted string so you know exactly where to make edits. ' +
      'Once you made all your edits here, just press Submit again.',
    style: 'toast',
    once: false,
  },

  // ── Solve mode: the last spotlight, on the Submit button alone, the moment
  //    the draft is full-length (see MazePlayMode's draftComplete). Unlike
  //    'maze.play.submit' — which lights the whole input panel while the string
  //    is still being written — this one points at the single control that is
  //    now unlocked. Spotlight, so `style` is unused. ─────────────────────────
  'maze.play.readyToRun': {
    title: 'Your string is complete',
    body:
      'Every slot is filled, so Submit has unlocked. Run it and watch the ' +
      'walker follow your moves through the fog — whatever it uncovers, and the ' +
      'fitness it comes back with, is what you get to work from for the next ' +
      'attempt. ',
    style: 'toast',
    once: false,
  },

  // ── Solve mode: fires the moment the FIRST string is submitted, spotlighting
  //    the whole strips panel (both strips + the transport row). MazePlayMode
  //    holds the walk animation back until this is dismissed, so the player
  //    reads what they are about to watch before the walker sets off. ─────────
  'maze.play.firstRun': {
    title: 'Watch it run',
    body:
      'Your string moved to the top strip and the walker is about to follow it. ' +
      'Each move is tinted by how close it landed to the goal, and a dimmed one ' +
      'means the walker hit a wall there and stood still — a wasted move. Use ' +
      'the buttons below to replay, pause, or step through it move by ' +
      'move. Dismiss this and the run starts.',
    style: 'toast',
    once: false,
  },

  // ── Solve mode: fires once the first run has animated all the way to its end,
  //    spotlighting the fitness selector on the right. Last hint in the chain. ─
  'maze.play.fitness': {
    title: 'What "good" even means',
    body:
      'The run is scored by a fitness function, and you can swap which one. ' +
      'Manhattan measures straight-line distance to the goal, so it happily ' +
      'rewards a move that is walled off from it — it deceives. Geodesic ' +
      'measures distance through the corridors, so it never lies to you. ' +
      'Switching repaints the strip and the trail instantly, without resubmitting: ' +
      'the same run, judged two different ways. This is the choice that decides ' +
      'what an EA hill-climbs toward — pick badly and it optimizes the wrong thing.',
    style: 'toast',
    once: false,
  },

  // ── Solve mode: fires once the player has changed 10% of the moves in an
  //    already-submitted string (see EDIT_HINT_AT in MazePlayMode). A plain
  //    non-blocking hint on purpose — they are mid-edit, so a spotlight would
  //    dim the very strip they are working on. ────────────────────────────────
  'maze.play.mutation': {
    title: 'That\'s a mutation',
    body:
      'Now that you have edited your String you can resubmit and see how you improvement',
    style: 'toast',
    once: false,
    sticky: true,
  },

  // ── Experiment mode: blocking modal fired on entry, before anything runs.
  //    The maze sits behind the "Breed first generation" overlay until the
  //    player starts the run — this points them at the settings dock first,
  //    since those settings shape generation 0. ──────────────────────────────
  'maze.experiment.start': {
    title: 'Your EA, your rules',
    body:
      'Here you set up an EA and watch it solve the maze on its own. ' +
      'Before you breed the first generation, have a look at the Settings panel ' +
      'on the right (behind the « Settings tab if it is tucked away): population ' +
      'size, selection, crossover and mutation all shape generation 0 and the run ' +
      'that follows. You can keep tweaking while it evolves — changes apply from ' +
      'the next generation.',
    style: 'modal',
    once: false,
    pauses: true,
  },

  // ── Experiment mode: anchored coachmark on the walk-transport play button,
  //    fired once the first generation exists (see MazeExperimentMode).
  //    (style/pauses are ignored for popovers; only title/body/once apply.) ───
  'maze.experiment.walkPlay': {
    title: 'Watch the best solution',
    body:
      'Press play to watch the EA\'s current best individual walk the maze, ' +
      'move by move. The rest of the generation walks along as faint ghosts — ' +
      'you can switch them on or off with "Show ghosts" in the Settings.',
    style: 'toast',
    once: false,
  },

  // ── Experiment mode: anchored coachmark on the Evolve button, fired once the
  //    best individual's walk animation has run to its end (see walkDone in
  //    MazeExperimentMode) — the natural "what now?" moment.
  //    (style/pauses are ignored for popovers; only title/body/once apply.) ───
  'maze.experiment.evolve': {
    title: 'Breed the next generation',
    body:
      'With the evolve button you breed the next generation from the current one. ' +
      'And you can always change the EA settings between generations — ' +
      'changes take effect with the next breeding.',
    style: 'toast',
    once: false,
  },

  // ── Experiment mode: anchored coachmark on the Dissect button, fired once
  //    the second generation is bred — the first moment there is a breeding
  //    step (gen n → gen n+1) worth dissecting.
  //    (style/pauses are ignored for popovers; only title/body/once apply.) ───
  'maze.experiment.dissect': {
    title: 'See how a generation is made',
    body:
      'Want to know how the EA got from generation n to n+1? This opens a ' +
      'step-by-step replay of the last breeding: which individuals were ' +
      'selected, how they were paired and crossed over, and where mutation ' +
      'changed the offspring.',
    style: 'toast',
    once: false,
  },

  // ── Experiment mode: blocking modal fired the first time the walker
  //    visibly steps onto the goal (see MazeExperimentMode) — celebrates the
  //    solve and nudges the player toward comparison experiments. ───────────
  'maze.experiment.goalReached': {
    title: 'You found a solution!',
    body:
      'Your probe reached the goal. Can it be done in fewer moves? ' +
      'Try a different fitness function and see whether it finds a ' +
      'shorter path — or rerun the same maze seed with different settings ' +
      'and see how it goes.',
    style: 'modal',
    once: false,
    pauses: true,
  },
};
