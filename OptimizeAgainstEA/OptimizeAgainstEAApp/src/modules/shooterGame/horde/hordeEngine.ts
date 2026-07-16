import {
    ARENA, GAME_CONFIG, DNA_INDEX, DNA_LENGTH,
    type InputState, type Bullet, type Population, type Individual, type DNA, type PlayerStats,
} from '../shooter.types';
import type { HordeGameState, HordeAgent, HordePhase, HordeMap, HordeSpawnSide, HordeObstacle } from './hordeTypes';
import { LOOP_STEPS, LOOP_STEP_DURATION, LOOP_GENE_START, loopOffsetRad, SIZE_GENE_INDEX, OPACITY_GENE_INDEX } from './hordeDna';
import { circleIntersectsObstacle, pushOutOfObstacles } from './hordeCollision';
import { computeFlowField, sampleFlowField } from './hordePathfinding';
import { computeShotPlan, applyMods } from '../mods/modTypes';
import {
    steerHomingBullet, shieldBlocks, homingActive,
    HOMING_TURN_RATE, SHIELD_MOD_ID, SHIELD_SPIN_RATE,
    type QueuedShot,
} from '../mods/shotEngine';
import type { HordeSettings } from '../../../context/SettingsContext';

// Pure Horde game logic: per-frame update, spawn helpers, and the per-death
// mini-GA. No React, no canvas — HordeCanvas.tsx wires this into the app.

// Horde has its own mutation/crossover tuning (via HordeSettings) — deliberately
// decoupled from the shared EASettings used by Solo Play, so changing difficulty
// here never bleeds into the other game mode.
export type HordeEA = Pick<HordeSettings, 'mutationRate' | 'mutationStrength' | 'crossoverType' | 'shootCooldown'>;

// ---- Constants ----

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

export function agentRadius(dna: DNA): number {
    const gene = dna[SIZE_GENE_INDEX] ?? 0.5;
    return MIN_AGENT_R + gene * (MAX_AGENT_R - MIN_AGENT_R);
}

export function agentOpacity(dna: DNA): number {
    const gene = dna[OPACITY_GENE_INDEX] ?? 0.5;
    return MIN_OPACITY + gene * (MAX_OPACITY - MIN_OPACITY);
}

let bulletCounter = 0;
let shootTimer    = 0; // countdown until the player can fire again; reset to ea.shootCooldown

// Schüsse aus Verhaltens-Mods (Burst Shot etc.), zeitversetzt nach dem Trigger-Pull.
// Meist leer → kein GC-Druck. Homing-Turn-Rate: geteilt mit Solo (shotEngine.ts).
const hordeQueuedShots: QueuedShot[] = [];

// Orbit-Shield-Mod: Rotationswinkel der Orbs (Anzeige + Kollision, kein GA-Einfluss)
let shieldAngle = 0;
export function getHordeShieldAngle() { return shieldAngle; }

let agentIdCounter = 0;

/** Zero the module-level per-run state (id/bullet counters, shoot cooldown,
 *  queued mod shots). Call once per fresh run, before makeInitialState. */
export function resetHordeEngine() {
    agentIdCounter = 0;
    bulletCounter  = 0;
    shootTimer     = 0;
    hordeQueuedShots.length = 0;
    shieldAngle    = 0;
}

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

export function makeInitialState(pop: Population, map: HordeMap): HordeGameState {
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

export function updateHorde(
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
        // Horde nutzt den eigenen Cooldown aus den HordeSettings, nicht den aus
        // pStats — Cooldown-Mods (Rapid Fire, Burst Shot ×3) müssen deshalb hier
        // separat auf ea.shootCooldown angewendet werden. Nur beim Trigger-Pull,
        // nicht pro Frame.
        shootTimer = applyMods({ ...pStats, shootCooldown: ea.shootCooldown }, activeModIds).shootCooldown;
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

    // --- Orbit Shield: in Horde schießt niemand, also blocken die Orbs die
    // Agenten selbst — Berührung zerstört sie und zählt als Kill (füttert
    // damit ganz normal die Mini-GA über den removeIds-Pfad unten). ---
    if (activeModIds.includes(SHIELD_MOD_ID)) {
        shieldAngle += SHIELD_SPIN_RATE * dt;
        for (const a of agents) {
            if (!a.alive) continue;
            if (shieldBlocks(player.position, shieldAngle, a.position.x, a.position.y, agentRadius(a.dna))) {
                hitIds.add(a.id);
                score++;
            }
        }
    }

    for (const b of bullets) {
        // Homing Rounds: Richtung nächsten lebenden Agenten eindrehen — nur
        // während der ersten Flugsekunde (homingActive), danach geradeaus
        if (b.homing && b.ownerId === 'player' && homingActive(b.lifetime)) {
            let nearest: HordeAgent | undefined;
            let nearestD2 = Infinity;
            for (const a of agents) {
                if (!a.alive) continue;
                const dx = a.position.x - b.position.x;
                const dy = a.position.y - b.position.y;
                const d2 = dx * dx + dy * dy;
                if (d2 < nearestD2) { nearestD2 = d2; nearest = a; }
            }
            if (nearest) steerHomingBullet(b.position, b.velocity, nearest.position, HOMING_TURN_RATE, dt);
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
