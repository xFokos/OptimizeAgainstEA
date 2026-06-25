import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMazeProblem, DEFAULT_BRAID } from '../../engine/mazeProblem';
import { DEFAULT_MAZE_EA_CONFIG } from '../../types/ea';
import type { Move } from '../../types/maze';
import { useMazeEARunner } from '../../hooks/useMazeEARunner';
import { usePlayerWalk } from '../../hooks/usePlayerWalk';
import { sampleGradientRgb } from '../../../BattleShips/engine/colorScale';
import { MazeCanvas, type MazeTrail } from '../shared/MazeCanvas';
import { btn, panel, lbl, select } from '../shared/mazeStyles';

interface MazePlayModeProps {
  onBack: () => void;
}

const MAZE_SIZE = 12;
const PLAYER_COLOR = '#4af0a0';
/** How many generations to run the EA before showing its trails in the overlay. */
const PEEK_GENERATIONS = 80;

/** Keyboard → move direction. y grows downward, so ↑ = up (north). */
const KEY_TO_MOVE: Record<string, Move> = {
  ArrowUp: 0, KeyW: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2,
  ArrowLeft: 3, KeyA: 3,
};

export function MazePlayMode({ onBack }: MazePlayModeProps) {
  const [seed, setSeed] = useState(7);
  const [showEA, setShowEA] = useState(false);

  const problem = useMemo(
    () => createMazeProblem({ cols: MAZE_SIZE, rows: MAZE_SIZE, seed, fitnessFnId: 'geodesic', braid: DEFAULT_BRAID }),
    [seed],
  );

  const player = usePlayerWalk(problem.grid, problem.start, problem.goal);
  const { move, reset: resetPlayer, status, visited, frontier, trail } = player;

  const won = status === 'won';
  const revealEA = showEA || won;

  // Arrow-key / WASD listener. preventDefault stops the page scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_TO_MOVE[e.code];
      if (dir === undefined) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  // A new maze means a fresh walk (start/goal are size-based, so reset is safe).
  useEffect(() => {
    resetPlayer();
    setShowEA(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  // EA runner — only spun up once the player asks to peek (or wins).
  const ea = useMazeEARunner();
  const { init, step, currentGeneration } = ea;
  useEffect(() => {
    if (!revealEA) return;
    init({ seed, cols: MAZE_SIZE, rows: MAZE_SIZE }, { ...DEFAULT_MAZE_EA_CONFIG, fitnessFnId: 'geodesic' });
    step(PEEK_GENERATIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealEA, seed]);

  // Fog reveals only visited ∪ frontier — unless the EA overlay is shown, where
  // we drop the fog so the EA's whole-maze knowledge reads against the player's.
  const fog = useMemo(() => {
    if (revealEA) return undefined;
    const r = new Set(visited);
    frontier.forEach((i) => r.add(i));
    return r;
  }, [visited, frontier, revealEA]);

  // Player route in green; EA population spaghetti underneath when revealed.
  const trails: MazeTrail[] = useMemo(() => {
    const out: MazeTrail[] = [];
    if (revealEA) {
      const inds = currentGeneration?.individuals ?? [];
      inds.forEach((ind) => out.push({
        points: ind.walk.trail, color: sampleGradientRgb(ind.fitness), opacity: 0.1, width: 0.08,
      }));
    }
    out.push({ points: trail, color: PLAYER_COLOR, opacity: 0.95, width: 0.16 });
    return out;
  }, [trail, revealEA, currentGeneration]);

  const reseed = useCallback(() => { setShowEA(false); setSeed(Math.floor(Math.random() * 100000)); }, []);
  const restart = useCallback(() => { setShowEA(false); resetPlayer(); }, [resetPlayer]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: 24, color: '#e8eaf0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onBack} style={btn}>← Back</button>
        <h2 style={{ margin: 0, fontSize: 20 }}>Maze — explore blind</h2>
        <span style={{ marginLeft: 'auto', opacity: 0.7, fontSize: 13 }}>
          {won ? <b style={{ color: PLAYER_COLOR }}>Reached the goal!</b> : `${trail.length - 1} steps`}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div style={{ position: 'relative' }}>
          <MazeCanvas
            cols={problem.cols}
            rows={problem.rows}
            walls={problem.grid.walls}
            start={problem.start}
            goal={problem.goal}
            trails={trails}
            fog={fog}
            playerPos={player.pos}
            goalVisible
          />
          {won && (
            <div style={winCard}>
              <div style={{ fontSize: 22, fontWeight: 700, color: PLAYER_COLOR }}>You reached the goal 🎉</div>
              <div style={{ opacity: 0.8, fontSize: 14, marginTop: 6 }}>
                You explored {visited.size} cells by hand in {trail.length - 1} steps. The faint
                trails show where one EA generation went — with full knowledge of the maze.
              </div>
              <button onClick={restart} style={{ ...btn, marginTop: 14 }}>Play again</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={panel}>
            <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
              Move with the <b>arrow keys</b> or <b>WASD</b>. The maze is hidden — you only see
              cells you have visited and the corridors leading out of where you stand. Find the
              gold goal beacon.
            </div>
          </div>

          <div style={panel}>
            <label style={lbl}>Maze seed</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                value={seed}
                onChange={(e) => { setShowEA(false); setSeed(Number(e.target.value) || 0); }}
                style={{ ...select, flex: 1 }}
              />
              <button onClick={reseed} style={btn}>🎲</button>
            </div>
          </div>

          <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button onClick={restart} style={btn}>↻ Restart this maze</button>
            <button onClick={() => setShowEA((s) => !s)} disabled={won} style={btn}>
              {revealEA ? '🙈 Hide EA trails' : '👁 Peek at EA solution'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const winCard: React.CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32,
  background: 'rgba(8,9,14,0.82)', borderRadius: 8,
};
