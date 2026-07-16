# Optimize Against EA

An educational web app that teaches **optimization concepts** (in particular Evolutionary Algorithms) through a collection of interactive mini-games. Players explore search spaces, compete against or learn from an EA, and watch how populations evolve toward an optimum.

Built with **React 19 + TypeScript + Vite**.


---

## Authors

| Name | Email | Student ID |
|---|---|---|
| Philipp Sehne | Philipp.Sehne@stud-mail.uni-wuerzburg.de | s511696 |
| David Ahrens | David.Ahrens@stud-mail.uni-wuerzburg.de | s511500 |

Gitlab: https://gitlab2.informatik.uni-wuerzburg.de/GE/Teaching/gl2/projects/2025/b-ahrens-und-sehne
Github: https://github.com/xFokos/OptimizeAgainstEA.git

---

## Presentation of results

> https://optimizeagainstea.web.app

A live deployment is configured via Firebase Hosting (Firebase project `optimizeagainstea`).

---

## What's inside

The app is a single React SPA with multiple routed mini-games:

| Route | Game | Concept |
|---|---|---|
| `/PeakFinder` | **Peak Finder** | Probe a hidden function surface (14 analytic benchmark functions, largely from the BBOB suite, or procedurally generated maps) to find its global minimum — play solo, create your own maps, or race a configurable EA with a full step-by-step replay viewer |
| `/MazeExplorer` | **Maze Explorer** | A GA evolves move sequences through a maze — an experimentation playground for EA parameters on a combinatorial problem |
| `/ShooterGame` | **Shooter Game** | A genetic algorithm evolves enemy agent behaviour each round, adapting to the player's style (Solo + community Raidboss mode) |
| `/HordeGame` | **Horde Mode** | Steady-state EA: a horde of enemies evolves per death while the player survives; includes a custom map editor (`/HordeMapEditor`) |

Supporting routes: `/` (home), `/Dashboard` (game selection), `/lobby/shooter` (shooter mode picker), `/Analytics` (Solo-play round analytics). Dev-/legacy-only routes (not linked from the UI): `/Buttons`, `/FunctionTuner`, `/Game`.

Shared infrastructure across all games: a toggleable hint/coachmark system with the "Compi" mascot, per-game tutorials, an "EA Explained" teaching section, and EA settings panels (population size, generations, crossover/mutation rates, mutation strength & decay, and selection/crossover/mutation strategies).

---

## Software environment

- **Runtime:** A modern web browser (latest Chrome / Firefox / Edge / Safari). The app runs entirely client-side.
- **Build toolchain:** [Node.js](https://nodejs.org/) (developed and tested with **Node v24.x**; Node 20+ should also work) and npm.
- **No joypad / gamepad required.** All games are played with **touch and mouse** 

---

## How to build and run

All commands are run from the app directory:

```bash
cd OptimizeAgainstEA/OptimizeAgainstEAApp
```

### 1. Install dependencies

```bash
npm install
```

### 2. Run in development (hot reload)

```bash
npm run dev
```

Vite prints a local URL (default http://localhost:5173). Open it in your browser.

### 3. Build a production bundle

```bash
npm run build      # runs: tsc -b && vite build
```

The compiled, runnable output (the "binary") is written to `OptimizeAgainstEAApp/dist/`. It is a set of static files.

### 4. Preview / run the production build locally

```bash
npm run preview
```

This serves the contents of `dist/` locally so you can run the built app exactly as it would be deployed. Because the output is plain static files, `dist/` can also be served by any static web server.

### Lint

```bash
npm run lint       # eslint
```

### Deployment (optional)

The repo is set up for **Firebase Hosting** (`OptimizeAgainstEA/firebase.json`, serving `OptimizeAgainstEAApp/dist`). After a build:

```bash
# from OptimizeAgainstEA/
firebase deploy
```

> Note: deployment requires the Firebase CLI and access to the `optimizeagainstea` Firebase project.

---

## External code, libraries, packages and assets

This project is bootstrapped from the official **Vite `react-ts` template** (React + TypeScript + Vite).

### Runtime dependencies

| Package | Purpose | License |
|---|---|---|
| [`react`](https://react.dev/) / `react-dom` (^19) | UI framework | MIT |
| [`react-router-dom`](https://reactrouter.com/) (^7) | Client-side routing | MIT |
| [`recharts`](https://recharts.org/) (^3) | Charts (e.g. fitness graphs) | MIT |

### Development dependencies

Vite, TypeScript, ESLint (with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`), `@vitejs/plugin-react`, and associated type packages — all MIT-licensed. See `OptimizeAgainstEAApp/package.json` for exact versions.

### Assets

All bundled image assets, their location and origin:

| Asset | Used for | Type / Source |
|---|---|---|
| `src/assets/CompiDerpy.webp` | "Compi" mascot (help modal, hint bubbles, tooltips, tutorials) | Original artwork (self-made) |
| `public/logo.png` | Site logo / favicon | Original artwork (self-made) |
| `public/PaperPlane.png`, `PaperPlane2.png`, `PaperPlane3.png` | Paper-plane visuals in the EA explainer flow | Original artwork (self-made) |
| `public/game-shooter.png` | Shooter card on the dashboard | Screenshot of our own game |
| `public/game-peakfinder.png` | Peak Finder card on the dashboard | Composite: Google Maps screenshot overlaid with the game's own heatmap rendering (map imagery © Google) |
| `src/assets/Maze_Explorer.webp` | Maze Explorer card on the dashboard | Composite: maze image found via Google (source/license unverified) combined with original pizza artwork |

All other visuals — heatmaps, contour lines, population dots, the shooter arena, maze rendering, charts — are drawn programmatically (canvas/CSS/Recharts); there are no further sprite or texture assets. No audio assets are used.

**Font:** [Inter](https://fonts.google.com/specimen/Inter) is loaded from Google Fonts (SIL Open Font License 1.1).
