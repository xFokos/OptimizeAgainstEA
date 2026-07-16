import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createMazeProblem } from '../../engine/mazeProblem';
import { walkPath } from '../../engine/ea/individual';
import type { Cell, FitnessFnId, Move, Path, SerializedMaze, WalkResult } from '../../types/maze';
import { MOVE_ARROWS, cellIndex } from '../../types/maze';
import { sampleGradientRgb } from '../../../BattleShips/engine/colorScale';
import { MazeCanvas, type MazeAgent, type MazeTrail } from '../shared/MazeCanvas';
import { HintToggle, TourSpotlight, useHints, fillTemplate, HINTS } from '../../../../components/hints';

interface MazePlayModeProps {
  /** The maze to solve (from the setup screen or the creator). */
  maze: SerializedMaze;
  onBack: () => void;
  /** Return to the maze-selection setup screen to pick a fresh maze. */
  onNewMaze: () => void;
}

const WALK_TICK_MS = 140; // one walk step per tick; matches MazeCanvas's glide

/** Fraction of the string that must be written before the filmstrip hint fires. */
const FILMSTRIP_HINT_AT = 0.1;
/** Fraction of a submitted string that must be CHANGED before the mutation hint fires. */
const EDIT_HINT_AT = 0.1;

const WALKER_COLOR = '#4af0a0';
const GHOST_COLOR = 'rgba(160, 170, 200, 0.35)';
// The translucent "edit probe" that trails the draft string during playback.
const DRAFT_GHOST_COLOR = '#7aa2ff';

/** D-pad buttons — shared by the in-panel D-pad (desktop) and the maze overlay
 * (mobile). Move codes: 0 up · 1 right · 2 down · 3 left. All four use the same
 * arrow glyph, rotated, so every direction renders identically. */
const DPAD_BUTTONS: { move: Move; area: string; label: string; rotate: number }[] = [
  { move: 0, area: 'maze-dpad__up',    label: 'Up move',    rotate: 0 },
  { move: 3, area: 'maze-dpad__left',  label: 'Left move',  rotate: -90 },
  { move: 2, area: 'maze-dpad__down',  label: 'Down move',  rotate: 180 },
  { move: 1, area: 'maze-dpad__right', label: 'Right move', rotate: 90 },
];

/** The last submitted string + its cached walk — the maze animation's source. */
interface Submission {
  path: Path;
  walk: WalkResult;
}

/** Solve mode offers the three per-string fitness functions — novelty needs a
 * whole population + archive, so it has no meaning for a single player string. */
const PLAY_FITNESS_FNS: { id: FitnessFnId; label: string; hint: string }[] = [
  { id: 'manhattan', label: 'Manhattan', hint: 'Straight-line distance — ignores walls, so it deceives.' },
  { id: 'geodesic',  label: 'Geodesic',  hint: 'Corridor distance through the maze — honest guidance.' },
];

/** Last trail index the autoplay should reach: the goal step if reached, else
 * the genome end (Solve mode always wastes blocked moves, never crashes). */
function walkEndOf(walk: WalkResult, len: number): number {
  return walk.reachedGoalAt >= 0 ? walk.reachedGoalAt : len;
}

/**
 * Solve mode — "You are the EA". The player hand-writes a string of moves with a
 * D-pad and threads a fogged maze. Two filmstrips share one caret: the top shows
 * the LAST SUBMITTED string (fitness-painted — it also drives the maze walker),
 * the bottom the DRAFT being edited. Moving the caret in either scrubs the
 * submitted animation and positions the edit cursor, so the run always plays
 * while the draft's diff shows exactly where you edited. D-pad writes at the
 * caret (overwrite / append) then shifts it right; only Submit turns the draft
 * into the new animation. Switching fitness repaints instantly.
 */
export function MazePlayMode({ maze, onBack, onNewMaze }: MazePlayModeProps) {
  const [fitnessFnId, setFitnessFnId] = useState<FitnessFnId>('geodesic');

  const [draft, setDraft] = useState<Path>([]);
  // Shared caret — the animation position on the submitted strip AND the edit
  // position on the draft strip. In [0, max(draft, submission length)].
  const [pos, setPos] = useState(0);
  const [playing, setPlaying] = useState(false);

  const [submission, setSubmission] = useState<Submission | null>(null);
  // The previous submission's trail, drawn as a faint ghost.
  const [ghost, setGhost] = useState<Cell[] | null>(null);
  // Cells uncovered so far (fog of war — accumulates, never shrinks).
  const [revealed, setRevealed] = useState<Set<number>>(
    () => new Set([cellIndex(maze.start.x, maze.start.y, maze.cols)]),
  );
  const [generation, setGeneration] = useState(0);
  const [won, setWon] = useState(false);

  // ── Hints ──────────────────────────────────────────────────────────────────
  // 1. A blocking intro modal as soon as a maze is loaded here (the setup screen
  //    has already handed one over by the time this mounts).
  // 2. Then a spotlight on the Submit button: the screen dims except a cutout
  //    around it, until the player submits their first string.
  const { showHint, active, enabled, isSeen, markSeen } = useHints();
  const [introDone, setIntroDone] = useState(false);
  const introOpen = useRef(false);
  // The spotlight cuts out the whole input panel (D-pad + toolbar + Submit),
  // not just the button — the hint is about writing the string, not one control.
  const inputPanelRef = useRef<HTMLDivElement>(null);
  // 3. Once the draft is this far along, a spotlight on the filmstrips explains
  //    them — by then the player has actually written moves onto the strip.
  const stripsRef = useRef<HTMLDivElement>(null);
  // 4. And when the string is finally full-length, one on the Submit button
  //    alone — the control that just unlocked.
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  // 5. On the first submission, one on the whole strips panel. The walk
  //    animation is held back until it is dismissed (see submit()).
  const genomePanelRef = useRef<HTMLDivElement>(null);
  // 6. And once that first run has animated to its end, one on the fitness
  //    selector — the run is now scored, so the score is worth talking about.
  const fitnessPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Read `seen` BEFORE showing — showHint marks it synchronously. If the modal
    // won't appear at all (hints off, or already seen), the spotlight is free.
    const skipped = !enabled || isSeen('maze.play.start');
    showHint('maze.play.start');
    if (skipped) setIntroDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The spotlight queues behind the modal: it may only open once the intro hint
  // is no longer the active one, so the two never talk over each other.
  useEffect(() => {
    if (active?.id === 'maze.play.start') { introOpen.current = true; return; }
    if (introOpen.current) { introOpen.current = false; setIntroDone(true); }
  }, [active]);

  // The maze is aspect-locked, so on a tall column it ends up narrower than the
  // column itself. Measure what it actually renders at and hand that width to
  // the strips panel above it, so the two line up edge to edge at any size.
  const stageRef = useRef<HTMLDivElement>(null);
  const [mazeWidth, setMazeWidth] = useState<number | null>(null);
  useEffect(() => {
    const canvas = stageRef.current?.firstElementChild;
    if (!canvas) return;
    const ro = new ResizeObserver(([entry]) => setMazeWidth(entry.contentRect.width));
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  const stripWidth: CSSProperties | undefined =
    mazeWidth ? { width: mazeWidth, marginInline: 'auto' } : undefined;

  const submitHint = HINTS['maze.play.submit'];
  const showSubmitSpotlight =
    introDone && enabled && !submission && !isSeen('maze.play.submit');
  const closeSubmitSpotlight = () => markSeen('maze.play.submit');

  const filmstripHint = HINTS['maze.play.filmstrip'];
  const closeFilmstripSpotlight = () => markSeen('maze.play.filmstrip');

  const readyHint = HINTS['maze.play.readyToRun'];
  const closeReadySpotlight = () => markSeen('maze.play.readyToRun');

  // Shown from the first submission until dismissed; dismissing releases the
  // walker (submit() deliberately leaves it paused while this is up).
  const firstRunHint = HINTS['maze.play.firstRun'];
  const [runHeld, setRunHeld] = useState(false);
  const releaseRun = () => {
    markSeen('maze.play.firstRun');
    setRunHeld(false);
    setPlaying(true);
  };

  const fitnessHint = HINTS['maze.play.fitness'];
  const closeFitnessSpotlight = () => markSeen('maze.play.fitness');

  const cols = maze.cols;
  const rows = maze.rows;

  const problem = useMemo(
    () => createMazeProblem({
      cols, rows,
      grid: { cols, rows, walls: maze.walls },
      start: maze.start,
      goal: maze.goal,
      fitnessFnId,
      wallRule: 'waste',
    }),
    [cols, rows, maze.walls, maze.start, maze.goal, fitnessFnId],
  );

  // Deepest finite BFS distance — normalizer for the geodesic-family colour field.
  const maxGeo = useMemo(() => {
    let m = 0;
    for (let i = 0; i < problem.geodesicField.length; i++) {
      const d = problem.geodesicField[i];
      if (d > m) m = d;
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cols, rows, maze.walls, maze.goal]);

  // Per-cell fitness value in [0, 1] — 0 at the goal (cool), 1 far away (warm).
  const cellT = useMemo(() => (idx: number): number => {
    if (fitnessFnId === 'manhattan') {
      const x = idx % cols;
      const y = Math.floor(idx / cols);
      const dist = Math.abs(x - maze.goal.x) + Math.abs(y - maze.goal.y);
      return dist / (cols + rows);
    }
    const d = problem.geodesicField[idx];
    if (d < 0) return 1;
    return maxGeo > 0 ? d / maxGeo : 0;
  }, [fitnessFnId, cols, rows, maze.goal, problem.geodesicField, maxGeo]);

  const cellColor = (idx: number): string => sampleGradientRgb(cellT(idx));

  // The string is a FIXED length — the EA genome length for this maze. The
  // player (playing the EA) must fill exactly this many moves before submitting;
  // the D-pad can't write past it. Locked per maze, like every EA genome.
  const requiredLen = problem.pathLength;

  const subLen = submission?.path.length ?? 0;
  const draftLen = draft.length;
  const draftComplete = draftLen === requiredLen;

  // Filmstrip spotlight: 10% of the moves written, and never on top of the
  // Submit one (that spotlight blocks input, so it is always dismissed first).
  const showFilmstripSpotlight =
    enabled
    && !showSubmitSpotlight
    && !isSeen('maze.play.filmstrip')
    && draftLen >= Math.max(1, Math.ceil(requiredLen * FILMSTRIP_HINT_AT));

  // The string is full — light up the one control that just unlocked. Queues
  // behind the filmstrip spotlight, and only before the first run.
  const showReadySpotlight =
    enabled
    && draftComplete
    && !submission
    && !showSubmitSpotlight
    && !showFilmstripSpotlight
    && !isSeen('maze.play.readyToRun');
  const maxLen = Math.max(subLen, draftLen);
  // The walker rides the SUBMITTED walk at the caret (clamped to its length).
  const walkerIdx = submission ? Math.min(pos, subLen) : 0;

  // The draft's own walk — the edit probe rides this at the shared caret. It is
  // never committed, so it feeds no fog reveal; the ghost just reads its trail.
  const draftWalk = useMemo(() => walkPath(problem, draft), [problem, draft]);
  const draftWalkerIdx = Math.min(pos, draftLen);

  // Autoplay runs to whichever string ends later — the submitted run's goal/stop
  // step, or the draft probe's end — so the longer one always finishes on screen.
  const committedEnd = submission ? walkEndOf(submission.walk, subLen) : 0;
  const draftEnd = draftLen > 0 ? walkEndOf(draftWalk, draftLen) : 0;
  const playEnd = Math.max(committedEnd, draftEnd);

  // The submitted run has animated all the way to its end (goal or last move) —
  // it now has a fitness, so explain where that number comes from. Waits out the
  // win banner, which has the floor when the very first string solves the maze.
  const showFitnessSpotlight =
    enabled
    && !runHeld
    && !won
    && committedEnd > 0
    && pos >= committedEnd
    && !isSeen('maze.play.fitness');

  // ── Autoplay (advances the caret across the submitted run, then stops) ─────
  const animating = playing && pos < playEnd;
  useEffect(() => {
    if (!animating) return;
    const id = setInterval(() => {
      setPos((p) => {
        if (p + 1 >= playEnd) { setPlaying(false); return playEnd; }
        return p + 1;
      });
    }, WALK_TICK_MS);
    return () => clearInterval(id);
  }, [animating, playEnd]);

  // Reveal cells the submitted walker has reached up to the caret (fog, kept).
  useEffect(() => {
    if (!submission) return;
    setRevealed((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (let i = 0; i <= walkerIdx; i++) {
        const c = submission.walk.trail[i];
        const idx = cellIndex(c.x, c.y, cols);
        if (!next.has(idx)) { next.add(idx); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [submission, walkerIdx, cols]);

  // Declare the win only when the SUBMITTED walker actually animates onto the
  // goal — never on submit, and never for the draft probe (it rides a different
  // walk and can't win). reachedGoalAt indexes the submitted trail, so the
  // walker stands on the goal once its caret index reaches it.
  useEffect(() => {
    if (!submission) return;
    const goalAt = submission.walk.reachedGoalAt;
    if (goalAt >= 0 && walkerIdx >= goalAt) setWon(true);
  }, [submission, walkerIdx]);

  // ── Editing (all at the caret, on the draft) ───────────────────────────────
  const writeMove = (m: Move) => {
    setPlaying(false);
    const i = Math.min(pos, draftLen);
    // The string is fixed length: overwriting an existing slot is fine, but
    // there is no writing past the last slot.
    if (i >= requiredLen) return;
    setDraft((d) => {
      const nd = d.slice();
      if (i < nd.length) nd[i] = m;
      else nd.push(m);
      return nd;
    });
    setPos(Math.min(i + 1, requiredLen));
  };
  const seek = (i: number) => { setPlaying(false); setPos(Math.max(0, Math.min(i, maxLen))); };
  // Forward-delete: removes the move UNDER the caret (the highlighted one). The
  // following move slides under the caret, so it stays put. When the caret sits
  // past the last move (empty slot), drop the last move instead.
  const deleteAtCaret = () => {
    setPlaying(false);
    if (draftLen === 0) return;
    const j = Math.min(pos, draftLen);
    if (j >= draftLen) {
      setDraft((d) => d.slice(0, -1));
      setPos(draftLen - 1);
      return;
    }
    setDraft((d) => { const nd = d.slice(); nd.splice(j, 1); return nd; });
  };
  const clearDraft = () => { setPlaying(false); setDraft([]); setPos(0); };

  // ── Submit: the draft becomes the animated submission ──────────────────────
  const submit = () => {
    if (draft.length !== requiredLen) return; // only a full-length string may run
    const walk = walkPath(problem, draft);
    if (submission) {
      setGhost(submission.walk.trail.slice(0, walkEndOf(submission.walk, submission.path.length) + 1));
    }
    setSubmission({ path: draft.slice(), walk });
    setGeneration((g) => g + 1);
    // Win is NOT declared here — it fires only when the walker animates onto the
    // goal (see the effect below), so the banner waits for the run to arrive.
    setPos(0);
    // On the very first run the 'firstRun' spotlight explains what is about to
    // happen, so hold the walker at the start line — releaseRun() presses play.
    const hold = enabled && !isSeen('maze.play.firstRun');
    setRunHeld(hold);
    setPlaying(!hold);
  };

  const restart = () => {
    setDraft([]);
    setPos(0);
    setPlaying(false);
    setRunHeld(false);
    setSubmission(null);
    setGhost(null);
    setRevealed(new Set([cellIndex(maze.start.x, maze.start.y, cols)]));
    setGeneration(0);
    setWon(false);
  };

  // ── Physical keyboard input — arrow keys write moves, mirroring the D-pad.
  // Delete/Backspace remove the move at the caret; Enter submits the draft.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't hijack keys while typing in a form field.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      switch (e.key) {
        case 'ArrowUp':    e.preventDefault(); writeMove(0); break;
        case 'ArrowRight': e.preventDefault(); writeMove(1); break;
        case 'ArrowDown':  e.preventDefault(); writeMove(2); break;
        case 'ArrowLeft':  e.preventDefault(); writeMove(3); break;
        case 'Backspace':
        case 'Delete':     e.preventDefault(); deleteAtCaret(); break;
        case 'Enter':      e.preventDefault(); submit(); break;
        case 'a': case 'A': e.preventDefault(); seek(pos - 1); break;
        case 'd': case 'D': e.preventDefault(); seek(pos + 1); break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // Re-subscribe when the handlers' captured state changes so no stale reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, draftLen, draft, submission, problem]);

  // ── Render layers ─────────────────────────────────────────────────────────
  const fogCells = useMemo(() => {
    const out = new Set<number>();
    for (let i = 0; i < cols * rows; i++) if (!revealed.has(i)) out.add(i);
    return out;
  }, [revealed, cols, rows]);

  const trails: MazeTrail[] = useMemo(() => {
    const out: MazeTrail[] = [];
    if (ghost && ghost.length > 1) {
      out.push({ points: ghost, color: GHOST_COLOR, opacity: 0.5, width: 0.1 });
    }
    if (submission && walkerIdx > 0) {
      const points = submission.walk.trail.slice(0, walkerIdx + 1);
      const segColors = points.slice(1).map((p) => cellColor(cellIndex(p.x, p.y, cols)));
      out.push({ points, color: WALKER_COLOR, width: 0.16, segColors });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission, ghost, walkerIdx, cols, cellT]);

  const agents: MazeAgent[] = useMemo(() => {
    const out: MazeAgent[] = [{
      id: 'walker',
      cell: submission ? submission.walk.trail[walkerIdx] : maze.start,
      color: WALKER_COLOR,
      emphasis: true,
    }];
    // A probe trails the string you're editing. It reveals nothing, but it is
    // drawn over the fog and cross-fades in step with its glide: stepping INTO
    // the fog it fades out over the first half of the move (gone by the halfway
    // point, i.e. as it crosses the fog boundary); stepping OUT it fades in over
    // the second half. Deep in the fog it just sits at zero.
    if (draftLen > 0) {
      const cur = draftWalk.trail[draftWalkerIdx];
      const prev = draftWalk.trail[Math.max(0, draftWalkerIdx - 1)];
      const curFogged = !revealed.has(cellIndex(cur.x, cur.y, cols));
      const prevFogged = !revealed.has(cellIndex(prev.x, prev.y, cols));
      // Glide is 0.12s (see MazeCanvas); half of it is 0.06s.
      let opacityTransition: string | undefined;
      if (curFogged && !prevFogged) opacityTransition = 'opacity 0.06s linear';         // into fog: fade over first half
      else if (!curFogged && prevFogged) opacityTransition = 'opacity 0.06s linear 0.06s'; // out of fog: fade over second half
      out.push({
        id: 'draft-ghost',
        cell: cur,
        color: DRAFT_GHOST_COLOR,
        opacity: curFogged ? 0 : 0.95,
        r: 0.22,
        opacityTransition,
      });
    }
    return out;
  }, [submission, walkerIdx, maze.start, draftLen, draftWalk, draftWalkerIdx, revealed, cols]);

  const fitness = submission ? problem.evaluate(submission.walk) : null;
  const reached = submission ? submission.walk.reachedGoalAt : -1;
  const hasEdits = submission
    ? draft.length !== submission.path.length || draft.some((m, i) => m !== submission.path[i])
    : draft.length > 0;

  // How many moves of the submitted string the player has changed. Once that
  // passes EDIT_HINT_AT, they have effectively hand-mutated a genome — say so.
  const editedCount = submission
    ? draft.reduce<number>((n, m, i) => (m !== submission.path[i] ? n + 1 : n), 0)
    : 0;
  useEffect(() => {
    if (editedCount >= Math.max(1, Math.ceil(requiredLen * EDIT_HINT_AT))) {
      showHint('maze.play.mutation');
    }
  }, [editedCount, requiredLen, showHint]);

  // Submitted-strip painters: each move tinted by the cell it lands on.
  const subWalk = submission?.walk;
  const goalGene = subWalk ? subWalk.reachedGoalAt - 1 : -1;
  const subGeneStyle = (i: number): CSSProperties | undefined => {
    if (!subWalk) return undefined;
    const from = subWalk.trail[i];
    const to = subWalk.trail[i + 1];
    if (!to || (from.x === to.x && from.y === to.y)) return undefined; // wall bump → class colour
    return { color: cellColor(cellIndex(to.x, to.y, cols)) };
  };
  const subGeneClass = (i: number): string => {
    if (!subWalk) return '';
    const from = subWalk.trail[i];
    const to = subWalk.trail[i + 1];
    return to && from.x === to.x && from.y === to.y ? 'maze-gene--bump' : '';
  };
  const subGeneMark = (i: number): ReactNode =>
    i === goalGene ? <span className="maze-gene__mark maze-gene__mark--goal" aria-hidden="true">✓</span> : null;

  const renderDpad = (extraClass = '') => (
    <div className={`maze-dpad ${extraClass}`.trim()}>
      {DPAD_BUTTONS.map((b) => (
        <button
          key={b.move}
          className={`btn btn--ghost maze-dpad__btn ${b.area}`}
          onClick={() => writeMove(b.move)}
          aria-label={b.label}
        >
          <span className="maze-dpad__glyph" style={{ transform: `rotate(${b.rotate}deg)` }}>↑</span>
        </button>
      ))}
    </div>
  );

  // Draft-strip painter: mark the moves that differ from the submission.
  const draftGeneClass = (i: number): string =>
    !submission || i >= submission.path.length || draft[i] !== submission.path[i]
      ? 'maze-gene--edited'
      : 'maze-gene--unused';

  return (
    <div className="maze-app maze-app--menu">
      {showSubmitSpotlight && (
        <TourSpotlight
          targetRef={inputPanelRef}
          title={submitHint.title}
          body={fillTemplate(submitHint.body, { moves: String(requiredLen) })}
          actions={[{ label: 'Got it', onClick: closeSubmitSpotlight, variant: 'primary' }]}
          onAdvance={closeSubmitSpotlight}
          onSkip={closeSubmitSpotlight}
        />
      )}
      {showFilmstripSpotlight && (
        <TourSpotlight
          targetRef={stripsRef}
          title={filmstripHint.title}
          body={filmstripHint.body}
          actions={[{ label: 'Got it', onClick: closeFilmstripSpotlight, variant: 'primary' }]}
          onAdvance={closeFilmstripSpotlight}
          onSkip={closeFilmstripSpotlight}
        />
      )}
      {showReadySpotlight && (
        <TourSpotlight
          targetRef={submitBtnRef}
          title={readyHint.title}
          body={readyHint.body}
          actions={[{ label: 'Got it', onClick: closeReadySpotlight, variant: 'primary' }]}
          onAdvance={closeReadySpotlight}
          onSkip={closeReadySpotlight}
        />
      )}
      {runHeld && (
        <TourSpotlight
          targetRef={genomePanelRef}
          title={firstRunHint.title}
          body={firstRunHint.body}
          actions={[{ label: 'Run it', onClick: releaseRun, variant: 'primary' }]}
          onAdvance={releaseRun}
          onSkip={releaseRun}
        />
      )}
      {showFitnessSpotlight && (
        <TourSpotlight
          targetRef={fitnessPanelRef}
          title={fitnessHint.title}
          body={fitnessHint.body}
          actions={[{ label: 'Got it', onClick: closeFitnessSpotlight, variant: 'primary' }]}
          onAdvance={closeFitnessSpotlight}
          onSkip={closeFitnessSpotlight}
        />
      )}
      <header className="maze-topbar maze-topbar--bar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <span className="maze-topbar__title">🕹️<span className="maze-topbar__title-label"> Solve — You are the EA</span></span>
        <HintToggle />
      </header>

      <div className="maze-layout maze-layout--play">
        {/* LEFT — the D-pad input + submission controls */}
        <div className="maze-controls">
          <div className="panel panel--surface panel--md maze-panel" ref={inputPanelRef}>
            <div className="eyebrow">Write a {requiredLen}-move string</div>
            {renderDpad()}
            <div className="maze-toolbar">
              <button className="btn btn--ghost btn--sm" onClick={deleteAtCaret} disabled={draftLen === 0} title="Delete the move at the caret">⌦ Delete</button>
              <button className="btn btn--ghost btn--sm" onClick={clearDraft} disabled={draftLen === 0} title="Clear the draft">Clear</button>
            </div>
            <button
              ref={submitBtnRef}
              className="btn btn--primary btn--block"
              onClick={submit}
              disabled={!draftComplete}
              title={draftComplete ? 'Run this string' : `Fill all ${requiredLen} moves first`}
            >
              ▶ Submit ({draftLen}/{requiredLen})
            </button>
          </div>

          <div className="panel panel--surface panel--md maze-panel maze-play-stats">
            <div className="maze-play-stat"><span>Attempts</span><b>{generation}</b></div>
            <div className="maze-play-stat">
              <span>Fitness</span>
              <b>{fitness !== null ? fitness.toFixed(3) : '—'}</b>
            </div>
            <div className="maze-play-stat">
              <span>Goal</span>
              <b>{reached >= 0 ? `reached in ${reached}` : submission ? 'not reached' : '—'}</b>
            </div>
            <div className="maze-toolbar">
              <button className="btn btn--ghost btn--sm" onClick={restart} disabled={generation === 0 && draftLen === 0}>Reset</button>
            </div>
          </div>
        </div>

        {/* MIDDLE — the fogged maze + the two shared-caret filmstrips */}
        <div
          className="maze-map-col"
          style={{ maxWidth: `min(100%, calc((100dvh - 260px) * ${cols / rows}))` }}
        >
          <div className="panel panel--surface panel--md maze-panel maze-genome-panel" style={stripWidth} ref={genomePanelRef}>
            <div className="maze-genome-head">
              <div className="eyebrow">Strings</div>
              <span className="maze-genome-stats">
                <span>caret <b>{Math.min(pos + 1, maxLen || 1)}</b>/{maxLen}</span>
                {hasEdits && <span className="maze-genome-pending">● unsubmitted edits</span>}
              </span>
            </div>

            <div className="maze-dual-strips" ref={stripsRef}>
              <div className="maze-strip-line">
                <span className="maze-strip-tag">submitted</span>
                <FilmStrip
                  moves={submission?.path ?? []}
                  pos={pos}
                  onSeek={seek}
                  geneStyle={subGeneStyle}
                  geneClass={subGeneClass}
                  geneMark={subGeneMark}
                  emptyLabel="Submit a string to animate it here"
                  labelFor="submitted"
                />
              </div>
              <div className="maze-strip-line">
                <span className="maze-strip-tag">editing</span>
                <FilmStrip
                  moves={draft}
                  pos={pos}
                  onSeek={seek}
                  geneClass={draftGeneClass}
                  emptyLabel="Tap the D-pad to write moves"
                  labelFor="editing"
                />
              </div>
            </div>

            <div className="maze-anim-row">
              <div className="maze-walk-transport">
                <button className="btn btn--ghost btn--sm" onClick={() => seek(0)} disabled={pos === 0} title="Skip to start" aria-label="Skip to start">┃◀</button>
                <button className="btn btn--ghost btn--sm" onClick={() => seek(pos - 1)} disabled={pos === 0} title="Step back" aria-label="Step back">◀</button>
                <button
                  className={`btn btn--sm ${playing ? 'btn--active' : 'btn--ghost'}`}
                  onClick={() => {
                    if (!playing && pos >= playEnd) setPos(0);
                    setPlaying((p) => !p);
                  }}
                  disabled={playEnd === 0}
                  title={playing ? 'Pause' : 'Play the submitted run'}
                  aria-label={playing ? 'Pause' : 'Play the submitted run'}
                >
                  {playing ? '▮▮' : '▷'}
                </button>
                <button className="btn btn--ghost btn--sm" onClick={() => seek(pos + 1)} disabled={pos >= maxLen} title="Step forward" aria-label="Step forward">▶</button>
                <button className="btn btn--ghost btn--sm" onClick={() => seek(maxLen)} disabled={pos >= maxLen} title="Skip to end" aria-label="Skip to end">▶┃</button>
              </div>
            </div>
          </div>

          <div className="maze-canvas-stage" ref={stageRef}>
            <MazeCanvas
              cols={cols}
              rows={rows}
              walls={maze.walls}
              start={maze.start}
              goal={maze.goal}
              trails={trails}
              agents={agents}
              fogCells={fogCells}
              hideGoalUnderFog
            />
            {/* Mobile only (CSS): the direction pad floats over the maze as a
                translucent overlay; Submit / Delete / Clear stay in the panel. */}
            {renderDpad('maze-dpad--overlay')}
            {won && (
              <div className="maze-start-overlay maze-win-overlay">
                <div className="maze-win-overlay__title">🎉 Solved!</div>
                <p className="maze-start-overlay__note">
                  You threaded the maze in <b>{generation}</b> submission{generation === 1 ? '' : 's'}.
                </p>
                <div className="maze-toolbar">
                  <button className="btn btn--primary" onClick={() => setWon(false)}>Keep playing</button>
                  <button className="btn btn--ghost" onClick={onNewMaze}>New Maze</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — the fitness selector (repaints instantly) */}
        <aside className="panel panel--surface panel--md maze-panel maze-play-side" ref={fitnessPanelRef}>
          <div className="eyebrow">Fitness function</div>
          <p className="maze-note maze-play-side__note">
            Colours the trail &amp; the submitted string by closeness to the goal.
            Switching repaints instantly — no need to resubmit.
          </p>
          <div className="maze-fitness-buttons">
            {PLAY_FITNESS_FNS.map((f) => (
              <button
                key={f.id}
                className={`btn btn--sm maze-fitness-btn ${fitnessFnId === f.id ? 'btn--active' : 'btn--ghost'}`}
                onClick={() => setFitnessFnId(f.id)}
                title={f.hint}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="maze-fitness-legend">
            <span>near</span>
            <span className="maze-fitness-ramp" aria-hidden="true" />
            <span>far</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * A sliding filmstrip with a fixed centre highlight marking the caret (`pos`):
 * the string slides underneath, fading at both edges. Both strips take the same
 * `pos`, so their carets line up vertically and move together. Clicking a gene
 * seeks the caret there. Per-gene look is supplied by the caller (fitness colour
 * on the submitted strip, edit-diff highlight on the draft strip).
 */
function FilmStrip({
  moves, pos, onSeek, geneStyle, geneClass, geneMark, emptyLabel, labelFor,
}: {
  moves: Path;
  pos: number;
  onSeek: (i: number) => void;
  geneStyle?: (i: number) => CSSProperties | undefined;
  geneClass?: (i: number) => string;
  geneMark?: (i: number) => ReactNode;
  emptyLabel: string;
  labelFor: string;
}) {
  return (
    <div className="maze-genome-strip" aria-label={labelFor}>
      <div className="maze-genome-strip__highlight" aria-hidden="true" />
      {moves.length === 0 && <span className="maze-strip-empty">{emptyLabel}</span>}
      <div
        className="maze-genome-strip__track"
        style={{ transform: `translate(calc(${-(pos + 0.5)} * var(--gene-w)), -50%)` }}
      >
        {moves.map((move, i) => (
          <button
            key={i}
            className={`maze-gene ${i === pos ? 'maze-gene--current' : ''} ${geneClass?.(i) ?? ''}`}
            style={geneStyle?.(i)}
            onClick={() => onSeek(i)}
            title={`Move ${i + 1}: ${MOVE_ARROWS[move]} — click to jump here`}
          >
            {MOVE_ARROWS[move]}
            {geneMark?.(i)}
          </button>
        ))}
      </div>
    </div>
  );
}
