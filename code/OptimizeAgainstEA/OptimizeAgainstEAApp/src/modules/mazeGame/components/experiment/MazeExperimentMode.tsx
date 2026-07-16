import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
import { MazeEASettingsControls } from './MazeEASettingsPanel';
import { HintToggle, HintPopover, useHints } from '../../../../components/hints';
import { Switch } from '../../../../components/ui/Switch';

interface MazeExperimentModeProps {
  /** The maze to run on (from the creator, the setup screen, or a code);
   * null falls back to a procedural maze with a seed input. */
  maze: SerializedMaze | null;
  onBack: () => void;
  /** Open the creator with the maze currently being experimented on. */
  onEdit: (maze: SerializedMaze) => void;
}

const MAZE_SIZE = 12;
const WALK_TICK_MS = 140; // one walk step per tick; matches MazeCanvas's glide transition
const WALK_END_DWELL = 8; // ticks the walker rests at its end before stopping
const MAX_GHOSTS = 80;    // animated ghost dots capped for SVG performance

const BEST_COLOR = '#4af0a0';
const MEAN_COLOR = '#f0c44a';

/** A settings change pinned to the generation where it took effect. */
interface ConfigMarker {
  gen: number;
  label: string;
}

/** Short human labels for the config fields, for the chart-change markers. */
const CONFIG_LABELS: Partial<Record<keyof EAConfig, string>> = {
  fitnessFnId: 'fitness',
  wallRule: 'wall rule',
  populationSize: 'population',
  maxGenerations: 'max gens',
  crossoverRate: 'crossover rate',
  mutationRate: 'mutation rate',
  mutationStrength: 'mutation strength',
  mutationDecay: 'mutation decay',
  winPopulationFraction: 'win fraction',
  selectionStrategy: 'selection',
  crossoverStrategy: 'crossover',
  mutationStrategy: 'mutation',
};

/** One-line summary of what changed between two configs (for a chart marker). */
function describeConfigChange(prev: EAConfig, next: EAConfig): string {
  const changed = (Object.keys(CONFIG_LABELS) as (keyof EAConfig)[])
    .filter((k) => prev[k] !== next[k])
    .map((k) => {
      const v = next[k];
      const val = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v);
      return `${CONFIG_LABELS[k]} → ${val}`;
    });
  return changed.join(', ');
}

/** Last trail index the walk animation should reach: goal if reached, else the
 * crash point (break-on-wall), else the genome end. */
function walkEndOf(ind: Individual): number {
  if (ind.walk.reachedGoalAt >= 0) return ind.walk.reachedGoalAt;
  if (ind.walk.crashedAt >= 0) return ind.walk.crashedAt;
  return ind.path.length;
}

/**
 * The best individual's genome as a filmstrip: a fixed highlight box in the
 * centre marks the current input, and the whole string slides underneath it as
 * the walk advances (fading out at both edges). Consumed genes turn accent,
 * wall bumps are flagged, genes past the goal are greyed out as unused, and
 * clicking any gene jumps the walk to that position.
 */
function GenotypeStrip({
  best,
  walkStep,
  onSeek,
}: {
  best: Individual | null;
  walkStep: number;
  onSeek: (i: number) => void;
}) {
  const end = best ? walkEndOf(best) : 0;
  // Outcome markers on the responsible gene: the move that crashed the walk
  // (break-on-wall only) gets a red ✕, the move that stepped onto the goal a
  // green ✓. reachedGoalAt is a step index, so move reachedGoalAt−1 caused it.
  const crashGene = best?.walk.crashedAt ?? -1;
  const goalGene = best ? best.walk.reachedGoalAt - 1 : -1;
  return (
    <div className="maze-genome-strip">
      <div className="maze-genome-strip__highlight" aria-hidden="true" />
      <div
        className="maze-genome-strip__track"
        // Slide so the current gene's centre sits under the highlight box.
        style={{ transform: `translate(calc(${-(walkStep + 0.5)} * var(--gene-w)), -50%)` }}
      >
        {/* Before the first generation there is no genome yet — the strip shows
            just the empty highlight box. */}
        {best?.path.map((move, i) => {
          // Move i takes the walker from trail[i] to trail[i+1]; identical cells
          // mean it bumped into a wall and the gene was wasted.
          const bumped =
            best.walk.trail[i + 1] !== undefined &&
            best.walk.trail[i].x === best.walk.trail[i + 1].x &&
            best.walk.trail[i].y === best.walk.trail[i + 1].y;
          let cls = 'maze-gene';
          if (i === crashGene) cls += ' maze-gene--bump';
          else if (i >= end) cls += ' maze-gene--unused';
          else if (i === walkStep) cls += ' maze-gene--current';
          else if (bumped) cls += ' maze-gene--bump';
          else if (i < walkStep) cls += ' maze-gene--done';
          const outcome = i === crashGene ? 'hit wall' : i === goalGene ? 'reached goal' : null;
          return (
            <button
              key={i}
              className={cls}
              onClick={() => onSeek(i)}
              title={`Jump to input ${i + 1}${outcome ? ` (${outcome})` : ''}`}
              aria-label={`Jump to input ${i + 1}${outcome ? ` (${outcome})` : ''}`}
            >
              {MOVE_ARROWS[move]}
              {outcome && (
                <span
                  className={`maze-gene__mark maze-gene__mark--${i === crashGene ? 'crash' : 'goal'}`}
                  aria-hidden="true"
                >
                  {i === crashGene ? '✕' : '✓'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * EA experiment: run an evolutionary algorithm on a maze (procedural or from
 * the creator), tweak its settings / fitness function, and watch the best
 * individual walk its genome through the maze — optionally alongside the rest
 * of the population as low-opacity ghosts.
 */
export function MazeExperimentMode({ maze, onBack, onEdit }: MazeExperimentModeProps) {
  const [seed, setSeed] = useState(7);
  const [fitnessFnId, setFitnessFnId] = useState<FitnessFnId>('geodesic');
  const [showReplay, setShowReplay] = useState(false);
  // The right-hand settings dock. Open by default on desktop (docked in the
  // grid), tucked away by default on mobile (off-canvas drawer). The » arrow
  // hides it, the edge tab brings it back.
  const [settingsOpen, setSettingsOpen] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1081px)').matches,
  );
  // Editable EA tuning (everything except the fitness function, which has its
  // own dropdown). Changing any field restarts the run on the same maze.
  const [tuning, setTuning] = useState<EAConfig>(DEFAULT_MAZE_EA_CONFIG);
  // Walk animation of the current best individual (+ ghosts). Off by default so
  // the maze sits still on entry — nothing moves until the user hits Run (to
  // evolve) or Walk (to animate the current best).
  const [walkPlaying, setWalkPlaying] = useState(false);
  const [walkTick, setWalkTick] = useState(0);
  // True once an autoplayed walk has run to its end — cue for the Evolve hint.
  const [walkDone, setWalkDone] = useState(false);
  const [showGhosts, setShowGhosts] = useState(true);
  // Pre-run state: the maze sits darkened behind a Play overlay while the
  // player tunes the settings; the first generation is only bred on Play.
  const [started, setStarted] = useState(false);

  // Entry modal: point the player at the settings dock before they breed
  // generation 0 (no-ops when hints are off or it was already seen).
  const { showHint } = useHints();
  useEffect(() => {
    showHint('maze.experiment.start');
  }, [showHint]);

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
            wallRule: tuning.wallRule,
            pathLengthFactor: tuning.pathLengthFactor,
          })
        : createMazeProblem({
            cols: MAZE_SIZE, rows: MAZE_SIZE, seed, fitnessFnId,
            braid: DEFAULT_BRAID, wallRule: tuning.wallRule,
            pathLengthFactor: tuning.pathLengthFactor,
          }),
    [maze, seed, fitnessFnId, tuning.wallRule, tuning.pathLengthFactor],
  );

  const ea = useMazeEARunner();
  const { init, step, reset, updateConfig, status, currentGeneration, generations, latestReplay } = ea;


  // Only the run's identity — maze, seed, genome length — restarts it from
  // scratch. Everything else (tuning + fitness fn) is applied to the running EA
  // and takes effect on the next generation — so the player can experiment
  // without losing progress. Genome length is structural (the population's
  // genomes are that long), so it belongs to the identity.
  const runParams = useMemo(
    () => ({
      seed,
      cols: maze?.cols ?? MAZE_SIZE,
      rows: maze?.rows ?? MAZE_SIZE,
      maze: maze ?? undefined,
      pathLengthFactor: tuning.pathLengthFactor,
    }),
    [maze, seed, tuning.pathLengthFactor],
  );

  // Generation-change markers for the fitness chart. `configRef` holds the
  // config the worker currently runs; `genCountRef` mirrors the generation
  // count so the config effect can read it without depending on it.
  const [markers, setMarkers] = useState<ConfigMarker[]>([]);
  // The config the worker currently runs. While the run is in its pre-state
  // the update effect below keeps it in sync with every edit, so Play always
  // starts the worker with the latest settings.
  const configRef = useRef(config);
  const genCountRef = useRef(0);
  useEffect(() => { genCountRef.current = generations.length; }, [generations.length]);

  // A new run identity (maze / seed / genome length) rewinds the walk, clears
  // the chart markers and drops back to the pre-run overlay — done during
  // render (the React-idiomatic reset-on-prop-change).
  const [prevRunParams, setPrevRunParams] = useState(runParams);
  if (prevRunParams !== runParams) {
    setPrevRunParams(runParams);
    setWalkTick(0);
    setMarkers([]);
    setStarted(false);
  }

  // Pre-run: tear down any previous worker so a stale generation never shows
  // behind the Play overlay.
  useEffect(() => {
    if (!started) reset();
  }, [started, reset]);

  // Start the worker when the player presses Play (and on the identity change
  // of an already-started run). Reads the settings as tuned in the pre-state;
  // walk & markers are already clear — every path into the pre-state resets them.
  useEffect(() => {
    if (!started) return;
    init(runParams, configRef.current);
    step(0); // pull generation 0 so the canvas renders immediately
  }, [started, runParams, init, step]);

  // Apply tuning / fitness-function edits to the running EA (next generation),
  // and drop a marker on the chart where the change lands. Skips the first run
  // and the re-init above (which already carries the current config). Pre-run
  // edits just sync the ref — Play reads them when it starts the worker.
  useEffect(() => {
    if (config === configRef.current) return;
    if (!started) {
      configRef.current = config;
      return;
    }
    const label = describeConfigChange(configRef.current, config);
    configRef.current = config;
    updateConfig(config);
    // At most one marker per generation — repeated edits (e.g. dragging a
    // slider) before the next generation collapse to the latest change.
    if (label) {
      setMarkers((m) => {
        const gen = genCountRef.current;
        return [...m.filter((x) => x.gen !== gen), { gen, label }];
      });
    }
  }, [config, updateConfig, started]);

  const best: Individual | null = currentGeneration?.individuals[0] ?? null;

  // ── Walk animation ────────────────────────────────────────────────────────
  // The best individual walks its genome through the maze. Every new generation
  // rewinds the walker to the start.
  const [prevGen, setPrevGen] = useState(currentGeneration);
  if (prevGen !== currentGeneration) {
    setPrevGen(currentGeneration);
    setWalkTick(0);
  }

  const animating = walkPlaying && best !== null;
  useEffect(() => {
    if (!animating) return;
    const stopAt = walkEndOf(best!) + WALK_END_DWELL;
    const id = setInterval(() => {
      setWalkTick((t) => {
        // Reached the end (plus the end-of-walk dwell): stop autoplay instead of looping.
        if (t + 1 >= stopAt) {
          setWalkPlaying(false);
          setWalkDone(true);
          return stopAt;
        }
        return t + 1;
      });
    }, WALK_TICK_MS);
    return () => clearInterval(id);
  }, [animating, best]);

  // Rest at the end; the walker holds its final position once autoplay stops.
  const walkStep = best ? Math.min(walkTick, walkEndOf(best)) : 0;

  // Solve modal the first time the walker visibly steps onto the goal — tied
  // to the animated arrival, not to the data merely containing a solving
  // genome (showHint no-ops on repeats since the hint is `once`).
  const probeOnGoal = !!best && best.walk.reachedGoalAt >= 0 && walkStep >= best.walk.reachedGoalAt;
  useEffect(() => {
    if (probeOnGoal) showHint('maze.experiment.goalReached');
  }, [probeOnGoal, showHint]);

  // Arrow keys or A/D step the walk one input left/right (pausing autoplay).
  // Ignored while a form field is focused so sliders / the seed input keep the keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const left = e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A';
      const right = e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D';
      if (!left && !right) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!best) return;
      e.preventDefault();
      const end = walkEndOf(best);
      setWalkPlaying(false);
      setWalkTick((t) => {
        const cur = Math.min(t, end);
        return left ? Math.max(0, cur - 1) : Math.min(end, cur + 1);
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [best]);

  // ── Canvas layers ─────────────────────────────────────────────────────────
  const trails: MazeTrail[] = useMemo(() => {
    const inds = currentGeneration?.individuals ?? [];
    if (inds.length === 0) return [];
    // Draw the best individual's path up to where the walker currently stands.
    return [{
      points: inds[0].walk.trail.slice(0, walkStep + 1),
      color: BEST_COLOR,
      opacity: 0.55,
      width: 0.14,
    }];
  }, [currentGeneration, walkStep]);

  const agents: MazeAgent[] = useMemo(() => {
    const inds = currentGeneration?.individuals ?? [];
    if (inds.length === 0) return [];
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
  }, [currentGeneration, showGhosts, walkStep]);

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

  // Back to the pre-run overlay; the next Play breeds a fresh first generation.
  const restart = () => {
    reset();
    setStarted(false);
    setWalkTick(0);
    setMarkers([]);
  };

  // Hand the maze being experimented on to the creator. Serializing from
  // `problem` covers procedural mazes too, not just creator-built ones; the
  // walls are copied so the editor can't mutate the running EA's grid.
  const editMaze = () => onEdit({
    cols: problem.cols,
    rows: problem.rows,
    walls: problem.grid.walls.slice(),
    start: problem.start,
    goal: problem.goal,
  });

  // Finding the goal doesn't end the run — you can keep evolving to refine the
  // population; only running out of generations (maxGenerations) stops it.
  const exhausted = status === 'exhausted';
  const bestEnd = best ? walkEndOf(best) : 0;

  // Clicking a gene in the filmstrip jumps the walk there (and pauses autoplay).
  const seekWalk = (i: number) => {
    setWalkPlaying(false);
    setWalkTick(Math.max(0, Math.min(i, bestEnd)));
  };

  return (
    <div className="maze-app maze-app--menu">
      <header className="maze-topbar maze-topbar--bar">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← Back</button>
        <span className="maze-topbar__title">🧬<span className="maze-topbar__title-label"> Control the EA</span></span>
        <HintToggle />
      </header>

      <div className={`maze-layout maze-layout--exp ${settingsOpen ? '' : 'maze-layout--exp-collapsed'}`}>
        {/* LEFT — playback controls for the evolution run and the walk animation */}
        <div className="maze-controls">
          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Evolution</div>
            <div className="maze-toolbar">
              <HintPopover id="maze.experiment.evolve" placement="bottom" highlight show={walkDone && generations.length < 2}>
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => step(1)}
                  disabled={!started || exhausted}
                >
                  🧬 Evolve
                </button>
              </HintPopover>
              <button className="btn btn--ghost btn--sm" onClick={restart} disabled={!started}>Reset</button>
            </div>
            <HintPopover
              id="maze.experiment.dissect"
              placement="bottom"
              highlight
              show={generations.length >= 2 && !!latestReplay && latestReplay.length > 0}
            >
              <button
                className="btn btn--ghost btn--sm btn--block"
                onClick={() => setShowReplay(true)}
                disabled={!latestReplay || latestReplay.length === 0}
              >
                🔬 Dissect last generation
              </button>
            </HintPopover>
            <button
              className="btn btn--ghost btn--sm btn--block"
              onClick={editMaze}
              disabled={!started}
            >
              ✏️ Edit this maze
            </button>
          </div>

          <div className="panel panel--surface panel--md maze-panel">
            <div className="eyebrow">Fitness over generations</div>
            <FitnessChart
              series={chartSeries}
              yMax={1}
              compact
              markers={markers.map((m) => ({ index: m.gen, label: m.label }))}
            />
          </div>
        </div>

        {/* MIDDLE — the maze, with the best individual's genotype string on top */}
        {/* The stylesheet's width cap assumes a square maze; correct it by the
            aspect ratio so tall creator mazes still fit the viewport height. */}
        <div
          className="maze-map-col"
          style={{ maxWidth: `min(100%, calc((100dvh - 220px) * ${problem.cols / problem.rows}))` }}
        >
          <div className="panel panel--surface panel--md maze-panel maze-genome-panel">
              <div className="maze-genome-head">
                <div className="eyebrow">Best genotype</div>
                <span className="maze-genome-stats">
                  {best ? (
                    <>
                      <span>fitness <b>{best.fitness.toFixed(3)}</b></span>
                      <span>
                        {best.walk.reachedGoalAt >= 0
                          ? <>goal in <b>{best.walk.reachedGoalAt}</b> steps</>
                          : <>goal not reached</>}
                      </span>
                      <span>step <b>{walkStep}</b>/{bestEnd}</span>
                    </>
                  ) : (
                    <span>awaiting the first generation…</span>
                  )}
                </span>
              </div>
              <GenotypeStrip best={best} walkStep={walkStep} onSeek={seekWalk} />

              {/* Step transport, centred under the strip. */}
              <div className="maze-anim-row">
                <div className="maze-walk-transport">
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setWalkPlaying(false); setWalkTick(0); }}
                    disabled={!best || walkStep === 0}
                    title="Skip to first input"
                    aria-label="Skip to first input"
                  >
                    ┃◀
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setWalkPlaying(false); setWalkTick(Math.max(0, walkStep - 1)); }}
                    disabled={!best || walkStep === 0}
                    title="One input back"
                    aria-label="One input back"
                  >
                    ◀
                  </button>
                  <HintPopover id="maze.experiment.walkPlay" placement="bottom" highlight show={started && !!best && !walkDone}>
                    <button
                      className={`btn btn--sm ${walkPlaying ? 'btn--active' : 'btn--ghost'}`}
                      onClick={() => {
                        // If the walk has run to the end, restart it from the beginning.
                        if (!walkPlaying && best && walkStep >= walkEndOf(best)) setWalkTick(0);
                        setWalkPlaying((p) => !p);
                      }}
                      disabled={!best}
                      title={walkPlaying ? 'Pause autoplay' : 'Autoplay'}
                      aria-label={walkPlaying ? 'Pause autoplay' : 'Autoplay'}
                    >
                      {walkPlaying ? '▮▮' : '▷'}
                    </button>
                  </HintPopover>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setWalkPlaying(false); setWalkTick(Math.min(bestEnd, walkStep + 1)); }}
                    disabled={!best || walkStep === bestEnd}
                    title="One input further"
                    aria-label="One input further"
                  >
                    ▶
                  </button>
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => { setWalkPlaying(false); setWalkTick(bestEnd); }}
                    disabled={!best || walkStep === bestEnd}
                    title="Skip to last input"
                    aria-label="Skip to last input"
                  >
                    ▶┃
                  </button>
                </div>
              </div>
            </div>

          <div className="maze-canvas-stage">
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
            {!started && (
              <div className="maze-start-overlay">
                <button className="btn btn--primary maze-start-overlay__btn" onClick={() => setStarted(true)}>
                  ▶ Breed first generation
                </button>
                <p className="maze-start-overlay__note">Tune the settings first — they shape generation 0.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — collapsible dock: fitness function + EA settings, tucks to the side */}
        <aside
          className={`panel panel--surface panel--md maze-panel maze-settings ${settingsOpen ? 'maze-settings--open' : ''}`}
        >
          <div className="maze-settings__head">
            <div className="eyebrow">Settings</div>
          </div>
          <Switch
            checked={showGhosts}
            onChange={setShowGhosts}
            label="Show ghosts"
            disabled={!started}
          />
          <p className="maze-note maze-settings__note">
            Changes apply to the next generation — the run keeps its progress.
          </p>

          <div className="maze-settings__scroll">
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

            {!maze && (
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

            <MazeEASettingsControls
              config={config}
              onConfigChange={(patch) => setTuning((t) => ({ ...t, ...patch }))}
              shortestPath={problem.metadata?.shortestPath}
              runStarted={started}
            />
          </div>
        </aside>
      </div>

      {/* One handle for both directions: opens the dock, and closes it again. */}
      <button
        className="maze-dock-tab"
        onClick={() => setSettingsOpen((o) => !o)}
        aria-label={settingsOpen ? 'Hide settings' : 'Show settings'}
        aria-expanded={settingsOpen}
        title="Settings"
      >
        {settingsOpen ? '»' : '«'} Settings
      </button>

      {/* Mobile: dim the page behind the slid-in dock. */}
      {settingsOpen && (
        <div className="maze-settings__backdrop" onClick={() => setSettingsOpen(false)} />
      )}

      {showReplay && latestReplay && (
        <MazeEAReplayOverlay frames={latestReplay} problem={problem} onClose={() => setShowReplay(false)} />
      )}
    </div>
  );
}
