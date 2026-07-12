import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ARENA, GAME_CONFIG, DNA_INDEX, DNA_LENGTH,
    type InputState, type Bullet, type Population, type Individual, type DNA,
} from '../shooter.types';
import type { HordeGameState, HordeAgent, HordePhase, HordeMap, HordeSpawnSide, HordeObstacle } from '../horde/hordeTypes';
import { hordeRunStore }  from '../horde/hordeRunStore';
import { hordeGameStore } from '../horde/hordeGameStore';
import { LOOP_STEPS, LOOP_STEP_DURATION, LOOP_GENE_START, loopOffsetRad, SIZE_GENE_INDEX, OPACITY_GENE_INDEX, HORDE_TUTORIAL_DNA } from '../horde/hordeDna';
import { resolveHordeMap, getHordeMap } from '../horde/hordeMaps';
import { circleIntersectsObstacle, pushOutOfObstacles } from '../horde/hordeCollision';
import { computeFlowField, sampleFlowField } from '../horde/hordePathfinding';
import { useInput }       from '../hooks/useInput';
import { useTutorialStep } from '../hooks/useTutorialStep';
import { useSettings }    from '../../../context/SettingsContext';
import type { HordeSettings } from '../../../context/SettingsContext';
import type { PlayerStats } from '../shooter.types';
import { applyMods, computeShotPlan, MOD_POOL, type ModDefinition } from '../mods/modTypes';
import { steerHomingBullet, type QueuedShot } from '../mods/shotEngine';
import { runModsStore } from '../mods/runModsStore';
import { CompiBubble } from '../../../components/hints';

// Horde has its own mutation/crossover tuning (via HordeSettings) — deliberately
// decoupled from the shared EASettings used by Solo Play, so changing difficulty
// here never bleeds into the other game mode.
type HordeEA = Pick<HordeSettings, 'mutationRate' | 'mutationStrength' | 'crossoverType' | 'shootCooldown'>;

// ---- Constants ----

const HC         = '#fb923c';
const SPD_MAX           = 220;   // top speed when MOVEMENT_SPEED = 1
const ARENA_DIAG        = Math.sqrt(ARENA.WIDTH ** 2 + ARENA.HEIGHT ** 2);
const ELITE_FRACTION    = 0.15;  // top 15% of the population reincarnate unchanged on death
const STUCK_TIMEOUT     = 1.2;   // seconds pinned against a wall before an agent is culled/respawned
const WALL_DEATH_PENALTY       = 0.5;   // fitness multiplier for dying stuck against a wall
const DIVERSITY_INJECTION_RATE = 0.08;  // chance a non-elite replacement is a random immigrant instead of an offspring

// Loop movement genes: an evolved sequence of steering-rotation offsets, applied
// on top of the chase/wander/dodge direction — creates emergent zigzag/spiral
// approach patterns while the agent still tracks the player (never open-loop).
// LOOP_STEPS/LOOP_GENE_START/SIZE_GENE_INDEX/OPACITY_GENE_INDEX/loopOffsetRad
// live in horde/hordeDna.ts (shared with the lobby overview) — imported above.

// Spawn-side genes: one weight per compass side (top/right/bottom/left), read the
// same way on every map — no special-casing by how many sides a map allows, since
// even a map that technically permits all four can still be genuinely lopsided
// (an obstacle crowding one edge without literally blocking it). The weights are
// zeroed for whichever sides the current map disallows and renormalized over the
// rest, then sampled *stochastically* (not "always pick the top side") — so this
// behaves like every other gene: mutation and diversity injection (see
// DIVERSITY_INJECTION_RATE) keep it from ever hard-locking to one edge, even on
// the perfectly symmetric Open map where there's no genuine advantage to find.
const SPAWN_WEIGHT_START = OPACITY_GENE_INDEX + 1; // 4 consecutive genes
const SPAWN_SIDE_ORDER: HordeSpawnSide[] = ['top', 'right', 'bottom', 'left'];

function pickSpawnSide(dna: DNA, allowedSides: HordeSpawnSide[]): HordeSpawnSide {
    // Floor avoids an all-zero weight set (e.g. after unlucky mutation) collapsing the sum to 0.
    const weights = allowedSides.map(side => Math.max(0.001, dna[SPAWN_WEIGHT_START + SPAWN_SIDE_ORDER.indexOf(side)] ?? 0.5));
    const total   = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < allowedSides.length; i++) {
        r -= weights[i];
        if (r <= 0) return allowedSides[i];
    }
    return allowedSides[allowedSides.length - 1];
}

const MIN_AGENT_R  = 8;
const MAX_AGENT_R  = 22;
const MIN_OPACITY  = 0.15;
const MAX_OPACITY  = 1.0;

function agentRadius(dna: DNA): number {
    const gene = dna[SIZE_GENE_INDEX] ?? 0.5;
    return MIN_AGENT_R + gene * (MAX_AGENT_R - MIN_AGENT_R);
}

function agentOpacity(dna: DNA): number {
    const gene = dna[OPACITY_GENE_INDEX] ?? 0.5;
    return MIN_OPACITY + gene * (MAX_OPACITY - MIN_OPACITY);
}

let bulletCounter = 0;
let shootTimer    = 0; // countdown until the player can fire again; reset to ea.shootCooldown

// Schüsse aus Verhaltens-Mods (Burst Shot etc.), zeitversetzt nach dem Trigger-Pull.
// Meist leer → kein GC-Druck. Homing-Turn-Rate: siehe gameLoop.ts (Solo), gleicher Wert.
const hordeQueuedShots: QueuedShot[] = [];
const HORDE_HOMING_TURN_RATE = 5;

// Alle N Kills eine Mod-Auswahl anbieten (Vampire-Survivors-Stil) — N is now
// configurable via hordeSettings.killsPerUpgrade (see killsPerUpgradeRef below).
const MOD_CHOICE_COUNT  = 3;

// ---- Tutorial-feste Spielkonfiguration ----
// Einzige Übungsrunde: feste Map mit Deckung (Pillars), kleine Welle, inerte
// Gegner (siehe HORDE_TUTORIAL_DNA) und ein niedriger Kill-Schwellwert, damit
// die Mod-Auswahl ("Powerups") garantiert schnell auftaucht.
const TUTORIAL_WAVE_SIZE           = 8;
const TUTORIAL_KILLS_PER_UPGRADE   = 2;

type HordeTutorialStep = 'move' | 'aim' | 'shoot' | 'obstacles' | 'evolution' | 'mods' | 'done';

const HORDE_TUTORIAL_STEP_CONTENT: Record<HordeTutorialStep, { title: string; body: string }> = {
    move:      { title: 'Step 1 — Move',      body: 'Use WASD or the arrow keys to move around the arena.' },
    aim:       { title: 'Step 2 — Aim',       body: 'Move your mouse — your reticle follows it wherever it goes.' },
    shoot:     { title: 'Step 3 — Shoot',     body: 'Left-click or press Space to fire at the dummies.' },
    obstacles: { title: 'Cover',              body: "Those pillars block bullets — yours and theirs. Duck behind one to break line of sight." },
    // Real, not a mockup — the DNA panel really did just update: the killed
    // agent's slot in the population got a fresh genome (a mix of two good
    // survivors, plus a small random tweak) and respawned. Unlike Solo's
    // round-based reveal, here it happens live, on every single death.
    evolution: { title: 'That panel just evolved', body: "Look at the DNA panel on the right — it just updated. This dummy's replacement is a mix of two survivors' genes (crossover) with a small random tweak (mutation). That's the whole algorithm, happening live, every time one of them dies." },
    mods:      { title: 'Powerups',           body: 'Every couple of kills you get to pick a powerup that boosts your stats for the rest of the run.' },
    done:      { title: "You've got it!",     body: 'Try the powerup choice below, then finish whenever you\'re ready.' },
};

// ---- Mini-GA helpers (no rounds, just per-death offspring) ----

function tournament(inds: Individual[], k = 8): Individual {
    let best = inds[Math.floor(Math.random() * inds.length)];
    for (let i = 1; i < k; i++) {
        const c = inds[Math.floor(Math.random() * inds.length)];
        if (c.fitness > best.fitness) best = c;
    }
    return best;
}

function offspring(pop: Population, ea: HordeEA): DNA {
    const p1  = tournament(pop.individuals);
    const p2  = tournament(pop.individuals);
    const dna = p1.dna.map((g, i) =>
        ea.crossoverType === 'uniform'
            ? (Math.random() < 0.5 ? g : p2.dna[i])
            : g  // single-point handled via slice below
    );
    if (ea.crossoverType === 'single-point') {
        const pt = Math.floor(Math.random() * (dna.length - 1)) + 1;
        for (let i = pt; i < dna.length; i++) dna[i] = p2.dna[i];
    }
    return dna.map(g =>
        Math.random() < ea.mutationRate
            ? Math.max(0, Math.min(1, g + (Math.random() * 2 - 1) * ea.mutationStrength))
            : g
    );
}

// Completely fresh, unrelated genome — same distribution as the initial population.
// Used both to seed a new run and for diversity injection (see DIVERSITY_INJECTION_RATE),
// which occasionally drops a "random immigrant" into the population instead of breeding
// from existing parents, to keep genetic diversity from collapsing.
function randomDna(): DNA {
    return [
        ...Array.from({ length: DNA_LENGTH }, () => Math.random() * 0.6),
        ...Array.from({ length: LOOP_STEPS }, () => Math.random()),
        Math.random(), // size
        Math.random(), // opacity
        ...Array.from({ length: 4 }, () => Math.random()), // spawn-side weights: top, right, bottom, left
    ];
}

// ---- Spawn helpers ----

let agentIdCounter = 0;

// Picks a spawn point on whichever side this agent's DNA favors (see pickSpawnSide),
// restricted to whatever HordeMap.spawnSides currently allows.
function edgePos(radius: number, sides: HordeSpawnSide[], obstacles: HordeObstacle[], dna: DNA): { x: number; y: number } {
    const pad = radius + 12;
    const pointOnSide = (side: HordeSpawnSide, along: number): { x: number; y: number } => {
        switch (side) {
            case 'top':    return { x: along * ARENA.WIDTH, y: pad };
            case 'bottom': return { x: along * ARENA.WIDTH, y: ARENA.HEIGHT - pad };
            case 'left':   return { x: pad,                 y: along * ARENA.HEIGHT };
            default:       return { x: ARENA.WIDTH - pad,   y: along * ARENA.HEIGHT };
        }
    };

    const side = pickSpawnSide(dna, sides);
    let along  = Math.random();

    // Obstacles are placed away from the edges on current maps, so this rarely
    // triggers — it's a safety net against spawning inside a wall.
    for (let attempt = 0; attempt < 5; attempt++) {
        const p = pointOnSide(side, along);
        if (!obstacles.some(o => circleIntersectsObstacle(p.x, p.y, radius, o))) return p;
        along = Math.random();
    }
    return pointOnSide(side, along);
}

function spawnAgent(dna: DNA, popIndex: number, map: HordeMap, isElite = false): HordeAgent {
    return {
        id:          agentIdCounter++,
        popIndex,
        dna,
        position:    edgePos(agentRadius(dna), map.spawnSides, map.obstacles, dna),
        velocity:    { x: 0, y: 0 },
        rotation:    0,
        alive:       true,
        closestDist: ARENA_DIAG,
        wanderAngle: Math.random() * Math.PI * 2,
        stuckTimer:  0,
        loopIndex:   Math.floor(Math.random() * LOOP_STEPS),
        loopTimer:   Math.random() * LOOP_STEP_DURATION,
        isElite,
    };
}

function makeInitialState(pop: Population, map: HordeMap): HordeGameState {
    const n = pop.individuals.length;
    return {
        phase:  'playing',
        score:  0,
        generation: n,
        agents: pop.individuals.map((ind, i) => spawnAgent([...ind.dna], i, map)),
        player: {
            id:       'player',
            position: { x: map.playerSpawn.x, y: map.playerSpawn.y },
            velocity: { x: 0, y: 0 },
            rotation: 0,
            radius:   GAME_CONFIG.PLAYER_RADIUS,
            health:   1,
        },
        bullets:    [],
        population: pop,
        maxOnField: n,
        map,
    };
}

// ---- Pure game update ----

function updateHorde(
    state:        HordeGameState,
    dt:           number,
    input:        InputState,
    pStats:       PlayerStats,
    ea:           HordeEA,
    activeModIds: string[] = [],
): HordeGameState {
    if (state.phase !== 'playing') return state;

    // --- Player movement ---
    const player = { ...state.player, position: { ...state.player.position }, velocity: { ...state.player.velocity } };
    let mvx = 0, mvy = 0;
    if (input.up)    mvy -= 1;
    if (input.down)  mvy += 1;
    if (input.left)  mvx -= 1;
    if (input.right) mvx += 1;
    const mvLen = Math.sqrt(mvx * mvx + mvy * mvy);
    if (mvLen > 0) {
        player.velocity.x = (mvx / mvLen) * pStats.moveSpeed;
        player.velocity.y = (mvy / mvLen) * pStats.moveSpeed;
    } else {
        player.velocity.x = 0;
        player.velocity.y = 0;
    }
    player.rotation = Math.atan2(input.mouseY - player.position.y, input.mouseX - player.position.x);
    const pr = GAME_CONFIG.PLAYER_RADIUS;
    player.position.x = Math.max(pr, Math.min(ARENA.WIDTH  - pr, player.position.x + player.velocity.x * dt));
    player.position.y = Math.max(pr, Math.min(ARENA.HEIGHT - pr, player.position.y + player.velocity.y * dt));
    {
        const pushed = pushOutOfObstacles(player.position.x, player.position.y, pr, state.map.obstacles);
        player.position.x = Math.max(pr, Math.min(ARENA.WIDTH  - pr, pushed.x));
        player.position.y = Math.max(pr, Math.min(ARENA.HEIGHT - pr, pushed.y));
    }

    // --- Player shoots ---
    const bullets: Bullet[] = [...state.bullets];

    function spawnHordeBullet(angleOffset: number, speedMult: number, homing: boolean) {
        const angle = player.rotation + angleOffset;
        const speed = pStats.bulletSpeed * speedMult;
        bullets.push({
            id:       `h_${bulletCounter++}`,
            position: { ...player.position },
            velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
            ownerId:  'player',
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
            homing,
        });
    }

    shootTimer = Math.max(0, shootTimer - dt);
    if (input.shoot && shootTimer === 0) {
        shootTimer = ea.shootCooldown;
        // Schuss-Mods (Triple Shot, Burst Shot, Homing Rounds, ...) nur beim
        // tatsächlichen Trigger-Pull berechnen – vernachlässigbare Kosten.
        for (const shot of computeShotPlan(activeModIds)) {
            if (shot.delay <= 0) {
                spawnHordeBullet(shot.angleOffset, shot.speedMult, shot.homing ?? false);
            } else {
                hordeQueuedShots.push({ timer: shot.delay, angleOffset: shot.angleOffset, speedMult: shot.speedMult, homing: shot.homing ?? false });
            }
        }
    }

    // --- Verzögerte Mod-Schüsse abfeuern (z.B. Burst Shot) – meist leer ---
    if (hordeQueuedShots.length > 0) {
        for (let i = hordeQueuedShots.length - 1; i >= 0; i--) {
            const q = hordeQueuedShots[i];
            q.timer -= dt;
            if (q.timer <= 0) {
                spawnHordeBullet(q.angleOffset, q.speedMult, q.homing);
                hordeQueuedShots.splice(i, 1);
            }
        }
    }

    // --- Agent movement ---
    // AGGRESSION = 0 → pure random wander (planlos)
    // AGGRESSION = 1 → always beelines toward player, ignoring the routed path (see below)
    // MOVEMENT_SPEED = 0 → barely moves; = 1 → full speed
    // One flow field per frame (BFS from the player's cell — see hordePathfinding.ts), shared
    // by every agent so pathfinding stays O(1) per agent instead of a search each.
    const flow = computeFlowField(state.map.obstacles, player.position.x, player.position.y);
    const agents = state.agents.map(a => {
        if (!a.alive) return a;
        const agent = { ...a, position: { ...a.position }, velocity: { ...a.velocity } };
        const r     = agentRadius(agent.dna);

        const dx   = player.position.x - agent.position.x;
        const dy   = player.position.y - agent.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < agent.closestDist) agent.closestDist = dist;

        // Slowly drift wander angle (more drift when aggression is low)
        const wanderDrift = (1 - agent.dna[DNA_INDEX.AGGRESSION]) * 3.5;
        agent.wanderAngle += (Math.random() - 0.5) * wanderDrift * dt;

        const toX     = dist > 0 ? dx / dist : 1;
        const toY     = dist > 0 ? dy / dist : 0;
        const wandX   = Math.cos(agent.wanderAngle);
        const wandY   = Math.sin(agent.wanderAngle);
        const agg     = agent.dna[DNA_INDEX.AGGRESSION];

        // Chase target: blend the routed (obstacle-aware) direction with the raw direct line,
        // weighted by the agent's own aggression — high aggression overrides the safe path and
        // rushes straight at the player (can still wall itself off on a complex layout, which is
        // the point), while a more cautious chaser leans on the routed path instead. Wherever
        // there's clear line of sight the routed direction is already ~equal to the direct line,
        // so this only ever diverges from today's behavior when an obstacle is actually in the way.
        const routed  = sampleFlowField(flow, agent.position.x, agent.position.y);
        const routedX = routed ? routed.x : toX;
        const routedY = routed ? routed.y : toY;
        const chaseX  = agg * toX + (1 - agg) * routedX;
        const chaseY  = agg * toY + (1 - agg) * routedY;

        // Blend: low agg → wander, high agg → chase
        let dirX = agg * chaseX + (1 - agg) * wandX;
        let dirY = agg * chaseY + (1 - agg) * wandY;

        // Bullet dodge (scales with DODGE_WEIGHT)
        for (const b of bullets) {
            const bdx = b.position.x - agent.position.x;
            const bdy = b.position.y - agent.position.y;
            if (bdx * bdx + bdy * bdy < 90 * 90) {
                const bLen = Math.sqrt(b.velocity.x ** 2 + b.velocity.y ** 2);
                if (bLen > 0) {
                    const px   = -b.velocity.y / bLen;
                    const py   =  b.velocity.x / bLen;
                    const side = (px * bdx + py * bdy) >= 0 ? 1 : -1;
                    dirX += px * side * agent.dna[DNA_INDEX.DODGE_WEIGHT];
                    dirY += py * side * agent.dna[DNA_INDEX.DODGE_WEIGHT];
                }
            }
        }

        // Evolved loop pattern: rotate the steering direction by a per-step offset that
        // cycles on a fixed schedule. Applied on top of the chase/wander/dodge blend, so
        // the agent keeps tracking the player while tracing out emergent zigzag/spiral shapes.
        agent.loopTimer -= dt;
        if (agent.loopTimer <= 0) {
            agent.loopIndex = (agent.loopIndex + 1) % LOOP_STEPS;
            agent.loopTimer += LOOP_STEP_DURATION;
        }
        const loopGene  = agent.dna[LOOP_GENE_START + agent.loopIndex] ?? 0.5;
        const loopAngle = loopOffsetRad(loopGene);
        const cosL = Math.cos(loopAngle), sinL = Math.sin(loopAngle);
        const rotX = dirX * cosL - dirY * sinL;
        const rotY = dirX * sinL + dirY * cosL;
        dirX = rotX;
        dirY = rotY;

        const dirLen = Math.sqrt(dirX ** 2 + dirY ** 2);
        const normX  = dirLen > 0 ? dirX / dirLen : wandX;
        const normY  = dirLen > 0 ? dirY / dirLen : wandY;
        const speed  = agent.dna[DNA_INDEX.MOVEMENT_SPEED] * SPD_MAX;

        // Blend towards target velocity — converges to (normX*speed, normY*speed),
        // not 4x it (the old "(v + target) * 0.8" recurrence overshot the intended top speed).
        agent.velocity.x = agent.velocity.x * 0.80 + normX * speed * 0.20;
        agent.velocity.y = agent.velocity.y * 0.80 + normY * speed * 0.20;
        const prevX = agent.position.x;
        const prevY = agent.position.y;
        agent.position.x = Math.max(r, Math.min(ARENA.WIDTH  - r, agent.position.x + agent.velocity.x * dt));
        agent.position.y = Math.max(r, Math.min(ARENA.HEIGHT - r, agent.position.y + agent.velocity.y * dt));
        agent.rotation   = Math.atan2(normY, normX);

        // Obstacles push the agent out just like a wall — treated the same way below
        // for the stuck-timer (hugging cover counts exactly like hugging the arena edge).
        const pushedObstacle = pushOutOfObstacles(agent.position.x, agent.position.y, r, state.map.obstacles);
        agent.position.x = Math.max(r, Math.min(ARENA.WIDTH  - r, pushedObstacle.x));
        agent.position.y = Math.max(r, Math.min(ARENA.HEIGHT - r, pushedObstacle.y));

        // Stuck detection: hugging a wall/obstacle with near-zero *actual* movement.
        // Must use real displacement, not agent.velocity — velocity keeps climbing
        // even when the wall clamp above is fully cancelling the agent's position change,
        // which let fast/aggressive agents get wedged in corners without ever being detected.
        const actualSpd = Math.hypot(agent.position.x - prevX, agent.position.y - prevY) / dt;
        const onEdge = agent.position.x <= r + 2 || agent.position.x >= ARENA.WIDTH  - r - 2 ||
                       agent.position.y <= r + 2 || agent.position.y >= ARENA.HEIGHT - r - 2 ||
                       pushedObstacle.touching;
        agent.stuckTimer = onEdge && actualSpd < 20
            ? agent.stuckTimer + dt
            : Math.max(0, agent.stuckTimer - dt * 3);

        return agent;
    });

    // --- Bullets: move + hit agents ---
    let score = state.score;
    const hitIds     = new Set<number>();
    const newBullets: Bullet[] = [];

    for (const b of bullets) {
        // Homing Rounds: pro Frame Richtung nächsten lebenden Agenten eindrehen
        if (b.homing && b.ownerId === 'player') {
            let nearest: HordeAgent | undefined;
            let nearestD2 = Infinity;
            for (const a of agents) {
                if (!a.alive) continue;
                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < nearestD2) { nearestD2 = d2; nearest = a; }
            }
            if (nearest) steerHomingBullet(b.position, b.velocity, nearest.position, HORDE_HOMING_TURN_RATE, dt);
        }

        b.position.x += b.velocity.x * dt;
        b.position.y += b.velocity.y * dt;
        b.lifetime   -= dt;
        if (b.lifetime <= 0 || b.position.x < 0 || b.position.x > ARENA.WIDTH ||
                                b.position.y < 0 || b.position.y > ARENA.HEIGHT) continue;
        if (state.map.obstacles.some(o => o.blocksBullets && circleIntersectsObstacle(b.position.x, b.position.y, b.radius, o))) continue;
        let hit = false;
        for (const agent of agents) {
            if (!agent.alive || hitIds.has(agent.id)) continue;
            const dx = b.position.x - agent.position.x;
            const dy = b.position.y - agent.position.y;
            if (dx * dx + dy * dy < (agentRadius(agent.dna) + b.radius) ** 2) {
                hitIds.add(agent.id);
                hit = true;
                score++;
                break;
            }
        }
        if (!hit) newBullets.push(b);
    }

    // --- Process kills + stuck agents + respawn offspring ---
    let { population } = state;
    const { generation } = state;
    const stuckIds = new Set(agents.filter(a => a.alive && a.stuckTimer > STUCK_TIMEOUT).map(a => a.id));
    const removeIds = new Set([...hitIds, ...stuckIds]);

    const finalAgents = agents.map(a => {
        if (!removeIds.has(a.id)) return a;
        // Fitness reflects only this agent's own performance — no inherited
        // credit from whatever DNA previously occupied this slot.
        const rawFit    = Math.max(0, 1 - a.closestDist / ARENA_DIAG);
        // Dying stuck against a wall is punished — it's dead weight in the gene pool,
        // not a genuine approach on the player, so it shouldn't score like one.
        const wallPenalty = stuckIds.has(a.id) ? WALL_DEATH_PENALTY : 1;
        const measured     = rawFit * rawFit * wallPenalty;
        // A single life is a noisy sample of a genome's quality (spawn position, RNG
        // wander/dodge, player behaviour all vary). For elites — which replay the exact
        // same DNA across multiple lives — blend in the prior reading to smooth that
        // noise out, instead of letting one unlucky life erase a proven-good genome.
        // Fresh (non-elite) offspring always get an unbiased, un-smoothed first reading.
        const prevFitness = population.individuals[a.popIndex].fitness;
        const fitness = a.isElite ? measured * 0.6 + prevFitness * 0.4 : measured;
        const updatedInds = [...population.individuals];
        updatedInds[a.popIndex] = { ...updatedInds[a.popIndex], fitness };
        population = { ...population, individuals: updatedInds };
        return { ...a, alive: false };
    });

    // Elitism: the top ELITE_FRACTION of the population (by proven fitness) reincarnate
    // with their own DNA unchanged instead of going through crossover/mutation — otherwise
    // a genuinely good genome only ever survives by luck once its agent dies.
    const eliteCount     = Math.max(1, Math.round(population.individuals.length * ELITE_FRACTION));
    const sortedFitness  = population.individuals.map(ind => ind.fitness).sort((x, y) => y - x);
    const eliteThreshold = sortedFitness[eliteCount - 1];

    let nextGeneration = generation;
    const replacements: HordeAgent[] = [];
    for (const a of finalAgents) {
        if (removeIds.has(a.id)) {
            const ownFitness = population.individuals[a.popIndex].fitness;
            const isElite     = ownFitness > 0 && ownFitness >= eliteThreshold;
            // Diversity injection: occasionally drop in a completely fresh random genome
            // instead of breeding one, so the gene pool can't fully converge/stagnate on
            // whatever the current population happens to be exploring.
            const isDiversityInjection = !isElite && Math.random() < DIVERSITY_INJECTION_RATE;
            const newDna = isElite
                ? [...population.individuals[a.popIndex].dna]
                : isDiversityInjection
                    ? randomDna()
                    : offspring(population, ea);
            // Newborn is unproven and starts at 0; an elite keeps the fitness it already earned.
            const newFitness  = isElite ? ownFitness : 0;
            const updatedInds = [...population.individuals];
            updatedInds[a.popIndex] = { dna: newDna, fitness: newFitness };
            population = { ...population, individuals: updatedInds };
            replacements.push(spawnAgent(newDna, a.popIndex, state.map, isElite));
            nextGeneration++;
        }
    }

    const livingAgents   = finalAgents.filter(a => a.alive);
    const mergedAgents   = [...livingAgents, ...replacements];

    // --- Check player-agent touch → dead (only truly living agents, not stuck respawns) ---
    let phase: HordePhase = 'playing';
    for (const a of livingAgents.filter(a => !stuckIds.has(a.id))) {
        const dx = a.position.x - player.position.x;
        const dy = a.position.y - player.position.y;
        const touchDist = GAME_CONFIG.PLAYER_RADIUS + agentRadius(a.dna);
        if (dx * dx + dy * dy < touchDist ** 2) { phase = 'dead'; break; }
    }

    return {
        ...state,
        phase,
        score,
        generation: nextGeneration,
        agents:     phase === 'dead' ? mergedAgents : mergedAgents,
        player,
        bullets:    newBullets,
        population,
    };
}

// ---- Renderer ----

function render(ctx: CanvasRenderingContext2D, state: HordeGameState) {
    ctx.fillStyle = '#0f0f1a';
    ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);

    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    for (let x = 0; x <= ARENA.WIDTH;  x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, ARENA.HEIGHT); }
    for (let y = 0; y <= ARENA.HEIGHT; y += 40) { ctx.moveTo(0, y); ctx.lineTo(ARENA.WIDTH, y); }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(251,146,60,0.18)';
    ctx.lineWidth   = 2;
    ctx.strokeRect(1, 1, ARENA.WIDTH - 2, ARENA.HEIGHT - 2);

    // Obstacles — solid border for cover that blocks bullets, dashed for movement-only blockers
    for (const o of state.map.obstacles) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(o.x, o.y, o.w, o.h);
        ctx.strokeStyle = o.blocksBullets ? 'rgba(251,146,60,0.55)' : 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 2;
        ctx.setLineDash(o.blocksBullets ? [] : [6, 4]);
        ctx.strokeRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
        ctx.setLineDash([]);
    }

    // Bullets
    ctx.fillStyle = '#80d8ff';
    ctx.beginPath();
    for (const b of state.bullets) {
        ctx.moveTo(b.position.x + b.radius, b.position.y);
        ctx.arc(b.position.x, b.position.y, b.radius, 0, Math.PI * 2);
    }
    ctx.fill();

    // Agents — size and opacity are both evolved genes (SIZE_GENE_INDEX / OPACITY_GENE_INDEX)
    for (const a of state.agents) {
        if (!a.alive) continue;
        const r       = agentRadius(a.dna);
        const opacity = agentOpacity(a.dna);
        ctx.save();
        ctx.translate(a.position.x, a.position.y);
        ctx.rotate(a.rotation);
        ctx.globalAlpha = opacity;
        ctx.beginPath(); ctx.arc(0, 0, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = HC; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = HC; ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Player
    const dead = state.phase === 'dead';
    ctx.save();
    ctx.translate(state.player.position.x, state.player.position.y);
    ctx.rotate(state.player.rotation);
    ctx.beginPath(); ctx.arc(0, 0, GAME_CONFIG.PLAYER_RADIUS + 5, 0, Math.PI * 2);
    ctx.strokeStyle = dead ? 'rgba(239,83,80,0.4)' : 'rgba(79,195,247,0.3)';
    ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, GAME_CONFIG.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = dead ? '#ef5350' : '#4fc3f7'; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(GAME_CONFIG.PLAYER_RADIUS, 0);
    ctx.lineTo(GAME_CONFIG.PLAYER_RADIUS + 14, 0);
    ctx.strokeStyle = '#80d8ff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, ARENA.WIDTH, 38);
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = HC;
    ctx.fillText(`GEN ${state.generation}`, 14, 19);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`KILLS: ${state.score}`, ARENA.WIDTH - 14, 19);
}

// ---- DNA Panel ----

const PANEL_W = 200;

const GENE_DEFS: { index: number; label: string; tips: [number, string][] }[] = [
    {
        index: DNA_INDEX.AGGRESSION, label: 'Aggression',
        tips:  [[0, 'Drifts aimlessly'], [0.25, 'Mostly wandering'], [0.5, 'Mixed pursuit'], [0.75, 'Actively hunting'], [0.9, 'Laser-focused']],
    },
    {
        index: DNA_INDEX.MOVEMENT_SPEED, label: 'Speed',
        tips:  [[0, 'Nearly stationary'], [0.25, 'Slow shuffle'], [0.5, 'Moderate speed'], [0.75, 'Fast approach'], [0.9, 'Full sprint']],
    },
    {
        index: DNA_INDEX.DODGE_WEIGHT, label: 'Dodge',
        tips:  [[0, 'No evasion'], [0.3, 'Slight swerve'], [0.6, 'Actively evading'], [0.85, 'Bullet-dancer']],
    },
    {
        index: SIZE_GENE_INDEX, label: 'Size',
        tips:  [[0, 'Tiny — hard to hit'], [0.3, 'Small'], [0.6, 'Average build'], [0.85, 'Large target']],
    },
    {
        index: OPACITY_GENE_INDEX, label: 'Opacity',
        tips:  [[0, 'Nearly invisible'], [0.3, 'Faint'], [0.6, 'Visible'], [0.85, 'Fully solid']],
    },
];

function geneTip(value: number, tips: [number, string][]): string {
    let out = tips[0][1];
    for (const [t, l] of tips) { if (value >= t) out = l; }
    return out;
}

function HordeDnaPanel({ bestDna, height }: { bestDna: DNA | null; height: number }) {
    return (
        <div style={{
            width:         PANEL_W,
            height,
            display:       'flex',
            flexDirection: 'column',
            gap:           16,
            fontFamily:    '"JetBrains Mono", monospace',
            color:         '#fff',
            flexShrink:    0,
            overflowY:     'auto',
            padding:       '14px 4px',
            boxSizing:     'border-box',
        }}>
            <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(251,146,60,0.7)' }}>
                Best DNA
            </div>
            {!bestDna && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.8 }}>
                    No data yet.<br />Kill an agent to<br />see evolution.
                </div>
            )}
            {bestDna && GENE_DEFS.map(def => {
                const value = bestDna[def.index] ?? 0;
                return (
                    <div key={def.label} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{def.label}</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{value.toFixed(2)}</span>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${value * 100}%`, height: '100%', background: HC, borderRadius: 4, transition: 'width 0.3s ease' }} />
                        </div>
                        <div style={{ fontSize: 11, color: HC, opacity: 0.75, lineHeight: 1.4 }}>
                            {geneTip(value, def.tips)}
                        </div>
                    </div>
                );
            })}
            {bestDna && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Movement Loop</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {Array.from({ length: LOOP_STEPS }, (_, i) => {
                            const gene = bestDna[LOOP_GENE_START + i] ?? 0.5;
                            const deg  = Math.round((loopOffsetRad(gene) * 180) / Math.PI);
                            return (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: '50%',
                                        border: `1px solid ${HC}`, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center',
                                        transform: `rotate(${deg}deg)`,
                                    }}>
                                        <span style={{ color: HC, fontSize: 14, lineHeight: 1 }}>↑</span>
                                    </div>
                                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                                        {deg > 0 ? `+${deg}°` : `${deg}°`}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={{ fontSize: 11, color: HC, opacity: 0.75, lineHeight: 1.4 }}>
                        Repeats every {(LOOP_STEPS * LOOP_STEP_DURATION).toFixed(1)}s — arrows show the turn offset applied each step, relative to the current steering direction.
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- Component ----

const BTN: React.CSSProperties = {
    padding:       '10px 28px',
    background:    'transparent',
    border:        `1px solid ${HC}`,
    borderRadius:  6,
    color:         HC,
    fontFamily:    '"JetBrains Mono", monospace',
    fontSize:      14,
    cursor:        'pointer',
    letterSpacing: '0.06em',
};

interface HordeCanvasProps {
    scale?:            number;
    externalInputRef?: RefObject<InputState>;
    hideDnaPanel?:     boolean;
    tutorial?:         boolean;
}

export function HordeCanvas({ scale = 1, externalInputRef, hideDnaPanel = false, tutorial = false }: HordeCanvasProps) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const localInput = useInput();
    const inputRef   = externalInputRef ?? localInput;
    const navigate   = useNavigate();

    const { hordeSettings, shooterSettings } = useSettings();
    // Resume a saved run if there is one. A 'choosing' phase can't resume as-is —
    // the pending mod-choice prompt itself isn't persisted — so it downgrades to
    // 'playing' (the run continues, that one mod offer is simply skipped).
    const resumed: HordeGameState | null = hordeGameStore.state
        ? (hordeGameStore.state.phase === 'choosing' ? { ...hordeGameStore.state, phase: 'playing' } : hordeGameStore.state)
        : null;
    const stateRef       = useRef<HordeGameState | null>(resumed);
    const eaRef          = useRef<HordeEA>(hordeSettings);
    const playerStatsRef = useRef<PlayerStats>(shooterSettings.playerStats);
    const hordeSizeRef   = useRef(tutorial ? TUTORIAL_WAVE_SIZE : hordeSettings.waveSize);
    const starterDnaRef  = useRef(tutorial ? HORDE_TUTORIAL_DNA : hordeSettings.starterDna);
    const modChoiceEnabledRef = useRef(tutorial ? true : hordeSettings.modChoiceEnabled);
    const killsPerUpgradeRef  = useRef(tutorial ? TUTORIAL_KILLS_PER_UPGRADE : hordeSettings.killsPerUpgrade);
    const mapRef         = useRef<HordeMap>(tutorial ? getHordeMap('pillars') : resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn));

    useEffect(() => { eaRef.current          = hordeSettings;               }, [hordeSettings]);
    useEffect(() => { playerStatsRef.current = shooterSettings.playerStats;  }, [shooterSettings]);
    useEffect(() => { hordeSizeRef.current   = tutorial ? TUTORIAL_WAVE_SIZE : hordeSettings.waveSize;     }, [hordeSettings, tutorial]);
    useEffect(() => { starterDnaRef.current  = tutorial ? HORDE_TUTORIAL_DNA : hordeSettings.starterDna;   }, [hordeSettings.starterDna, tutorial]);
    useEffect(() => { modChoiceEnabledRef.current = tutorial ? true : hordeSettings.modChoiceEnabled; }, [hordeSettings.modChoiceEnabled, tutorial]);
    useEffect(() => { killsPerUpgradeRef.current  = tutorial ? TUTORIAL_KILLS_PER_UPGRADE : hordeSettings.killsPerUpgrade;   }, [hordeSettings.killsPerUpgrade, tutorial]);
    useEffect(() => {
        mapRef.current = tutorial
            ? getHordeMap('pillars')
            : resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn);
    }, [tutorial, hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn]);

    const [uiPhase,  setUiPhase]  = useState<HordePhase | 'start'>(resumed?.phase ?? 'start');
    const [uiGen,    setUiGen]    = useState(resumed?.generation ?? 0);
    const [uiScore,  setUiScore]  = useState(resumed?.score ?? 0);
    const [bestDna,  setBestDna]  = useState<DNA | null>(() => {
        if (!resumed) return null;
        const best = resumed.population.individuals.reduce((a, b) => b.fitness > a.fitness ? b : a);
        return [...best.dna];
    });
    const [pendingModChoices, setPendingModChoices] = useState<ModDefinition[] | null>(null);

    // Tutorial step coachmarks — advanced live from the game loop (refs, since
    // that callback is created once and must not go stale). Mirrors
    // ShooterCanvas. useTutorialStep also enforces a minimum time each step
    // stays visible, so a step a player satisfies instantly (e.g. already
    // moving) doesn't flash by unread.
    const tutorialAimOriginRef = useRef<{ x: number; y: number } | null>(null);
    const {
        stepRef: tutorialStepRef,
        step: tutorialStep,
        bubbleClosed: tutorialBubbleClosed,
        setBubbleClosed: setTutorialBubbleClosed,
        advance: advanceTutorialStep,
        request: requestTutorialStep,
        tick: tickTutorialStep,
    } = useTutorialStep<HordeTutorialStep>('move');

    const finishTutorial = async () => {
        if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
        hordeGameStore.state = null;
        hordeGameStore.notify();
        navigate('/lobby/shooter', { state: { mode: 'horde' } });
    };

    const startGame = () => {
        agentIdCounter = 0;
        bulletCounter  = 0;
        shootTimer     = 0;
        hordeQueuedShots.length = 0;
        runModsStore.reset();
        if (tutorial) {
            tutorialAimOriginRef.current = null;
            advanceTutorialStep('move');
        }
        // Base genes + movement loop + size/opacity are all jittered around the
        // player's Horde Starter DNA (±0.05 per gene — same bootstrap Solo Play's
        // initPopulation() uses), so none of it is a dead setting that always
        // gets overridden by pure randomness. Only the spawn-side weights have
        // no starter equivalent (see HORDE_STARTER_DNA_LENGTH) and stay fully
        // random every spawn, on purpose — not something to bias up front.
        const pop: Population = {
            generation:  1,
            individuals: Array.from({ length: hordeSizeRef.current }, () => ({
                dna: [
                    ...starterDnaRef.current.map(v => Math.max(0, Math.min(1, v + (Math.random() - 0.5) * 0.1))),
                    ...Array.from({ length: 4 }, () => Math.random()), // spawn-side weights: top, right, bottom, left
                ],
                fitness: 0,
            })),
            bestFitness: 0,
            avgFitness:  0,
        };
        stateRef.current = makeInitialState(pop, mapRef.current);
        hordeGameStore.state = stateRef.current;
        hordeGameStore.notify();
        setUiPhase('playing');
        setUiGen(pop.individuals.length);
        setUiScore(0);
        setBestDna(null);
    };

    const chooseHordeMod = (mod: ModDefinition) => {
        runModsStore.toggleMod(mod.id);
        setPendingModChoices(null);
        if (stateRef.current) stateRef.current = { ...stateRef.current, phase: 'playing' };
        hordeGameStore.state = stateRef.current;
        setUiPhase('playing');
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animId: number;
        let last = performance.now();

        const loop = (ts: number) => {
            const dt = Math.min((ts - last) / 1000, 0.05);
            last = ts;

            const s = stateRef.current;
            if (s === null) {
                ctx.fillStyle = '#0f0f1a';
                ctx.fillRect(0, 0, ARENA.WIDTH, ARENA.HEIGHT);
            } else if (s.phase === 'playing') {
                const activeModIds       = runModsStore.activeModIds;
                const effectivePlayerStats = applyMods(playerStatsRef.current, activeModIds);
                let next = updateHorde(s, dt, inputRef.current, effectivePlayerStats, eaRef.current, activeModIds);
                if (next.generation > s.generation) {
                    const best = next.population.individuals.reduce((a, b) => b.fitness > a.fitness ? b : a);
                    setBestDna([...best.dna]);
                }
                if (next.phase === 'dead') {
                    setUiPhase('dead');
                    setUiScore(next.score);
                    setUiGen(next.generation);
                    hordeRunStore.record({ score: next.score, generation: next.generation });
                    // The run is over — nothing left to resume. "Last Run" above
                    // already has the score/generation via hordeRunStore.
                    hordeGameStore.state = null;
                    hordeGameStore.notify();
                } else if (modChoiceEnabledRef.current && Math.floor(next.score / killsPerUpgradeRef.current) > Math.floor(s.score / killsPerUpgradeRef.current)) {
                    // Kill-Meilenstein erreicht (Vampire-Survivors-Stil): Auswahl anbieten,
                    // falls noch nicht unlockte Mods übrig sind — sonst einfach weiterspielen.
                    const available = MOD_POOL.filter(m => !runModsStore.activeModIds.includes(m.id));
                    if (available.length > 0) {
                        const shuffled = [...available].sort(() => Math.random() - 0.5);
                        setPendingModChoices(shuffled.slice(0, Math.min(MOD_CHOICE_COUNT, available.length)));
                        setUiPhase('choosing');
                        next = { ...next, phase: 'choosing' };
                    }
                }

                if (tutorial) {
                    const step = tutorialStepRef.current;
                    const inp  = inputRef.current;
                    if (step === 'move' && (inp.up || inp.down || inp.left || inp.right)) {
                        requestTutorialStep('aim');
                    } else if (step === 'aim') {
                        if (tutorialAimOriginRef.current === null) {
                            tutorialAimOriginRef.current = { x: inp.mouseX, y: inp.mouseY };
                        } else {
                            const dx = inp.mouseX - tutorialAimOriginRef.current.x;
                            const dy = inp.mouseY - tutorialAimOriginRef.current.y;
                            if (dx * dx + dy * dy > 40 * 40) requestTutorialStep('shoot');
                        }
                    } else if (step === 'shoot' && inp.shoot) {
                        requestTutorialStep('obstacles');
                    } else if (step === 'obstacles' && next.score >= 1) {
                        // The DNA panel only renders when !hideDnaPanel (mobile
                        // landscape hides it for the touch zones) — skip the
                        // step pointing at it rather than reference nothing.
                        requestTutorialStep(hideDnaPanel ? 'mods' : 'evolution');
                    } else if (step === 'evolution') {
                        requestTutorialStep('mods');
                    } else if (step === 'mods' && next.phase === 'choosing') {
                        requestTutorialStep('done');
                    }
                    tickTutorialStep();
                }

                stateRef.current = next;
                if (next.phase !== 'dead') hordeGameStore.state = next;
                render(ctx, next);
            } else {
                render(ctx, s);
            }

            animId = requestAnimationFrame(loop);
        };

        animId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const overlay: React.CSSProperties = {
        position:       'absolute',
        inset:          0,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            16,
        background:     'rgba(15,15,26,0.78)',
        fontFamily:     '"JetBrains Mono", monospace',
        color:          '#fff',
    };

    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexShrink: 0 }}>
        {/* Mirrors the DNA panel's width on the other side so the canvas itself
            stays centered instead of being pushed left by the panel. */}
        {!hideDnaPanel && <div style={{ width: PANEL_W, flexShrink: 0 }} />}
        <div style={{ width: ARENA.WIDTH * scale, height: ARENA.HEIGHT * scale, position: 'relative', flexShrink: 0 }}>
            <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', position: 'absolute', top: 0, left: 0 }}>
                <canvas ref={canvasRef} width={ARENA.WIDTH} height={ARENA.HEIGHT} style={{ display: 'block' }} />

                {uiPhase === 'start' && (
                    <div style={{ ...overlay, pointerEvents: 'auto' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: HC, letterSpacing: '0.12em' }}>
                            {tutorial ? 'HORDE TUTORIAL' : 'HORDE MODE'}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', maxWidth: 320, lineHeight: 1.7 }}>
                            {tutorial ? (
                                <>
                                    Practice against harmless dummies — they barely move.<br />
                                    Learn the pillars for cover and the powerup picks along the way.
                                </>
                            ) : (
                                <>
                                    Agents rush toward you — one shot kills.<br />
                                    If one touches you, it&apos;s over.<br />
                                    Every kill evolves the next spawn.
                                </>
                            )}
                        </div>
                        <button style={{ ...BTN, marginTop: 8 }} onClick={startGame}>
                            {tutorial ? 'Start Tutorial →' : 'Start →'}
                        </button>
                    </div>
                )}

                {uiPhase === 'choosing' && pendingModChoices !== null && (
                    <div style={{ ...overlay, pointerEvents: 'auto' }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: HC, letterSpacing: '0.1em' }}>CHOOSE A MOD</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{uiScore} kills so far</div>
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 640 }}>
                            {pendingModChoices.map(mod => (
                                <button
                                    key={mod.id}
                                    onClick={() => chooseHordeMod(mod)}
                                    style={{
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                        width: 170, padding: '18px 14px',
                                        background: 'rgba(255,255,255,0.05)', border: `1px solid ${HC}55`,
                                        borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                >
                                    <span style={{ fontSize: 26 }}>{mod.icon}</span>
                                    <span style={{ fontSize: 14, fontWeight: 700, color: HC, textAlign: 'center' }}>{mod.name}</span>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{mod.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {uiPhase === 'dead' && (
                    <div style={{ ...overlay, pointerEvents: 'auto' }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: '#ef5350', letterSpacing: '0.1em' }}>YOU DIED</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.8, textAlign: 'center' }}>
                            {uiScore} kills · Gen {uiGen}
                        </div>
                        <button style={{ ...BTN, marginTop: 8 }} onClick={startGame}>Try Again →</button>
                    </div>
                )}

                {tutorial && uiPhase === 'playing' && !tutorialBubbleClosed && (
                    <CompiBubble
                        title={HORDE_TUTORIAL_STEP_CONTENT[tutorialStep].title}
                        body={HORDE_TUTORIAL_STEP_CONTENT[tutorialStep].body}
                        actions={tutorialStep === 'done'
                            ? [{ label: 'Finish Tutorial → Lobby', onClick: finishTutorial, variant: 'primary' }]
                            : []}
                        onClose={() => setTutorialBubbleClosed(true)}
                    />
                )}
            </div>
        </div>
        {!hideDnaPanel && <HordeDnaPanel bestDna={bestDna} height={ARENA.HEIGHT * scale} />}
        </div>
    );
}
