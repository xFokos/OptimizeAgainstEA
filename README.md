# Optimize Against EA

An educational web app that teaches **optimization concepts** (in particular Evolutionary Algorithms) through a collection of interactive mini-games. Players explore search spaces, compete against or learn from an EA, and watch how populations evolve toward an optimum.

Built with **React 19 + TypeScript + Vite**.

> ⚠️ **Project status: work in progress.** This project is part of the GameLab 2 course and is not yet complete. Some games and features are still under development (see [What's not built yet](#whats-not-built-yet)). The structure may still be extended.

---

## Authors

| Name | Email | Student ID |
|---|---|---|
| Philipp Sehne | sehne.philipp@gmail.com | ❓ **TODO: add student ID** |
| Ahrens (first name?) | ❓ **TODO: add email** | ❓ **TODO: add student ID** |

> 🔴 **TODO:** Confirm the full name(s) of the second team member ("Ahrens") and fill in all missing emails and student IDs above.

Repository: https://gitlab2.informatik.uni-wuerzburg.de/GE/Teaching/gl2/projects/2025/b-ahrens-und-sehne

---

## Presentation of results

> 🔴 **TODO:** Add a link to / reference for the presentation of the project results once it exists (slides, recording, or live deployment URL).

A live deployment is configured via Firebase Hosting (Firebase project `optimizeagainstea`), but the public URL still needs to be confirmed and linked here.

---

## What's inside

The app is a single React SPA with multiple routed mini-games. The most developed games are:

| Route | Game | Concept |
|---|---|---|
| `/PeakFinder` | **Peak Finder** ("Schiffe Versenken"-style) | Probe a hidden function surface to find its global minimum — play solo or against an EA, with a full step-by-step EA replay viewer |
| `/ShooterGame` | **Shooter Game** | A genetic algorithm evolves enemy agent behaviour each round, adapting to the player's style |
| `/MazeGame` | **Maze Game** | EA-based maze solving / generation |
| `/TravelingSalesman` | **Traveling Salesman** | Classic TSP optimization game |
| `/MapGame` | **Map Game** | Map-based analytics game |

Additional routes exist for navigation and tooling: `/` (home), `/Settings`, `/Dashboard`, `/Analytics`, `Problem` (problem selection), `/JumpGame`, and `/lobby/shooter`. Some of these are scaffolding for features still in progress.

---

## Software environment

- **Runtime:** A modern web browser (latest Chrome / Firefox / Edge / Safari). The app runs entirely client-side.
- **Build toolchain:** [Node.js](https://nodejs.org/) (developed and tested with **Node v24.x**; Node 20+ should also work) and npm.
- **No joypad / gamepad required.** All games are played with **keyboard and mouse** (and the app is also intended to be usable on touch / mobile, though the mobile layout is not yet fully tested below 640px width — see below).

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

All algorithmic code (the evolutionary / genetic algorithms, game engines, rendering, hint system, etc.) was written by the team for this project.

### Assets

The following background / image assets are bundled under `OptimizeAgainstEAApp/src/assets/`:

- `HomePageBG.jpg`, `JumpGameBG.jpg`, `TravelingSalesmanBG.PNG`, `TestBG1.jpg`, `TestBG2.jpg`
- `react.svg`, `public/vite.svg` (from the Vite/React template)

> 🔴 **TODO:** Clarify and reference the **source and license** of every image asset in `src/assets/` (self-made, stock, generated, etc.). Any asset that is not original work must be attributed with its source and license here. Placeholder/test backgrounds (`TestBG1/2`) should be replaced or removed before final submission.

---

## What's not built yet

- **Mobile layout** — responsive breakpoints exist but are not fully tested below 640px.
- **Analytic function problems** (Rastrigin, Ackley, Rosenbrock) for Peak Finder — the problem abstraction is ready, the functions are not yet wired in.
- **Shooter population overlay** — visualizing all individuals on the canvas during the evolution phase.
- Several routes (Map Game, Dashboard, Analytics, Jump Game, problem selection) are still partly scaffolding.

> This list is non-exhaustive; the project is actively being extended.
