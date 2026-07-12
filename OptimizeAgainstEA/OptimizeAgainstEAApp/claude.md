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

A React + TypeScript educational web app that teaches optimization concepts through games (frontend-only, hosted on Firebase; only the Raidboss mode writes to Firestore). Multiple mini-games each visualize a different algorithm:

| Route | Module | Concept |
|---|---|---|
| `/PeakFinder` | `modules/BattleShips/` | Search-space exploration vs EA ("PeakFinder") |
| `/MazeExplorer` | `modules/mazeGame/` | EA evolving paths through a maze |
| `/ShooterGame` | `modules/shooterGame/` | GA evolving shooter agents (Solo + Community Raidboss) |
| `/HordeGame` | `modules/shooterGame/horde/` | Steady-state EA: horde survival, evolution per death |
| `/HordeMapEditor` | `pages/HordeMapEditorPage.tsx` | Custom horde map editor |
| `/lobby/shooter` | `modules/shooterGame/lobby/` | Shooter lobby (mode picker + Solo/Raidboss/Horde lobbies) |
| `/Analytics` | `pages/AnalyticsPage.tsx` | Solo-Play round analytics |
| `/Dashboard` | `modules/selectProblemPage/` | Game picker |

Dev-/legacy-only routes (not linked from the UI, keep them): `/Buttons` (button style gallery), `/FunctionTuner` (function problem tuner), `/Game` ("secret" legacy page).

Global state: `SettingsProvider` wraps all routes in `App.tsx` (`src/context/SettingsContext.tsx`).

**Target platforms:** The website must work on both mobile and desktop. Any new UI or layout work should be responsive and usable on small touch screens as well as large pointer-driven displays. (See "What's not built yet" — the mobile layout is not yet fully tested below 640px.)

---

## Code style rules

- Always write `type` in front of type-only imports: `import type { Foo } from '...'`
- Only import React if JSX transform requires it (i.e. if using `React.something` explicitly) — otherwise omit it
- Use `function` declarations for components, not arrow functions assigned to `const`
- Prefer `const` for engine/utility functions
- No `any` — always type callback parameters explicitly

---

## Actual file structure

Each game lives in its own module under `src/modules/`.

```
src/
├── App.tsx                        # Route table — all pages registered here
├── context/SettingsContext.tsx    # Global settings (wraps all routes)
├── components/
│   ├── layout/
│   │   ├── GameLayout.tsx         # Three-column shell (leftBar | canvas | sidebar); exports LAYOUT tokens
│   │   ├── ShooterLeftBar.tsx     # Left nav bar for shooter game
│   │   ├── PageContainer.tsx      # Full-viewport wrapper
│   │   ├── GameModeSelectorLayout.tsx  # Fullscreen mode picker (used by the shooter lobby)
│   │   └── SidePanel.tsx
│   ├── ui/                        # Shared UI primitives (CompiTooltip, Switch, NavigatePageButton)
│   ├── help/                      # Help button + modal with Compi mascot (topics per game)
│   ├── hints/                     # Shared hint/coachmark system — see "Hint system" section
│   ├── explainer/                 # Reusable step-by-step explainer flow
│   └── settings/EASettings.tsx    # EASettingsPanel + HordeEASettingsPanel
│
├── hooks/                         # Shared hooks — see "Shared building blocks"
├── utils/                         # rng.ts (seeded LCG), listenable.ts (store observer plumbing)
├── lib/firebase.ts                # Firebase app + Firestore handle (used only by raidbossStore)
│
├── modules/
│   ├── BattleShips/               # PeakFinder game — see "BattleShips module" section
│   ├── mazeGame/                  # Maze game — structurally mirrors BattleShips (types/engine/hooks/components)
│   ├── shooterGame/               # Shooter game — see "ShooterGame module" section
│   └── selectProblemPage/         # Dashboard game picker
│
└── pages/                         # Thin page components — assemble modules into layouts
```

---

## Shared building blocks (`src/hooks/`, `src/utils/`)

Reusable, game-agnostic pieces — prefer these over per-module copies:

- **`hooks/useReplayPlayer.ts`** — `useReplayPlayer<Frame>(frames, autoplayIntervalMs?)`: playback state machine for any recorded frame list (frameIndex, currentFrame, isPlaying, next/prev/goTo/play/pause). Used by the PeakFinder EA replay, the Maze EA replay, and the generation replay.
- **`hooks/useSavedLibrary.ts`** — `useSavedLibrary<Input, Entry>(storageKey, toEntry)`: localStorage-persisted library of player creations (save de-dupes by `entry.id`, remove, rename). `useSavedMaps` (BattleShips) and `useSavedMazes` (maze) are thin domain wrappers around it.
- **`utils/listenable.ts`** — `createListenable()`: the `notify`/`subscribe` observer trio shared by every module-level singleton store (`gameStore`, `analyticsStore`, `hordeGameStore`, `hordeRunStore`, `runModsStore`, raidboss-active flag). Spread it into a store object literal; domain methods call `this.notify()`. Components subscribe directly or via `useSyncExternalStore`.
- **`utils/rng.ts`** — `makeLCG(seed?)`: seeded deterministic RNG shared by the PeakFinder/Maze EAs and maze generation.
- **`hooks/useScaledCanvas.ts`** — scales a canvas to fit available space given sidebar widths.
- **`hooks/useViewport.ts`**, **`hooks/useOrientationLock.ts`** — viewport size / mobile orientation helpers.

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
│   └── useSavedMaps.ts    # Saved-map library (wraps shared useSavedLibrary)
│   # Replay playback uses the shared src/hooks/useReplayPlayer.ts
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
│   ├── gameStore.ts           # Observable store (createListenable) — holds GameState outside React
│   ├── analyticsStore.ts      # Round records for /Analytics
│   └── raidbossStore.ts       # Firestore-backed community population (Raidboss mode)
├── horde/
│   ├── hordeEngine.ts    # Pure Horde update + per-death mini-GA (updateHorde, makeInitialState, resetHordeEngine)
│   ├── hordeRender.ts    # Canvas render for Horde (exports HC accent color)
│   ├── hordeDna.ts       # Horde-only gene layout (loop steps, size, opacity)
│   ├── hordeMaps.ts      # Built-in maps + custom map resolution
│   ├── hordePathfinding.ts  # Flow-field BFS from the player's cell
│   ├── hordeCollision.ts # Obstacle collision helpers
│   ├── hordeGameStore.ts / hordeRunStore.ts  # Run state / last-run record stores
│   └── hordeTypes.ts
├── mods/                 # Run mods (powerups): modTypes, shotEngine, runModsStore
├── hooks/
│   ├── useGameLoop.ts    # requestAnimationFrame loop, calls update(), drives gameStore
│   ├── useInput.ts       # Keyboard + mouse → InputState
│   ├── useTouchControls.ts / useTutorialStep.ts
├── components/
│   ├── ShooterCanvas.tsx # Main canvas component (Solo/Raidboss); reads gameStore
│   ├── HordeCanvas.tsx   # React wiring for Horde (game loop + overlays + tutorial)
│   ├── HordeDnaPanel.tsx # "Best DNA" side panel next to the horde canvas
│   ├── dnaDisplay.tsx    # DNADisplay — subscribes to gameStore, shows current agent DNA
│   ├── arenaAgentSim.ts  # Shared small-arena physics for tutorial preview canvases
│   └── DnaPreviewCanvas.tsx / GhostArenaVisual.tsx  # Tutorial explainer visuals
├── lobby/                # Lobby, split by concern:
│   ├── ShooterLobbyPage.tsx  # Root: mode picker + mounts the three lobbies
│   ├── NormalLobby.tsx / RaidbossLobby.tsx / HordeLobby.tsx / HordeOverview.tsx / SoloPlayOverview.tsx
│   ├── previews/         # ShooterPreview, RaidbossPreview, HordePreview, HordeMapPreview (+ previewShared)
│   ├── lobbyConstants.ts # Modes, difficulty presets, tab definitions, horde gene descriptors
│   ├── lobbyStyles.ts    # Shared inline-style objects (lobbyStyles/tabStyles/ovStyles/mobile*)
│   ├── lobbyHooks.ts     # useMobile, useZoom, enterGameFullscreen
│   ├── DnaGeneRow.tsx    # Read-only gene stat bar (Solo + Horde overviews)
│   └── TopBar.tsx
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

## Hint system (`src/components/hints/`)

Page-wide, toggleable contextual help — shared by all games. Wrap a page via `<HintsProvider>`.

```
components/hints/
├── hintContent.ts    # ★ Hint text/settings (maze adds modules/mazeGame/hints/mazeHintContent.ts)
├── HintContext.tsx   # HintsProvider + useHints() hook; localStorage/sessionStorage persistence
├── HintLayer.tsx     # Renders active global hint (modal or toast). Mount once at root.
├── HintToggle.tsx    # 💡 on/off button + ↻ Reset
├── HintPopover.tsx   # Anchored coachmark — wraps any element to pin a hint to it
├── TourSpotlight.tsx # Guided-tour spotlight (dims everything except the target element)
├── CompiBubble.tsx   # Compi mascot speech bubble (in-game tutorial steps)
└── viewportFit.ts
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
| `src/hooks/useReplayPlayer.ts` | `autoplayIntervalMs` | `1200ms` | Dwell per frame during replay autoplay (maze overlay passes 1600) |
| `BattleShips/hooks/useGameMap.ts` | `MAX_MINIMA`, `MIN_SPACING` | `12`, `0.12` | Create mode limits |
| `components/hints/HintLayer.tsx` | `TOAST_DURATION` | `7000ms` | Toast auto-dismiss delay |
| `BattleShips/types/ea.ts` | `DEFAULT_EA_CONFIG` | see file | BattleShips EA defaults |
| `shooterGame/shooter.types.ts` | `GAME_CONFIG` | see file | Round duration, bullet speed, agent speeds, cooldowns |
| `shooterGame/shooter.types.ts` | `ARENA` | `800×800` | Game canvas logical size |
| `components/layout/GameLayout.tsx` | `LAYOUT` | see file | Column widths + panel colors for shooter layout |

---

## What's not built yet

- **Shooter population overlay on canvas** — show all 20 individuals as dots during evolution phase
- **Mobile layout** — breakpoints exist but not tested below 640px

(Analytic function problems — Sphere, Rastrigin, … — exist now in `BattleShips/engine/functionProblem.ts`, tunable via `/FunctionTuner`.)