# Maze Game — Design Discussion (WIP)

> Scratch design doc for a new optimization mini-game about solving mazes.
> Status: **discussion / not started**. Captured so we can resume later.
> Not part of CLAUDE.md — this is a working scratchpad.

## Concept

A grid-aligned maze that is **invisible** to the player. The player moves with the
arrow keys; moving explores the maze and reveals visited cells plus all cells they
can currently move into (fog-of-war). Goal: reach a specific target cell.

In parallel, an **Evolutionary Algorithm** solves the same maze. The point is **not**
to race — it's a **teaching exhibit**: it should be *fun to explore how an EA works*,
with strong visualization of the EA's operations and **multiple selectable fitness
functions** to show how different fitness shaping changes EA behavior.

## Decisions locked in so far

- **Framing:** teaching exhibit, not a race. Player-explores-blind is the *relatable
  baseline*; the EA exploration tooling is the payload.
- **Player vs EA overlay:** show the player's own fog-of-war trail against the EA's
  population trails — "you explored these cells by hand; here's where 40 individuals
  went in one generation." That contrast is the lesson and justifies the playable maze.
- **Multiple fitness functions** are a core feature (the main lever the maze gives us).
- **Fitness scope (v1):** ship **Euclidean + geodesic + length penalty** first; add novelty
  search later as a follow-up (it's the one that needs extra archive/behavior-descriptor
  infrastructure — don't block v1 on it).
- **Interaction depth (v1):** include the **per-operator / per-generation dissection**
  (re-skin BattleShips' phase replay). It explains *what is happening* to the player far
  better than just watching trails converge — that's the teaching payload.
- **Maze generation:** **procedurally generated from a visible seed** (no handcrafted
  mazes). Reproducibility is essential for the fitness-comparison demo — the dropdown
  re-runs the *same seeded maze* under different fitness functions.

## Why a maze is a strong EA *visualization* vehicle

In BattleShips an individual is a *point* (x,y). On a maze, an individual is a **path**
(a sequence of moves). Paths are far more legible:

- **Population as spaghetti** — draw every individual's path as a translucent trail.
  Gen 1 = chaotic scribbles; by gen N they braid into one clean line to the goal.
  Most intuitive "EA is working" image we can produce.
- **Visitation heatmap** — color each cell by how many individuals pass through it.
- **Crossover has literal geometric meaning** — single-point crossover = "follow
  parent A's route to step k, then switch to parent B's route." Draw both parents,
  mark the splice cell, show the child diverging there.
- **Mutation = a kink** — flip one move, path forks at that cell.
- **Genome legibility** — render the genome as a string of arrows (↑↑→↓→…) next to the
  path (like Shooter's `dnaDisplay.tsx`); highlight the mutated arrow / splice point.

## Genome / phenotype

- **Genome:** fixed-length move sequence (U/D/L/R). Moves into walls are ignored
  (agent stays). Discrete/categorical — contrasts nicely with BattleShips' continuous EA.
- **Operators differ from BattleShips** (can't reuse `operators.ts` wholesale):
  - Mutation = re-pick a move (not gaussian/arithmetic).
  - Crossover = single-point / uniform-point on the sequence.
  - Build a *parallel* discrete `operators.ts`; same structure, different content.
- **Genome length** must be ≥ shortest path. Auto-size from the maze's geodesic
  diameter rather than exposing a footgun.

## Fitness functions = mini-curriculum (the headline feature)

Each teaches one distinct EA concept, and on a maze the difference is *visible*:

1. **Euclidean / Manhattan to goal** → deceptive landscape. Population piles up against
   the wall nearest the goal and gets stuck. Teaches: deception, premature convergence.
2. **Geodesic to goal** (BFS distance field through corridors, precomputed at maze-gen)
   → smooth & solvable. Same EA now climbs cleanly. Teaches: fitness shaping fixes it.
3. **Novelty search** (reward visiting cells no one has visited, ignore the goal) →
   the standout. Mazes are *the* canonical novelty-search demo (Lehman & Stanley).
   Objective-chasing gets trapped; pure exploration floods the maze and finds the exit.
   "Not aiming at the goal works better?!" moment.
   - **Costs more infrastructure**: needs an archive + behavior descriptor (e.g. final
     cell reached). Others are pure scoring functions over a path.
4. **Length / efficiency penalty** (reach goal in fewest moves) → multi-objective
   tension, exploration vs exploitation, genome bloat. Optional, layers on #2.

Marquee demo: a fitness dropdown that re-runs the **same seeded maze** and lets you
watch #1 get stuck, then #3 solve it.

## Honest weak spots / caveats

- **EA isn't the "right" tool for mazes** — A* dominates. Fine for teaching EA
  *mechanics*; don't frame EA as the smart way to solve mazes.
- **Discrete genome** → parallel operator set (see above).
- **Information asymmetry:** player has fog-of-war; EA should get full maze knowledge.
  Framing: "the EA studies the whole maze, you explore blind." (Restricting the EA to
  bumped-walls-only is a lot of complexity for little payoff.)

## Fit with existing architecture (mirrors BattleShips)

`ProblemInstance` generalizes from "genome = (x,y)" to "genome = path":

- `engine/mazeGen.ts` — recursive backtracker (or Prim's).
- `engine/geodesic.ts` — BFS distance field from goal.
- `evaluate(path) → score`, `isWin(path)` — same worker/stepper/replay-log structure.
- Reuse: `useEARunner`, worker message protocol, `FitnessChart`, `ModeSelector`.
- Replay overlay: BattleShips' `initial → sorted → elite → breeding → mutating →
  newGen → winCheck` phase log IS the "dissect a generation" flow — re-skin
  `ReplayMap` to draw paths instead of dots.

## Open questions — RESOLVED

1. **Fitness scope:** ✅ geodesic + length-penalty + Manhattan + **novelty** — all four in v1.
   (Novelty was originally deferred but pulled into v1; see "Key findings" below for why.)
2. **Interaction depth for v1:** ✅ include per-operator / per-generation dissection.
3. **Maze size/seed:** ✅ procedurally generated from a visible seed.
4. **Player mode:** ✅ blind arrow-key + fog-of-war IS in v1 (not deferred).

---

# Implementation status (as of 2026-06-24)

Full implementation plan: `~/.claude/plans/twinkly-wobbling-creek.md`.
All new code lives under `src/modules/mazeGame/`. No BattleShips file was modified.
Route is live at **`/MazeGame`** (registered in `src/App.tsx`).

## Built & validated ✅ (the EA exhibit works end-to-end)

- **Engine:** `engine/rng.ts` (seeded LCG), `engine/mazeGen.ts` (recursive backtracker +
  braiding), `engine/geodesic.ts` (BFS field + diameter), `engine/mazeProblem.ts`
  (the 4 fitness fns + auto-sized genome length).
- **Discrete EA:** `engine/ea/individual.ts` (path walk w/ goal-absorb), `operators.ts`
  (tournament/roulette/elitist · single-point/uniform crossover · point/segment mutation),
  `evolutionaryAlgorithm.ts` (stepper mirroring BattleShips), `novelty.ts` (archive +
  behavior-descriptor scorer), `eaReplayLog.ts` (path snapshots + all phase frames — already
  wired into the stepper), `maze.worker.ts`.
- **Hook + UI slice:** `hooks/useMazeEARunner.ts`, `components/shared/MazeCanvas.tsx` (SVG,
  already supports fog/player props), `components/vs-ea/MazeVsEAMode.tsx` (Run/Step/Reset,
  fitness dropdown, seed input, reuses BattleShips `FitnessChart`), `pages/MazeGamePage.tsx`.
- **Verified:** `tsc -b` exit 0, lint clean (for the new module), `vite build` bundles the
  worker. Headless sweeps confirm **all four fitness fns solve 12/12** across seeds on a
  12×12 braided maze (geodesic/length/novelty medGen ~20–45).

## Key findings that shaped the build (don't re-litigate these)

- **Fitness must score the FINAL cell with the goal absorbing**, not the closest approach.
  Closest-approach gave no gradient signal *and* let any long wander brute-force the goal,
  destroying deception. Final-cell + goal-absorb is the learnable, honest formulation.
- **Mazes are braided** (~50% of dead-ends opened, `DEFAULT_BRAID = 0.5`). A full *perfect*
  maze's corner-to-corner path is near-worst-case windy (~50 steps on 12×12), which made the
  EA unreliable. Braiding shortens solution paths, makes solving reliable, and enriches trails.
- **Novelty replaced Manhattan as the reliable "deception" headline.** Extensive sweeps showed
  geodesic-vs-Manhattan does NOT reliably produce "geodesic solves / Manhattan stuck" on
  procedural mazes — they solve at ~the same rate, because the straight-line-near cell is
  usually corridor-near too. Novelty *is* the canonical, reliable maze-deception demo. Manhattan
  stays in as a "naive objective" foil.
- **Genome length auto-sizes** to ~3.5× the geodesic diameter (clamped 30–600). Roughly half of
  random moves bump a wall (no-op), so the agent needs several times the corridor distance.

## Tasks 6–8 — DONE ✅ (as of 2026-06-25)

`tsc -b` exit 0, `eslint` clean for the module, `npm run build` bundles the maze worker.

### Task 6 — Blind player mode (fog-of-war) ✅
- `hooks/usePlayerWalk.ts`: `{ pos, visited, frontier, trail, status, move(dir), reset }`.
  `move` ignores walls/out-of-bounds; `frontier` (open neighbours) recomputed via `useMemo`; wins at goal.
- `components/play/MazePlayMode.tsx`: arrow + WASD `keydown` listener (preventDefault scroll, cleaned
  up on unmount); fog reveal = `visited ∪ frontier`; goal shown as a beacon (`goalVisible`).
  Win card overlays the canvas. **Peek / win drops the fog and overlays the EA's converged
  population trails** (lazy `useMazeEARunner`, stepped `PEEK_GENERATIONS`) against the green player route.
- `MazeCanvas` gained an optional `markers` prop (cell dots/rings) used by the replay map.
- `MazeGamePage.tsx` now has a `select | play | vs-ea` card menu (no longer jumps straight to vs-ea).

### Task 7 — Replay dissection UI ✅
- `hooks/useMazeEAReplay.ts` — playback state machine (maze-typed copy of `useEAReplay`).
- `components/vs-ea/replay/MazePathMap.tsx` — re-skin of `ReplayMap` built on `MazeCanvas`: each
  individual is a trail; highlights parent A/B, the **splice cell** (single-point), child trail and
  **mutated cells**. Exports `PATH_DRAW_DURATION_MS` (draw-on animation is a future hook — polylines
  don't tween via the CSS transition trick).
- `components/vs-ea/replay/MazeIndividualList.tsx` — genome rendered as an arrow string `↑→↓←`;
  spliced suffix + mutated genes colour-highlighted.
- `components/vs-ea/MazeEAReplayOverlay.tsx` — 1:1 port of `EAReplayOverlay`'s `PhaseMap`/`PhasePanel`
  dispatchers for the maze phase set. Self-contained CSS in `styles/MazeGameStyles.css`
  (BattleShips' CSS only loads on its own page).
- "🔬 Dissect last generation" button wired in `MazeVsEAMode` (consumes `ea.latestReplay`).

### Task 8 — Settings panel ✅
- `components/vs-ea/MazeEASettingsPanel.tsx` — SliderRow/SelectRow editors for `EAConfig` (pop size,
  max gens, win fraction, rates, mutation strength/decay, strategies). `mutationStrength` is labelled
  as a per-move flip probability. Editable `tuning` state in `MazeVsEAMode`; any change restarts the
  run on the same maze.
- Shared inline-style tokens factored into `components/shared/mazeStyles.ts` (used by all three modes).

## Optional follow-up polish (not blocking v1)
- Visitation heatmap layer on the replay/vs-ea map; stroke-dashoffset path draw-on animation.
- Expose maze size + braid as controls (currently fixed 12×12, braid 0.5).
- Hint system (mirror BattleShips' `hints/`).
- Replace inline styles with shared CSS classes (currently inline via `mazeStyles.ts`).

## Verification checklist (for v1 sign-off)
- Same seed reproduces an identical maze across reloads and fitness changes.
- Novelty reliably floods the maze and finds the exit; geodesic converges cleanly.
- Arrow keys move only through corridors; fog reveals only visited+frontier; goal beacon visible.
- Player win reveals maze + EA paths.
- Replay steps through every phase with correct parent/splice/mutation highlights; the arrow-string
  genome matches the drawn path.
- `npm run build` + `npm run lint` stay clean for the module.