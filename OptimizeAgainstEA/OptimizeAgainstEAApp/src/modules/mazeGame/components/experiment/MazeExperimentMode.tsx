import { useEffect, useMemo, useState, useCallback } from 'react';
import { createMazeProblem, DEFAULT_BRAID } from '../../engine/mazeProblem';
import { DEFAULT_MAZE_EA_CONFIG } from '../../types/ea';
import type { EAConfig, Individual } from '../../types/ea';
import { FITNESS_FN_IDS, FITNESS_FN_LABELS, MOVE_ARROWS } from '../../types/maze';
import type { FitnessFnId, SerializedMaze } from '../../types/maze';
import { useMazeEARunner } from '../../hooks/useMazeEARunner';
import { sampleGradientRgb } from '../../../BattleShips/engine/colorScale';
import { FitnessChart, type FitnessSeries } from '../../../BattleShips/components/game/shared/FitnessChart';
import { MazeCanvas, type MazeTrail, type MazeAgent } from '../shared/MazeCanvas';
import { MazeEAReplayOverlay } from './MazeEAReplayOverlay';
import { MazeEASettingsPanel } from './MazeEASettingsPanel';

interface MazeExperimentModeProps {
  /** Hand-built maze from the creator, or null to use a procedural one. */
  maze: SerializedMaze | null;
  onBack: () => void;
  /** Drop the creator maze and fall back to procedural generation. */
  onClearMaze: () => void;
}

const MAZE_SIZE = 12;
const STEP_CHUNK = 3;     // generations advanced per "Run" tick
const RUN_TICK_MS = 140;
const WALK_TICK_MS = 140; // one walk step per tick; matches MazeCanvas's glide transition
const WALK_END_DWELL = 8; // ticks the walker rests at its end before looping
const MAX_GHOSTS = 80;    // animated ghost dots capped for SVG performance

const BEST_COLOR = '#4af0a0';
const MEAN_COLOR = '#f0c44a';

/** Last trail index the walk animation should reach (goal if reached, else genome end). */
function walkEndOf(ind: Individual): number {
  return ind.walk.reachedGoalAt >= 0 ? ind.walk.reachedGoalAt : ind.path.length;
}

/**
 * The best individual's genome as a strip of move arrows, synced to the walk
 * animation: consumed genes turn accent, the gene being executed is inverted,
 * wall bumps are flagged, and genes past the goal are greyed out as unused.
 */
function GenotypeStrip({ best, walkStep }: { best: Individual; walkStep: number }) {
  const end = walkEndOf(best);
  return (
    <p className="maze-genome">
      {best.path.map((move, i) => {
        // Move i takes the walker from trail[i] to trail[i+1]; identical cells
        // mean it bumped into a wall and the gene was wasted.
        const bumped =
          best.walk.trail[i + 1] !== undefined &&
          best.walk.trail[i].x === best.walk.trail[i + 1].x &&
          best.walk.trail[i].y === best.walk.trail[i + 1].y;
        let cls = 'maze-gene';
        if (i >= end) cls += ' maze-gene--unused';
        else if (i === walkStep) cls += ' maze-gene--current';
        else if (bumped) cls += ' maze-gene--bump';
        else if (i < walkStep) cls += ' maze-gene--done';
        return <span key={i} className={cls}>{MOVE_ARROWS[move]}</span>;
      })}
    </p>
  );
}

/**
 * EA experiment: run an evolutionary algorithm on a maze (procedural or from
 * the creator), tweak its settings / fitness function, and watch the best
 * individual walk its genome through the maze — optionally alongside the rest
 * of the population as low-opacity ghosts.
 */
export function MazeExperimentMode({ maze, onBack, onClearMaze }: MazeExperimentModeProps) {
  const [seed, setSeed] = useState(7);
  const [fitnessFnId, setFitnessFnId] = useState<FitnessFnId>('geodesic');
  const [playing, setPlaying] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Editable EA tuning (everything except the fitness function, which has its
  // own dropdown). Changing any field restarts the run on the same maze.
  const [tuning, setTuning] = useState<EAConfig>(DEFAULT_MAZE_EA_CONFIG);
  // Walk animation of the current best individual (+ ghosts).
  const [walkPlaying, setWalkPlaying] = useState(true);
  const [walkTick, setWalkTick] = useState(0);
  const [showGhosts, setShowGhosts] = useState(true);

  const config: EAConfig = useMemo(
    () => ({ ...tuning, fitnessFnId }),
    [tuning, fitnessFnId],
  );

  // Main-thread copy of the maze for rendering. Procedural builds are
  // deterministic on (seed, size, braid), so this matches the worker's maze;
  // creator mazes are passed through verbatim.
  const problem = useMemo(
    () =>
      maze
        ? createMazeProblem({
            cols: maze.cols,
            rows: maze.rows,
            grid: { cols: maze.cols, rows: maze.rows, walls: maze.walls },
            start: maze.start,
            goal: maze.goal,
            fitnessFnId,
            seed,
          })
        : createMazeProblem({ cols: MAZE_SIZE, rows: MAZE_SIZE, seed, fitnessFnId, braid: DEFAULT_BRAID }),
    [maze, seed, fitnessFnId],
  );

  const ea = useMazeEARunner();
  const { init, step, reset, status, currentGeneration, generations, totalGenerations, latestReplay } = ea;

  // One identity for "everything that restarts the run" — the init effect and
  // the restart adjustments below key off it.
  const setup = useMemo(
    () => ({
      runParams: {
        seed,
        cols: maze?.cols ?? MAZE_SIZE,
        rows: maze?.rows ?? MAZE_SIZE,
        maze: maze ?? undefined,
      },
      config,
    }),
    [maze, seed, config],
  );

  // A changed maze / fitness function / tuning restarts the run: stop
  // auto-play and rewind the walk. Adjusted during render so the effect below
  // only talks to the worker.
  const [prevSetup, setPrevSetup] = useState(setup);
  if (prevSetup !== setup) {
    setPrevSetup(setup);
    setPlaying(false);
    setWalkTick(0);
  }

  // (Re)start the worker whenever the maze, fitness function, or tuning changes.
  useEffect(() => {
    init(setup.runParams, setup.config);
    step(0); // pull generation 0 so the canvas renders immediately
  }, [setup, init, step]);

  // Auto-run stops as soon as the worker reports a terminal state.
  if (playing && (status === 'solved' || status === 'exhausted')) setPlaying(false);

  // EA auto-run loop.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => step(STEP_CHUNK), RUN_TICK_MS);
    return () => clearInterval(id);
  }, [playing, step]);

  const best: Individual | null = currentGeneration?.individuals[0] ?? null;

  // ── Walk animation ────────────────────────────────────────────────────────
  // Runs while the EA is paused (during auto-run the canvas shows trails
  // instead — generations change far too fast to walk them out). Every new
  // generation rewinds the walker to the start.
  const [prevGen, setPrevGen] = useState(currentGeneration);
  if (prevGen !== currentGeneration) {
    setPrevGen(currentGeneration);
    setWalkTick(0);
  }

  const animating = walkPlaying && !playing && best !== null;
  useEffect(() => {
    if (!animating) return;
    const id = setInterval(() => setWalkTick((t) => t + 1), WALK_TICK_MS);
    return () => clearInterval(id);
  }, [animating]);

  // Dwell at the end for a beat, then loop.
  const walkStep = best ? Math.min(walkTick % (walkEndOf(best) + WALK_END_DWELL), walkEndOf(best)) : 0;

  // ── Canvas layers ─────────────────────────────────────────────────────────
  const trails: MazeTrail[] = useMemo(() => {
    const inds = currentGeneration?.individuals ?? [];
    if (inds.length === 0) return [];
    if (playing) {
      // While the EA runs: population spaghetti coloured by fitness, best on top.
      const out: MazeTrail[] = showGhosts
        ? inds.map((ind) => ({
            points: ind.walk.trail,
            color: sampleGradientRgb(ind.fitness),
            opacity: 0.1,
            width: 0.08,
          }))
        : [];
      out.push({ points: inds[0].walk.trail, color: BEST_COLOR, opacity: 0.95, width: 0.18 });
      return out;
    }
    // While the walker animates: draw its path only up to where it stands.
    return [{
      points: inds[0].walk.trail.slice(0, walkStep + 1),
      color: BEST_COLOR,
      opacity: 0.55,
      width: 0.14,
    }];
  }, [currentGeneration, playing, showGhosts, walkStep]);

  const agents: MazeAgent[] = useMemo(() => {
    const inds = currentGeneration?.individuals ?? [];
    if (playing || inds.length === 0) return [];
    const out: MazeAgent[] = [];
    if (showGhosts) {
      inds.slice(1, MAX_GHOSTS + 1).forEach((ind, i) => {
        // Each ghost walks its own genome and parks where its walk ends.
        const at = Math.min(walkStep, walkEndOf(ind));
        out.push({
          id: `ghost-${i}`,
          cell: ind.walk.trail[at],
          color: sampleGradientRgb(ind.fitness),
          opacity: 0.3,
          r: 0.16,
        });
      });
    }
    out.push({
      id: 'best',
      cell: inds[0].walk.trail[walkStep],
      color: BEST_COLOR,
      emphasis: true,
    });
    return out;
  }, [currentGeneration, playing, showGhosts, walkStep]);

  // Fully sealed cells (creator wall blocks) render as filled squares, matching
  // the creator's look. Procedural mazes have none, so this is a no-op there.
  const solidCells = useMemo(() => {
    const out = new Set<number>();
    for (let i = 0; i < problem.grid.walls.length; i++) {
      if (problem.grid.walls[i] === 0) out.add(i);
    }
    return out;
  }, [problem]);

  const chartSeries: FitnessSeries[] = useMemo(() => {
    const bestData = generations.map((g) => g.best.fitness);
    const meanData = generations.map((g) => g.meanFitness);
    return [
      { label: 'EA best', color: BEST_COLOR, data: bestData },
      { label: 'EA mean', color: MEAN_COLOR, data: meanData },
    ];
  }, [generations]);

  const reseed = useCallback(() => setSeed(Math.floor(Math.random() * 100000)), []);

  const restart = () => {
    setPlaying(false);
    reset();
    init(setup.runParams, setup.config);
    step(0);
  };

  const solved = status === 'solved';
  const bestEnd = best ? walkEndOf(best) : 0;

  return (
    <div className="maze-app">
      <header className="maze-topbar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <span className="maze-topbar__title">🧬 EA Experiment</span>
        <span className="maze-topbar__meta">
          {solved
            ? <b className="maze-topbar__meta-accent">solved in {totalGenerations} generations</b>
            : <>status <b className="maze-topbar__meta-accent">{status}</b> · gen {totalGenerations}</>}
        </span>
      </header>

      <div className="maze-layout">
        <div className="maze-map-col">
          <MazeCanvas
            cols={problem.cols}
            rows={problem.rows}
            walls={problem.grid.walls}
            start={problem.start}
            goal={problem.goal}
            solidCells={solidCells}
            trails={trails}
            agents={agents}
          />

          {best && (
            <div className="panel panel--surface panel--md maze-panel">
              <div className="maze-genome-head">
                <div className="eyebrow">Best genotype</div>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => setWalkPlaying((p) => !p)}
                  disabled={playing}
                  title={playing ? 'Pause the EA run to watch the walk' : undefined}
                >
                  {walkPlaying ? '⏸ Pause walk' : '▶ Walk'}
                </button>
                <label className="maze-check">
                  <input
                    type="checkbox"
                    checked={showGhosts}
                    onChange={(e) => setShowGhosts(e.target.checked)}
                  />
                  Show ghosts
                </label>
                <span className="maze-genome-stats">
                  <span>fitness <b>{best.fitness.toFixed(3)}</b></span>
                  <span>
                    {best.walk.reachedGoalAt >= 0
                      ? <>goal in <b>{best.walk.reachedGoalAt}</b> steps</>
                      : <>goal not reached</>}
                  </span>
                  <span>step <b>{walkStep}</b>/{bestEnd}</span>
                </span>
              </div>

              <GenotypeStrip best={best} walkStep={walkStep} />

              <p className="maze-note">
                The genotype is the move sequence the best individual executes,
                one arrow per gene. Red arrows bumped into a wall; grey ones are
                unused after reaching the goal. Ghosts are the rest of the
                population walking their own genomes.
              </p>
            </div>
          )}
        </div>

        <div className="maze-side">
          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Problem</div>

            <label className="maze-note" htmlFor="maze-fitness-fn">Fitness function</label>
            <select
              id="maze-fitness-fn"
              className="ea-select"
              value={fitnessFnId}
              onChange={(e) => setFitnessFnId(e.target.value as FitnessFnId)}
            >
              {FITNESS_FN_IDS.map((id) => (
                <option key={id} value={id}>{FITNESS_FN_LABELS[id]}</option>
              ))}
            </select>

            {maze ? (
              <>
                <p className="maze-note">
                  🧱 Custom maze from the creator ({maze.cols}×{maze.rows}),
                  shortest path <b>{problem.metadata.shortestPath}</b> steps.
                </p>
                <button className="btn btn--ghost btn--sm" onClick={onClearMaze}>
                  🎲 Use a random maze instead
                </button>
              </>
            ) : (
              <>
                <label className="maze-note" htmlFor="maze-seed">Maze seed</label>
                <div className="maze-row">
                  <input
                    id="maze-seed"
                    className="maze-input"
                    type="number"
                    value={seed}
                    onChange={(e) => setSeed(Number(e.target.value) || 0)}
                  />
                  <button className="btn btn--ghost btn--sm" onClick={reseed}>🎲</button>
                </div>
              </>
            )}
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Evolution</div>
            <div className="maze-toolbar">
              <button
                className={`btn btn--sm ${playing ? 'btn--active' : 'btn--primary'}`}
                onClick={() => setPlaying((p) => !p)}
                disabled={solved}
              >
                {playing ? '⏸ Pause' : '▶ Run'}
              </button>
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { setPlaying(false); step(1); }}
                disabled={solved}
              >
                Step
              </button>
              <button className="btn btn--ghost btn--sm" onClick={restart}>Reset</button>
            </div>
            <button
              className="btn btn--ghost btn--sm btn--block"
              onClick={() => setShowReplay(true)}
              disabled={!latestReplay || latestReplay.length === 0}
            >
              🔬 Dissect last generation
            </button>
            <button
              className="btn btn--ghost btn--sm btn--block ea-settings-btn"
              onClick={() => setShowSettings(true)}
            >
              ⚙ EA settings
            </button>
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Fitness over generations</div>
            <FitnessChart series={chartSeries} yMax={1} compact />
          </div>
        </div>
      </div>

      {showSettings && (
        <MazeEASettingsPanel
          config={config}
          onConfigChange={(patch) => setTuning((t) => ({ ...t, ...patch }))}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showReplay && latestReplay && (
        <MazeEAReplayOverlay frames={latestReplay} problem={problem} onClose={() => setShowReplay(false)} />
      )}
    </div>
  );
}
