# CLAUDE.md — OptimizeAgainstEA

## Project overview

A React + TypeScript web game called **OPTIMA** — a "Schiffe Versenken"-style search-space exploration game. Players probe a hidden function surface to find its global minimum, competing against or learning from an Evolutionary Algorithm (EA).

Three modes: **Create**, **Play**, **Vs EA**.

---

## Code style rules

- Always write `type` in front of type-only imports: `import type { Foo } from '...'`
- Only import React if JSX transform requires it (i.e. if using `React.something` explicitly) — otherwise omit it
- Use `function` declarations for components, not arrow functions assigned to `const`
- Prefer `const` for engine/utility functions
- No `any` — always type callback parameters explicitly

---

## File structure

```
src/
├── app/
│   ├── page.tsx                   # Entry point, GameMode router
│   └── styles.css                 # Single global stylesheet — all CSS lives here
│
├── types/
│   ├── map.ts                     # Coordinate, Minimum, MapConfig, ProblemInstance, ProbeResult
│   ├── game.ts                    # GameMode, CreateStep
│   └── ea.ts                      # Individual, Generation, EAConfig, operator types,
│                                  # WorkerInMessage, WorkerOutMessage, DEFAULT_EA_CONFIG
│
├── engine/
│   ├── colorScale.ts              # sampleGradient(t), sampleGradientRgb(t) — shared colour ramp
│   ├── contours.ts                # Marching squares — buildContours(evaluate, levels, resolution)
│   ├── functionSurface.ts         # createMapProblem(config): ProblemInstance
│   ├── geometry.ts                # euclideanDistance, isWithinRadius, closestMinimumDistance
│   ├── mapCodec.ts                # encodeMap, decodeMap, generateRandomMap
│   └── ea/
│       ├── individual.ts          # createRandom, evaluate, clamp
│       ├── operators.ts           # SELECTION_STRATEGIES, CROSSOVER_STRATEGIES, MUTATION_STRATEGIES
│       ├── evolutionaryAlgorithm.ts  # createEAStepper, runEA, StepResult, EAStepper
│       ├── eaReplayLog.ts         # ReplayFrame union, buildReplayFrames, snapshot
│       └── ea.worker.ts           # Web Worker — handles START / STEP / STOP messages
│
├── hooks/
│   ├── useGameMap.ts              # Create mode map state (minima, addMinimum, getCode, etc.)
│   ├── usePlaySession.ts          # Play session (probes, status, bestProbe, probe, reset)
│   ├── useEARunner.ts             # Worker interface (init, step, stop, reset, latestReplay)
│   └── useEAReplay.ts             # Replay playback state machine (next, prev, play, pause)
│
└── components/game/
    ├── shared/
    │   ├── GameMap.tsx            # Reusable map canvas — evaluateFn, revealPoints, exclusionRadius
    │   ├── ContourLayer.tsx       # SVG contour lines — ContourConfig, DEFAULT_CONTOUR_CONFIG
    │   ├── HeatmapLayer.tsx       # Canvas heatmap — HeatmapConfig, DEFAULT_HEATMAP_CONFIG
    │   ├── FitnessChart.tsx       # SVG line chart — FitnessSeries[], hoveredIndex, onHover
    │   ├── ModeSelector.tsx       # Landing screen with 3 mode cards
    │   └── CodeModal.tsx          # Displays shareable map code
    │
    ├── create/
    │   ├── CreateMode.tsx         # Orchestrator: place → pick-global → done
    │   ├── MinimumPlacer.tsx      # Step 1 — click to place minima, exclusion rings shown
    │   └── GlobalMinimumPicker.tsx # Step 2 — click a dot to mark it global
    │
    ├── play/
    │   ├── PlayMode.tsx           # Orchestrator: MapLoader → active play with chart
    │   ├── MapLoader.tsx          # Paste code or generate random map
    │   ├── ProbeMarker.tsx        # Individual probe dot — isHovered, onHover
    │   └── WinOverlay.tsx         # Shown on win — probe count + best value
    │
    └── vs-ea/
        ├── VsEAMode.tsx           # Orchestrator: DualMapLoader → side-by-side race
        ├── EASettingsPanel.tsx    # Slide-in settings drawer (all EAConfig sliders/selects)
        ├── EAReplayOverlay.tsx    # Full-screen replay modal — PhaseMap + PhasePanel router
        └── replay/
            ├── ReplayMap.tsx      # Map with individual dots, highlight/dim/arrow support
            └── IndividualList.tsx # Sortable individual list with role badges
```

---

## Key abstractions

### ProblemInstance
```ts
interface ProblemInstance {
  evaluate: (x: number, y: number) => number;  // 0 = global min, 1 = far away
  bounds:   { xMin: number; xMax: number; yMin: number; yMax: number };
  isWin:    (x: number, y: number) => boolean;
  metadata?: { name?: string; globalMinimum?: { x: number; y: number; value: number } };
}
```
All game modes only ever hold a `ProblemInstance` — never a raw `MapConfig`. This is what makes swapping to analytic functions (Rastrigin, Ackley, etc.) a one-line change in future.

### GameMap props (important ones)
```ts
evaluateFn?:     EvalFn          // triggers ContourLayer or HeatmapLayer
revealPoints?:   Coordinate[]    // contours/heatmap only shown inside circles around these
exclusionRadius?: number         // normalized — draws dashed rings in create mode
defaultVizMode?: 'contour' | 'heatmap'  // toggle button appears inside map
```

### useEARunner
```ts
const ea = useEARunner();
ea.init(mapConfig, eaConfig);   // creates worker, sends START — does NOT run yet
ea.step(n);                      // advances n generations, triggers STEP message
ea.start(mapConfig, eaConfig);  // runs freely to completion (standalone mode)
ea.stop(); ea.reset();
// State: status, generations, currentGeneration, best, totalGenerations, latestReplay
```

### EAStepper (inside worker)
- `step(0)` — returns current state without advancing
- `step(n)` — breeds n generations, returns last `StepResult` with optional `replay` frames
- Win condition: `WIN_POPULATION_FRACTION` (10%) of population inside win radius simultaneously

---

## Tunable constants (single source of truth)

| File | Constant | Default | Effect |
|---|---|---|---|
| `styles.css` `:root` | `--map-max-width` | `480px` | Map square size everywhere |
| `styles.css` `:root` | `--play-sidebar-width` | `160px` | Play mode sidebar |
| `styles.css` `:root` | `--play-chart-width` | `500px` | Fitness chart column width |
| `functionSurface.ts` | `DISTANCE_SCALE` | `0.25` | How fast values rise with distance |
| `functionSurface.ts` | `LOCAL_MIN_FLOOR_MIN` | `0.08` | Min floor for local minima |
| `functionSurface.ts` | `LOCAL_MIN_FLOOR_MAX` | `0.25` | Max floor for local minima |
| `evolutionaryAlgorithm.ts` | `WIN_POPULATION_FRACTION` | `0.10` | % of pop needed in win radius |
| `FitnessChart.tsx` | `W`, `H_FULL`, `H_COMPACT` | `400`, `140`, `90` | Chart aspect ratio |
| `ContourLayer.tsx` | `DEFAULT_CONTOUR_CONFIG` | see file | lineCount, spacingExponent, resolution |
| `HeatmapLayer.tsx` | `DEFAULT_HEATMAP_CONFIG` | see file | resolution, opacity, valueExponent |
| `replay/ReplayMap.tsx` | `DOT_MOVE_DURATION` | `0.8s` | How fast replay dots glide to new positions |
| `EAReplayOverlay.tsx` | `play(1200)` arg | `1200` (ms) | Dwell time per frame during replay autoplay |
| `useGameMap.ts` | `MAX_MINIMA`, `MIN_SPACING` | `12`, `0.12` | Create mode limits |
| `VsEAMode.tsx` | `gensPerProbe` (state, default 1) | 1 | EA gens per player probe (in EA settings panel) |
| `types/ea.ts` | `DEFAULT_EA_CONFIG` | see file | populationSize, crossoverRate, etc. |

---

## EA configuration

`DEFAULT_EA_CONFIG` in `types/ea.ts`:
```ts
populationSize:   40
maxGenerations:   200
crossoverRate:    0.8
mutationRate:     0.3
mutationStrength: 0.25
mutationDecay:    0.97      // strength × decay each generation
selectionStrategy: 'tournament'   // | 'roulette' | 'elitist'
crossoverStrategy: 'arithmetic'   // | 'uniform' | 'singlePoint'
mutationStrategy:  'gaussian'     // | 'uniform' | 'cauchy'
```

All of these are exposed in the **EA Settings panel** (slide-in drawer on the DualMapLoader screen in Vs EA mode). `gensPerProbe` is also there.

---

## Map codec

Maps encode to a compact base64 URL-safe string. Format (v1):
```json
{ "v": 1, "id": "ABC123", "m": [[x, y, isGlobal], ...], "wr": 0.04, "t": timestamp }
```
Win radius (`wr`) is normalized — `0.04` means 4% of map width.

---

## Visualization

### Colour scale (`colorScale.ts`)
Single shared gradient: **violet → blue → cyan → green → yellow → orange → deep red**
Used by both `ContourLayer` and `HeatmapLayer`. Edit the `STOPS` array to retheme both.

### Contour lines (`ContourLayer.tsx`)
- Levels generated with power curve: `t^spacingExponent` — denser near minima (low values)
- Major levels (near 0.1, 0.2 … 0.9) get thicker strokes + value labels
- `revealPoints` clips to circular windows via SVG `<clipPath>`

### Heatmap (`HeatmapLayer.tsx`)
- Canvas rendered at `resolution × resolution` pixels
- `valueExponent` compresses the colour range near minima
- Same `revealPoints` masking as ContourLayer

### FitnessChart (`FitnessChart.tsx`)
- Pure SVG, no external dependencies
- `hoveredIndex` / `onHover` wired bidirectionally to `ProbeMarker` on the map
- `compact` prop = shorter height for sidebar use
- In Vs EA: 3 series — You (green), EA mean (yellow), EA best (orange)

---

## Replay system

After each `ea.step(n)` in Vs EA mode, the worker emits a `REPLAY` message alongside `GENERATION`. `useEARunner` stores this as `latestReplay: ReplayFrame[]`.

A **"▶ Watch Last Replay"** button appears in the EA panel after the first probe. Clicking it opens `EAReplayOverlay` — a full-screen modal with:
- **Left**: `ReplayMap` — population dots coloured by fitness, with highlight/dim/arrow for each phase
- **Right**: `IndividualList` — sortable list with role badges (ELITE / PARENT A / PARENT B / CHILD / WIN)
- **Top**: headline + description auto-generated from phase + actual position values
- **Bottom**: prev / play-pause / next controls + progress bar

Phases in order: `initial` → `sorted` → `elite` → `breeding` → `mutating` → `newGen` → `winCheck`

---

## Known issues / open TODOs

- `VsEAMode.tsx` line ~8: import path `'../../../hooks/useEARunner'` may need adjustment depending on actual project folder structure (project is inside `src/modules/BattleShips/` based on error messages)
- The `_g` / `g` implicit `any` type errors on the `chartSeries` filter/map callbacks — fix by typing the Generation parameter explicitly: `(g: Generation)` using the imported `Generation` type from `'../../../types/ea'`
- Replay system only shows one breeding example per generation (the first non-elite child) — could be extended to show all children

---

## What's not built yet

- **Vs EA visualization** of genotype/phenotype (population overlay on map) — architecture planned: show all 40 individuals as dots on the EA map panel, colored by fitness using the same gradient
- **Analytic function problems** (Rastrigin, Ackley, Rosenbrock) — `ProblemInstance` interface is already future-proof, just needs `createFunctionProblem(fn)` in `engine/functionProblem.ts`
- **EA configuration exposed in-game for Create mode** — currently only available in Vs EA settings
- **Mobile layout** — breakpoints exist but not tested below 640px

---

## How the EA works (step by step)

1. **Init**: 40 random individuals placed across the map, each evaluated immediately
2. **Sort**: population sorted best-first (lowest fitness = best)
3. **Elitism**: top 5% (≥1) copied unchanged into next generation
4. **Breed** (repeated until population full):
    - **Select** parent A and B via tournament (3 random candidates, fittest wins)
    - **Crossover** (if `rng() < crossoverRate`): arithmetic blend `α×A + (1-α)×B`
    - **Mutate** (if `rng() < mutationRate`): gaussian offset, strength decays by 0.97/gen
    - **Clamp** to [0,1] bounds, **evaluate**
5. **Win check**: if ≥10% of population inside win radius → solved
6. Repeat from step 2

The EA advances exactly `gensPerProbe` generations each time the player places a probe, enabling real-time competition.