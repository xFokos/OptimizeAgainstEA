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

## Open questions (next time)

1. **Fitness scope:** ship Euclidean + geodesic + length-penalty first and add novelty
   search later, or build novelty in from the start as the headline feature?
2. **Interaction depth for v1:** include per-generation operator dissection (BattleShips
   phase replay), or v1 = just step/run + watch population trails converge + fitness
   dropdown?
3. **Maze size/seed:** fixed handcrafted mazes vs procedurally generated with a visible
   seed. (Reproducible seed matters a lot for the fitness-comparison demo.)

## Next step

Once the 3 open questions are answered → draft a full implementation plan.