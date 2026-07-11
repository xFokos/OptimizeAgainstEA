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
  | 'maze.play.submit';

export const MAZE_HINTS: Record<MazeHintId, HintDef> = {
  // ── Solve mode: blocking modal fired once the maze is loaded ─────────────
  'maze.play.start': {
    title: 'You are the EA',
    body:
      'This time you play the role of the algorithm. Your genome is a fixed ' +
      'string of moves — write it with the D-pad (or the arrow keys), then hit ' +
      'Submit to run it. The walker follows your string through the fog and ' +
      'reports a fitness value: the lower it is, the closer you got to the ' +
      'goal. Nothing else is revealed, so edit the string, resubmit, and let ' +
      'each attempt guide the next one.',
    style: 'modal',
    once: true,
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
      'can improve on.',
    style: 'toast',
    once: true,
  },
};
