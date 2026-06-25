import { useEffect, useMemo, useState, useCallback } from 'react';
import { createMazeProblem, DEFAULT_BRAID } from '../../engine/mazeProblem';
import { DEFAULT_MAZE_EA_CONFIG } from '../../types/ea';
import type { EAConfig } from '../../types/ea';
import { FITNESS_FN_IDS, FITNESS_FN_LABELS } from '../../types/maze';
import type { FitnessFnId } from '../../types/maze';
import { useMazeEARunner } from '../../hooks/useMazeEARunner';
import { sampleGradientRgb } from '../../../BattleShips/engine/colorScale';
import { FitnessChart, type FitnessSeries } from '../../../BattleShips/components/game/shared/FitnessChart';
import { MazeCanvas, type MazeTrail } from '../shared/MazeCanvas';
import { MazeEAReplayOverlay } from './MazeEAReplayOverlay';
import { MazeEASettingsPanel } from './MazeEASettingsPanel';
import { btn, panel, lbl, select } from '../shared/mazeStyles';

interface MazeVsEAModeProps {
  onBack: () => void;
}

const MAZE_SIZE = 12;
const STEP_CHUNK = 3; // generations advanced per "Run" tick

export function MazeVsEAMode({ onBack }: MazeVsEAModeProps) {
  const [seed, setSeed] = useState(7);
  const [fitnessFnId, setFitnessFnId] = useState<FitnessFnId>('geodesic');
  const [playing, setPlaying] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Editable EA tuning (everything except the fitness function, which has its
  // own dropdown). Changing any field restarts the run on the same maze.
  const [tuning, setTuning] = useState<EAConfig>(DEFAULT_MAZE_EA_CONFIG);

  const config: EAConfig = useMemo(
    () => ({ ...tuning, fitnessFnId }),
    [tuning, fitnessFnId],
  );

  // Main-thread copy of the maze for rendering. Deterministic on
  // (seed, size, braid), so it matches the maze the worker builds exactly.
  const problem = useMemo(
    () => createMazeProblem({ cols: MAZE_SIZE, rows: MAZE_SIZE, seed, fitnessFnId, braid: DEFAULT_BRAID }),
    [seed, fitnessFnId],
  );

  const ea = useMazeEARunner();
  const { init, step, reset, status, currentGeneration, generations, totalGenerations, latestReplay } = ea;

  // (Re)start the worker whenever the maze, fitness function, or tuning changes.
  useEffect(() => {
    setPlaying(false);
    init({ seed, cols: MAZE_SIZE, rows: MAZE_SIZE }, config);
    step(0); // pull generation 0 so trails render immediately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, config]);

  // Auto-run loop.
  useEffect(() => {
    if (!playing) return;
    if (status === 'solved' || status === 'exhausted') { setPlaying(false); return; }
    const id = setInterval(() => step(STEP_CHUNK), 140);
    return () => clearInterval(id);
  }, [playing, status, step]);

  const trails: MazeTrail[] = useMemo(() => {
    const inds = currentGeneration?.individuals ?? [];
    if (inds.length === 0) return [];
    // Population as translucent spaghetti, colored by fitness; best highlighted.
    const out: MazeTrail[] = inds.map((ind) => ({
      points: ind.walk.trail,
      color: sampleGradientRgb(ind.fitness),
      opacity: 0.1,
      width: 0.08,
    }));
    out.push({ points: inds[0].walk.trail, color: '#4af0a0', opacity: 0.95, width: 0.18 });
    return out;
  }, [currentGeneration]);

  const chartSeries: FitnessSeries[] = useMemo(() => {
    const best = generations.map((g) => g.best.fitness);
    const mean = generations.map((g) => g.meanFitness);
    return [
      { label: 'EA best', color: '#4af0a0', data: best },
      { label: 'EA mean', color: '#f0c44a', data: mean },
    ];
  }, [generations]);

  const reseed = useCallback(() => setSeed(Math.floor(Math.random() * 100000)), []);

  const solved = status === 'solved';

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#e8eaf0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={btn}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 20 }}>Maze — EA exhibit</h2>
        <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 13 }}>
          Status: <b style={{ color: solved ? '#4af0a0' : '#e8eaf0' }}>{status}</b>
          {' · '}gen {totalGenerations}
          {solved && ` · solved in ${totalGenerations}`}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20, alignItems: 'start' }}>
        <div>
          <MazeCanvas
            cols={problem.cols}
            rows={problem.rows}
            walls={problem.grid.walls}
            start={problem.start}
            goal={problem.goal}
            trails={trails}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={panel}>
            <label style={lbl}>Fitness function</label>
            <select
              value={fitnessFnId}
              onChange={(e) => setFitnessFnId(e.target.value as FitnessFnId)}
              style={select}
            >
              {FITNESS_FN_IDS.map((id) => (
                <option key={id} value={id}>{FITNESS_FN_LABELS[id]}</option>
              ))}
            </select>

            <label style={{ ...lbl, marginTop: 12 }}>Maze seed</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 0)}
                style={{ ...select, flex: 1 }}
              />
              <button onClick={reseed} style={btn}>🎲</button>
            </div>
          </div>

          <div style={{ ...panel, display: 'flex', gap: 8 }}>
            <button onClick={() => setPlaying((p) => !p)} disabled={solved} style={{ ...btn, flex: 1 }}>
              {playing ? '⏸ Pause' : '▶ Run'}
            </button>
            <button onClick={() => { setPlaying(false); step(1); }} disabled={solved} style={btn}>Step</button>
            <button onClick={() => { setPlaying(false); reset(); init({ seed, cols: MAZE_SIZE, rows: MAZE_SIZE }, config); step(0); }} style={btn}>Reset</button>
          </div>

          <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => setShowReplay(true)}
              disabled={!latestReplay || latestReplay.length === 0}
              style={{ ...btn, width: '100%' }}
            >
              🔬 Dissect last generation
            </button>
            <button onClick={() => setShowSettings((s) => !s)} style={{ ...btn, width: '100%' }}>
              {showSettings ? '▾ Hide EA settings' : '⚙ EA settings'}
            </button>
          </div>

          {showSettings && (
            <MazeEASettingsPanel
              config={config}
              onConfigChange={(patch) => setTuning((t) => ({ ...t, ...patch }))}
            />
          )}

          <div style={panel}>
            <FitnessChart series={chartSeries} yMax={1} compact />
          </div>
        </div>
      </div>

      {showReplay && latestReplay && (
        <MazeEAReplayOverlay frames={latestReplay} problem={problem} onClose={() => setShowReplay(false)} />
      )}
    </div>
  );
}
