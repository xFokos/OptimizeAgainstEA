# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from `OptimizeAgainstEAApp/`:

```bash
npm run dev       # dev server (Vite HMR)
npm run build     # tsc -b && vite build
npm run lint      # eslint
npm run preview   # preview production build
```

---

## Project overview

A React + TypeScript educational web app that teaches optimization concepts through games. Multiple mini-games each visualize a different algorithm:

| Route | Module | Concept |
|---|---|---|
| `/BattleShips` | `modules/BattleShips/` | Search-space exploration vs EA |
| `/ShooterGame` | `modules/shooterGame/` | Genetic algorithm evolving shooter agents |
| `/TravelingSalesman` | `modules/tspGame/` | TSP game |
| `/MapGame` | `modules/mapGame/` | Map-based analytics game |
| `/lobby/shooter` | `pages/lobby/` | Shooter lobby |

Global state: `SettingsProvider` wraps all routes in `App.tsx` (`src/context/SettingsContext.tsx`).

---

## Code style rules

- Always write `type` in front of type-only imports: `import type { Foo } from '...'`
- Only import React if JSX transform requires it (i.e. if using `React.something` explicitly) — otherwise omit it
- Use `function` declarations for components, not arrow functions assigned to `const`
- Prefer `const` for engine/utility functions
- No `any` — always type callback parameters explicitly

---

## Actual file structure

Each game lives in its own module under `src/modules/`. The BattleShips and ShooterGame modules are the most developed.

```
src/
├── App.tsx                        # Route table — all pages registered here
├── context/SettingsContext.tsx    # Global settings (wraps all routes)
├── components/
│   ├── layout/
│   │   ├── GameLayout.tsx         # Three-column shell (leftBar | canvas | sidebar); exports LAYOUT tokens
│   │   ├── ShooterLeftBar.tsx     # Left nav bar for shooter game
│   │   ├── PageContainer.tsx      # Full-viewport wrapper
│   │   └── SidePanel.tsx
│   ├── ui/                        # Shared UI primitives
│   └── settings/EASettings.tsx
│
├── hooks/useScaledCanvas.ts       # Scales a canvas to fit available space given sidebar widths
│
├── modules/
│   ├── BattleShips/               # BattleShips game — see "BattleShips module" section
│   ├── shooterGame/               # Shooter game — see "ShooterGame module" section
│   ├── tspGame/
│   ├── mapGame/
│   └── selectProblemPage/
│
└── pages/                         # Thin page components — assemble modules into layouts
```

---

## BattleShips module (`src/modules/BattleShips/`)

A "Schiffe Versenken"-style search-space exploration game. Players probe a hidden function surface to find its global minimum, competing against or learning from an Evolutionary Algorithm (EA).

Three modes: **Create**, **Play**, **Vs EA**.

### Sub-structure

```
BattleShips/
├── types/
│   ├── map.ts      # Coordinate, Minimum, MapConfig, ProblemInstance, ProbeResult
│   ├── game.ts     # GameMode, CreateStep
│   └── ea.ts       # Individual, Generation, EAConfig, WorkerInMessage/Out, DEFAULT_EA_CONFIG
│
├── engine/
│   ├── colorScale.ts          # sampleGradient(t) — shared colour ramp (violet→red)
│   ├── contours.ts            # Marching squares — buildContours(evaluate, levels, resolution)
│   ├── functionSurface.ts     # createMapProblem(config): ProblemInstance
│   ├── geometry.ts            # euclideanDistance, isWithinRadius, closestMinimumDistance
│   ├── mapCodec.ts            # encodeMap, decodeMap, generateRandomMap
│   └── ea/
│       ├── individual.ts          # createRandom, evaluate, clamp
│       ├── operators.ts           # SELECTION_STRATEGIES, CROSSOVER_STRATEGIES, MUTATION_STRATEGIES
│       ├── evolutionaryAlgorithm.ts  # createEAStepper, runEA, StepResult, EAStepper
│       ├── eaReplayLog.ts         # ReplayFrame union, buildReplayFrames, snapshot
│       └── ea.worker.ts           # Web Worker — handles START / STEP / STOP messages
│
├── hooks/
│   ├── useGameMap.ts      # Create mode map state (minima, addMinimum, getCode, etc.)
│   ├── usePlaySession.ts  # Play session (probes, status, bestProbe, probe, reset)
│   ├── useEARunner.ts     # Worker interface (init, step, stop, reset, latestReplay)
│   └── useEAReplay.ts     # Replay playback state machine (next, prev, play, pause)
│
├── components/game/
│   ├── shared/            # GameMap, ContourLayer, HeatmapLayer, FitnessChart, ModeSelector, CodeModal
│   ├── create/            # CreateMode → MinimumPlacer → GlobalMinimumPicker
│   ├── play/              # PlayMode → MapLoader + ProbeMarker + WinOverlay
│   └── vs-ea/             # VsEAMode, EASettingsPanel, EAReplayOverlay, replay/ReplayMap + IndividualList
│
└── hints/                 # Hint system — see "Hint system" section
```

### Key abstractions

**ProblemInstance** — the only thing game modes ever hold (never a raw `MapConfig`):
```ts
interface ProblemInstance {
  evaluate: (x: number, y: number) => number;  // 0 = global min, 1 = far away
  bounds:   { xMin: number; xMax: number; yMin: number; yMax: number };
  isWin:    (x: number, y: number) => boolean;
  metadata?: { name?: string; globalMinimum?: { x: number; y: number; value: number } };
}
```

**GameMap props (important ones)**:
```ts
evaluateFn?:      EvalFn          // triggers ContourLayer or HeatmapLayer
revealPoints?:    Coordinate[]    // contours/heatmap only shown inside circles around these
exclusionRadius?: number          // normalized — draws dashed rings in create mode
defaultVizMode?:  'contour' | 'heatmap'
```

**useEARunner**:
```ts
ea.init(mapConfig, eaConfig);   // creates worker, sends START — does NOT run yet
ea.step(n);                      // advances n generations
ea.start(mapConfig, eaConfig);  // runs freely to completion
// State: status, generations, currentGeneration, best, totalGenerations, latestReplay
```

### BattleShips EA configuration

`DEFAULT_EA_CONFIG` in `types/ea.ts`:
```ts
populationSize:   40
maxGenerations:   200
crossoverRate:    0.8
mutationRate:     0.3
mutationStrength: 0.25
mutationDecay:    0.97
winPopulationFraction: 0.10
selectionStrategy: 'tournament'  // | 'roulette' | 'elitist'
crossoverStrategy: 'arithmetic'  // | 'uniform' | 'singlePoint'
mutationStrategy:  'gaussian'    // | 'uniform' | 'cauchy'
```

### Map codec

Base64 URL-safe string, format v1:
```json
{ "v": 1, "id": "ABC123", "m": [[x, y, isGlobal], ...], "wr": 0.04, "t": timestamp }
```
`wr` = win radius, normalized (0.04 = 4% of map width).

### Replay system

After each `ea.step(n)`, the worker emits `REPLAY` frames alongside `GENERATION`. `useEARunner` stores this as `latestReplay: ReplayFrame[]`.

Phases in order: `initial` → `sorted` → `elite` → `breeding` → `mutating` → `newGen` → `winCheck`

`EAReplayOverlay` is a full-screen modal with `ReplayMap` (population dots) on the left and `IndividualList` (sortable with role badges: ELITE / PARENT A / PARENT B / CHILD / WIN) on the right.

### How the BattleShips EA works

1. **Init**: 40 random individuals, immediately evaluated
2. **Sort**: best-first (lowest fitness = best)
3. **Elitism**: top 5% (≥1) copied unchanged
4. **Breed**: tournament select parents → arithmetic crossover → gaussian mutate → clamp → evaluate
5. **Win check**: ≥10% of population inside win radius → solved
6. Repeat. EA advances exactly `gensPerProbe` generations per player probe.

---

## ShooterGame module (`src/modules/shooterGame/`)

A top-down shooter where a genetic algorithm evolves agent behaviour across rounds. The player fights agents whose DNA is evolved each generation using the player's prior round as training data.

### Sub-structure

```
shooterGame/
├── shooter.types.ts     # ★ All types, constants (ARENA, GAME_CONFIG, DNA_INDEX, STARTER_DNA)
├── game/
│   ├── core/
│   │   ├── vec.ts        # 2D vector math (add, sub, scale, normalize, angle, clamp, perpendicular, …)
│   │   ├── gameLoop.ts   # Pure update(state, dt, input) → GameState; no React deps
│   │   └── renderer.ts   # Canvas draw calls
│   ├── entities/         # player.ts, agent.ts, bullet.ts (mostly thin helpers)
│   ├── ga/
│   │   ├── fitness.ts         # calculateFitness(stats) → number
│   │   ├── population.ts      # initPopulation, updatePopulationStats
│   │   └── evolution.ts       # evolve, getNextAgent, presimulate, presimulateAgainstGhost
│   └── gameStore.ts           # Custom observable store — holds GameState outside React
├── hooks/
│   ├── useGameLoop.ts    # requestAnimationFrame loop, calls update(), drives gameStore
│   └── useInput.ts       # Keyboard + mouse → InputState
├── components/
│   ├── ShooterCanvas.tsx # Main canvas component; reads gameStore
│   └── dnaDisplay.tsx    # DNADisplay — subscribes to gameStore, shows current agent DNA
├── lobby/                # Lobby-related components
└── settings/ShooterSettings.tsx
```

### ShooterGame key types (`shooter.types.ts`)

**DNA** — `number[]` of length 7. Genes (all 0–1):
| Index | Name | Meaning |
|---|---|---|
| 0 | `AGGRESSION` | How strongly the agent chases the player |
| 1 | `DODGE_WEIGHT` | Bullet avoidance strength |
| 2 | `SHOOT_ACCURACY` | Aim accuracy (1 = perfect) |
| 3 | `PREFERRED_RANGE` | Preferred combat distance (× 300px + 100px) |
| 4 | `MOVEMENT_SPEED` | Speed bonus (40 base + gene × 80 px/s) |
| 5 | `PREDICT_LEAD` | Lead factor when aiming at the player |
| 6 | `FIRE_RATE` | Fire rate (higher = faster) |

**GamePhase**: `'idle' | 'playing' | 'roundEnd' | 'evolving'`

**`gameStore`** — custom observable (not Zustand/Redux). Components subscribe via `gameStore.subscribe(cb)` and read `gameStore.state` directly. `DNADisplay` and `ShooterCanvas` both use this pattern.

### ShooterGame evolution

- After each round, `evolve()` runs: tournament selection → single-point crossover → per-gene mutation
- `presimulate(generations)` runs a round-robin simulation (every agent vs every other) to pre-warm a population
- `presimulateAgainstGhost(generations, ghost)` evolves against a recording of the player's previous round — agents adapt to the specific player's style
- `PlayerGhostFrame[]` is accumulated during each round in `gameLoop.ts` and stored in `GameState.ghostFrames`

### Layout shell (`src/components/layout/GameLayout.tsx`)

`GameLayout` provides the three-column shell used by `ShooterGamePage`. Export `LAYOUT` for sizing arithmetic:

```ts
export const LAYOUT = {
  SPACING:      16,
  LEFT_BAR:     240,   // width of left icon bar
  RIGHT_PANEL:  160,   // width of right sidebar
  BORDER_COLOR: 'rgba(255,255,255,0.06)',
  BG_PANEL:     'rgba(0,0,0,0.25)',
} as const;
```

Pass the combined sidebar width to `useScaledCanvas` so the canvas scales correctly:
```ts
useScaledCanvas({ baseWidth: ARENA.WIDTH, baseHeight: ARENA.HEIGHT,
  sidebarWidth: LAYOUT.LEFT_BAR + LAYOUT.RIGHT_PANEL + LAYOUT.SPACING * 2 })
```

---

## Hint system (`src/modules/BattleShips/hints/`)

Page-wide, toggleable contextual help. Wrapped around the BattleShips page via `<HintsProvider>`.

```
hints/
├── hintContent.ts    # ★ ONLY file to edit for hint text/settings
├── HintContext.tsx   # HintsProvider + useHints() hook; localStorage/sessionStorage persistence
├── HintLayer.tsx     # Renders active global hint (modal or toast). Mount once at root.
├── HintToggle.tsx    # 💡 on/off button + ↻ Reset
└── HintPopover.tsx   # Anchored coachmark — wraps any element to pin a hint to it
```

**HintDef** (in `hintContent.ts`):
```ts
{ title?, body, style: 'modal'|'toast', once?, pauses? }
```
`pauses: true` blocks interaction behind a backdrop until user clicks a button.

**Firing a hint**:
```ts
const { showHint, dismiss } = useHints();
showHint('vsEa.afterProbe', { vars: { gens: '5' }, actions: [...] });
// no-ops when disabled or already seen (for `once` hints)
```

**Anchored hint**:
```tsx
<HintPopover id="vsEa.replayButton" placement="top" show={canReplay}>
  <button>▶ Watch Last Replay</button>
</HintPopover>
```
Inside a CSS grid, wrap the child *inside* the grid item — the `HintPopover` wrapper is `display: inline-block` and becomes the grid item otherwise.

Persistence: `enabled` → `localStorage bs.hints.enabled`; `seen` → `sessionStorage bs.hints.seen` (re-arms on new session or via Reset button).

---

## Tunable constants

| File | Constant | Default | Effect |
|---|---|---|---|
| `BattleShips/engine/functionSurface.ts` | `DISTANCE_SCALE` | `0.25` | How fast values rise with distance |
| `BattleShips/engine/functionSurface.ts` | `LOCAL_MIN_FLOOR_MIN/MAX` | `0.08`/`0.25` | Local minimum floor range |
| `BattleShips/engine/ea/evolutionaryAlgorithm.ts` | `WIN_POPULATION_FRACTION` | `0.10` | Fallback win % (overridden by `EAConfig.winPopulationFraction`) |
| `BattleShips/components/game/shared/ContourLayer.tsx` | `DEFAULT_CONTOUR_CONFIG` | see file | lineCount, spacingExponent, resolution |
| `BattleShips/components/game/shared/HeatmapLayer.tsx` | `DEFAULT_HEATMAP_CONFIG` | see file | resolution, opacity, valueExponent |
| `BattleShips/components/game/vs-ea/replay/ReplayMap.tsx` | `DOT_MOVE_DURATION` | `0.8s` | Replay dot glide speed |
| `BattleShips/components/game/vs-ea/EAReplayOverlay.tsx` | `play(1200)` | `1200ms` | Dwell per frame during autoplay |
| `BattleShips/hooks/useGameMap.ts` | `MAX_MINIMA`, `MIN_SPACING` | `12`, `0.12` | Create mode limits |
| `BattleShips/hints/HintLayer.tsx` | `TOAST_DURATION` | `7000ms` | Toast auto-dismiss delay |
| `BattleShips/types/ea.ts` | `DEFAULT_EA_CONFIG` | see file | BattleShips EA defaults |
| `shooterGame/shooter.types.ts` | `GAME_CONFIG` | see file | Round duration, bullet speed, agent speeds, cooldowns |
| `shooterGame/shooter.types.ts` | `ARENA` | `800×800` | Game canvas logical size |
| `components/layout/GameLayout.tsx` | `LAYOUT` | see file | Column widths + panel colors for shooter layout |

---

## What's not built yet

- **Shooter population overlay on canvas** — show all 20 individuals as dots during evolution phase
- **Analytic function problems** (Rastrigin, Ackley, Rosenbrock) — `ProblemInstance` is already future-proof; just needs `createFunctionProblem(fn)` in `engine/functionProblem.ts`
- **Mobile layout** — breakpoints exist but not tested below 640px