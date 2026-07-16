import type { Population, Individual, DNA, PlayerGhost, RoundStats } from '../../shooter.types';
import { GAME_CONFIG, DNA_LENGTH, DNA_INDEX, ARENA, emptyStats } from '../../shooter.types';
import { vec } from '../core/vec';
import { makeLCG, type RNG } from '../../../../utils/rng';
import { computeShotPlan } from '../../mods/modTypes';
import {
    steerHomingBullet, homingActive, tryWallBounce,
    HOMING_TURN_RATE, RICOCHET_MOD_ID, RICOCHET_BOUNCES,
    type QueuedShot,
} from '../../mods/shotEngine';
import { updatePopulationStats, initPopulation } from './population';
import { calculateFitness } from './fitness';

const INJECTION_COUNT = 4;

// ---- Selektion ----
function tournamentSelect(individuals: Individual[], tournamentSize = 3): Individual {
    const candidates = Array.from({ length: tournamentSize }, () =>
        individuals[Math.floor(Math.random() * individuals.length)]
    );
    return candidates.reduce((best, c) => c.fitness > best.fitness ? c : best);
}

// ---- Crossover ----
function crossover(dnaA: number[], dnaB: number[], type: 'uniform' | 'single-point' = 'uniform'): number[] {
    if (type === 'single-point') {
        const point = Math.floor(Math.random() * (DNA_LENGTH - 1)) + 1;
        return [...dnaA.slice(0, point), ...dnaB.slice(point)];
    }
    return dnaA.map((gene, i) => Math.random() < 0.5 ? gene : dnaB[i]);
}

// ---- Mutation ----
function mutate(
    dna:      number[],
    rate:     number = GAME_CONFIG.MUTATION_RATE,
    strength: number = GAME_CONFIG.MUTATION_STRENGTH,
): number[] {
    return dna.map(gene => {
        if (Math.random() < rate) {
            const delta = (Math.random() * 2 - 1) * strength;
            return Math.max(0, Math.min(1, gene + delta));
        }
        return gene;
    });
}

// ---- Evolution ----
export function evolve(
    population:          Population,
    agentFitness?:       number,
    mutationRate:        number = GAME_CONFIG.MUTATION_RATE,
    mutationStrength:    number = GAME_CONFIG.MUTATION_STRENGTH,
    crossoverType:       'uniform' | 'single-point' = 'uniform',
    injectionDeviation:  number = 0.3,
): Population {
    const updatedIndividuals = [...population.individuals];
    if (agentFitness !== undefined) {
        updatedIndividuals[0] = { ...updatedIndividuals[0], fitness: agentFitness };
    }

    const sorted  = [...updatedIndividuals].sort((a, b) => b.fitness - a.fitness);
    const elites  = sorted.slice(0, GAME_CONFIG.ELITE_COUNT).map(i => ({ ...i }));
    const popSize = population.individuals.length;

    const offspring: Individual[] = [];
    while (offspring.length < popSize - GAME_CONFIG.ELITE_COUNT - INJECTION_COUNT) {
        const parent1  = tournamentSelect(sorted);
        const parent2  = tournamentSelect(sorted);
        const childDna = mutate(crossover(parent1.dna, parent2.dna, crossoverType), mutationRate, mutationStrength);
        offspring.push({ dna: childDna, fitness: 0 });
    }

    const bestDna = sorted[0].dna;
    const injected: Individual[] = Array.from(
        { length: INJECTION_COUNT },
        () => ({
            dna: bestDna.map(v =>
                Math.max(0, Math.min(1, v + (Math.random() * 2 - 1) * injectionDeviation))
            ),
            fitness: 0,
        }),
    );

    return updatePopulationStats({
        generation:  population.generation + 1,
        individuals: [...elites, ...offspring, ...injected],
        bestFitness: 0,
        avgFitness:  0,
    });
}

export function getNextAgent(population: Population): number[] {
    return population.individuals[0].dna;
}

// ---- Simulation Types ----
// Exportiert, weil das Trainings-Replay (EvolutionReplayOverlay) die
// Sim-Zustände zum Zeichnen liest.
export interface SimAgent {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    rot:      number;
    cooldown: number;
}

export interface SimBullet {
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    lifetime: number;
    radius:   number;
    bounces?: number; // Ricochet-Mod: verbleibende Wand-Abpraller
}

// ---- Simulation Helpers ----
function moveBullets(bullets: SimBullet[], dt: number): SimBullet[] {
    return bullets
        .map(b => {
            const moved = {
                ...b,
                position: vec.add(b.position, vec.scale(b.velocity, dt)),
                velocity: { ...b.velocity },
                lifetime: b.lifetime - dt,
            };
            // Ricochet Rounds: an der Wand reflektieren (no-op ohne bounces)
            tryWallBounce(moved);
            return moved;
        })
        .filter(b =>
            b.lifetime > 0 &&
            b.position.x > 0 && b.position.x < ARENA.WIDTH &&
            b.position.y > 0 && b.position.y < ARENA.HEIGHT
        );
}

function stepAgent(
    dna:          DNA,
    agent:        SimAgent,
    enemy:        SimAgent,
    enemyBullets: SimBullet[],
    dt:           number,
    rng:          RNG,
): [SimAgent, SimBullet | null] {
    // 1. Auf Gegner zubewegen
    const toEnemy    = vec.normalize(vec.sub(enemy.pos, agent.pos));
    const chaseForce = vec.scale(toEnemy, dna[DNA_INDEX.AGGRESSION]);

    // 2. Ausweichen
    const nearBullet = enemyBullets
        .filter(b => vec.distance(b.position, agent.pos) < 120)
        .sort((a, b) => vec.distance(a.position, agent.pos) - vec.distance(b.position, agent.pos))[0];

    const dodgeForce = (() => {
        if (!nearBullet) return vec.zero();
        if (rng() > dna[DNA_INDEX.DODGE_WEIGHT]) return vec.zero();
        const perp    = vec.perpendicular(vec.normalize(nearBullet.velocity));
        const toAgent = vec.sub(agent.pos, nearBullet.position);
        let side      = perp.x * toAgent.x + perp.y * toAgent.y >= 0 ? 1 : -1;
        const margin  = GAME_CONFIG.AGENT_RADIUS + 40;
        const dx = perp.x * side;
        const dy = perp.y * side;
        const intoWall =
            (dx > 0 && agent.pos.x > ARENA.WIDTH  - margin) ||
            (dx < 0 && agent.pos.x < margin) ||
            (dy > 0 && agent.pos.y > ARENA.HEIGHT - margin) ||
            (dy < 0 && agent.pos.y < margin);
        if (intoWall) side = -side;
        return vec.scale(perp, side * dna[DNA_INDEX.MOVEMENT_SPEED]);
    })();

    // 3. Abstand halten
    const dist          = vec.distance(agent.pos, enemy.pos);
    const preferredDist = dna[DNA_INDEX.PREFERRED_RANGE] * 300 + 100;
    const rangeFactor   = (dist - preferredDist) / (preferredDist + 1);
    const rangeForce    = vec.scale(toEnemy, rangeFactor * 0.5);

    // Bewegung — Chase nur außerhalb der Wunschdistanz, wie updateAgent im
    // echten Spiel (gameLoop.ts): innerhalb übernimmt allein die Range-
    // Abstoßung, sonst überstimmt Pursuit das PREFERRED_RANGE-Gen fast
    // vollständig (Gleichgewicht rutscht z. B. bei Pursuit 0.39 von 400px
    // auf ~87px).
    const chase    = dist >= preferredDist ? chaseForce : vec.zero();
    const combined = vec.add(vec.add(chase, dodgeForce), rangeForce);
    const speed    = GAME_CONFIG.AGENT_SPEED_BASE + dna[DNA_INDEX.MOVEMENT_SPEED] * GAME_CONFIG.AGENT_SPEED_BONUS;
    agent.vel = vec.scale(vec.add(agent.vel, vec.scale(vec.normalize(combined), speed)), 0.82);
    agent.pos = vec.clamp(
        vec.add(agent.pos, vec.scale(agent.vel, dt)),
        GAME_CONFIG.AGENT_RADIUS, ARENA.WIDTH  - GAME_CONFIG.AGENT_RADIUS,
        GAME_CONFIG.AGENT_RADIUS, ARENA.HEIGHT - GAME_CONFIG.AGENT_RADIUS,
    );

    // 4. Zielen
    const predictedPos = vec.add(enemy.pos, vec.scale(enemy.vel, dna[DNA_INDEX.PREDICT_LEAD] * 0.4));
    agent.rot = vec.angle(agent.pos, predictedPos);

    // 5. Schießen
    let newBullet: SimBullet | null = null;
    agent.cooldown -= dt;
    if (agent.cooldown <= 0) {
        const scatter  = (rng() - 0.5) * (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 1.2;
        agent.cooldown = GAME_CONFIG.SHOOT_COOLDOWN_MIN +
            (1 - dna[DNA_INDEX.FIRE_RATE]) * GAME_CONFIG.SHOOT_COOLDOWN_MAX;

        const bulletSpeed = GAME_CONFIG.BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN);
        newBullet = {
            position: { ...agent.pos },
            velocity: vec.scale(vec.fromAngle(agent.rot + scatter), bulletSpeed),
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
        };
    }

    return [agent, newBullet];
}

// ---- Kampfsimulation ----
function simulateFight(dnaA: DNA, dnaB: DNA): [number, number] {
    let agentA: SimAgent = {
        pos: { x: 200, y: ARENA.HEIGHT / 2 },
        vel: vec.zero(),
        rot: 0,
        cooldown: 0,
    };
    let agentB: SimAgent = {
        pos: { x: ARENA.WIDTH - 200, y: ARENA.HEIGHT / 2 },
        vel: vec.zero(),
        rot: Math.PI,
        cooldown: 0,
    };

    const rng = makeLCG();

    let bulletsA: SimBullet[] = [];
    let bulletsB: SimBullet[] = [];
    const statsA = emptyStats();
    const statsB = emptyStats();

    const dt    = 1 / 30;
    const steps = Math.floor(30 / dt); // 30 Sekunden simulieren

    for (let step = 0; step < steps; step++) {
        const [newAgentA, bulletA] = stepAgent(dnaA, agentA, agentB, bulletsB, dt, rng);
        const [newAgentB, bulletB] = stepAgent(dnaB, agentB, agentA, bulletsA, dt, rng);

        agentA = newAgentA;
        agentB = newAgentB;

        if (bulletA) bulletsA.push(bulletA);
        if (bulletB) bulletsB.push(bulletB);

        bulletsA = moveBullets(bulletsA, dt);
        bulletsB = moveBullets(bulletsB, dt);

        // Kollision A → B
        bulletsA = bulletsA.filter(b => {
            if (vec.distance(b.position, agentB.pos) < GAME_CONFIG.AGENT_RADIUS + b.radius) {
                statsA.hitsLanded++;
                statsB.hitsReceived++;
                return false;
            }
            return true;
        });

        // Kollision B → A
        bulletsB = bulletsB.filter(b => {
            if (vec.distance(b.position, agentA.pos) < GAME_CONFIG.AGENT_RADIUS + b.radius) {
                statsB.hitsLanded++;
                statsA.hitsReceived++;
                return false;
            }
            return true;
        });

        statsA.timeAlive = step * dt;
        statsB.timeAlive = step * dt;
    }

    return [calculateFitness(statsA), calculateFitness(statsB)];
}

// ---- Presimulation ----
export function presimulate(generations: number): Population {
    let pop = initPopulation();

    for (let i = 0; i < generations; i++) {
        const fitnesses = new Array(pop.individuals.length).fill(0);

        // Round Robin – jeder gegen jeden
        for (let a = 0; a < pop.individuals.length; a++) {
            for (let b = a + 1; b < pop.individuals.length; b++) {
                const [fA, fB] = simulateFight(
                    pop.individuals[a].dna,
                    pop.individuals[b].dna,
                );
                fitnesses[a] += fA;
                fitnesses[b] += fB;
            }
        }

        pop.individuals = pop.individuals.map((ind, i) => ({
            ...ind,
            fitness: fitnesses[i],
        }));

        pop = evolve(pop);
    }

    return pop;
}

// ---- Ghost Simulation ----

/**
 * Schrittweise Simulation eines Agenten gegen das Player-Recording — die eine
 * Quelle der Sim-Regeln: `simulateAgainstGhost` (Fitness-Bewertung in der
 * Presim) läuft sie am Stück durch, das Trainings-Replay
 * (EvolutionReplayOverlay) Frame für Frame zum Zuschauen. Ein Schritt
 * entspricht einem Ghost-Frame (1/60 s).
 */
export interface GhostSim {
    readonly agent:         SimAgent;
    readonly agentBullets:  readonly SimBullet[];
    readonly playerBullets: readonly SimBullet[];
    readonly stats:         RoundStats;
    /** Index des nächsten Ghost-Frames (= bereits simulierte Schritte). */
    readonly frame:         number;
    readonly done:          boolean;
    /** Einen Ghost-Frame simulieren; no-op wenn das Recording durch ist. */
    step(): void;
}

// Seed deterministisch aus der DNA ableiten: gleiche DNA ⇒ gleicher
// Zufallsstrom ⇒ Fitness-Bewertung und Trainings-Replay laufen identisch ab.
function dnaSeed(dna: DNA): number {
    return dna.reduce(
        (h, gene) => (Math.imul(h, 31) + Math.round(gene * 1e9)) >>> 0,
        0x9e3779b9,
    );
}

export function createGhostSim(dna: DNA, ghost: PlayerGhost): GhostSim {
    const rng = makeLCG(dnaSeed(dna));
    let agent: SimAgent = {
        pos:      { x: ARENA.WIDTH - 200, y: ARENA.HEIGHT / 2 },
        vel:      vec.zero(),
        rot:      Math.PI,
        cooldown: 0,
    };

    type TrackedBullet = SimBullet & { _id: number; homing: boolean };

    let agentBullets:  SimBullet[]     = [];
    let playerBullets: TrackedBullet[] = [];
    const stats        = emptyStats();
    let nextBulletId   = 0;
    const dodgedIds    = new Set<number>();
    let step           = 0;

    // Mods des Spielers zur Aufnahmezeit: reale Bullet Speed und Schuss-Plan
    // (Triple/Burst/Homing) — pro Trigger-Pull identisch, daher einmal berechnet.
    const bulletSpeed = ghost.bulletSpeed ?? GAME_CONFIG.BULLET_SPEED;
    const shotPlan    = computeShotPlan(ghost.activeModIds ?? []);
    const bounces     = (ghost.activeModIds ?? []).includes(RICOCHET_MOD_ID) ? RICOCHET_BOUNCES : 0;
    const queuedShots: QueuedShot[] = [];

    // Nicht die aufgezeichnete Schussrichtung übernehmen, sondern auf die
    // aktuelle Position DIESES Sim-Agenten zielen: der Agent läuft ja anders
    // als der Gegner der Original-Runde, aufgezeichnete Schüsse gingen sonst
    // systematisch ins Leere. So muss jeder Kandidat gezielten Schüssen
    // ausweichen.
    const fireShot = (
        origin:           { x: number; y: number },
        fallbackRotation: number,
        angleOffset:      number,
        speedMult:        number,
        homing:           boolean,
    ) => {
        const toAgent = vec.sub(agent.pos, origin);
        const aim     = vec.distance(agent.pos, origin) > 1
            ? Math.atan2(toAgent.y, toAgent.x)
            : fallbackRotation;
        playerBullets.push({
            _id:      nextBulletId++,
            homing,
            bounces,
            position: { ...origin },
            velocity: vec.scale(vec.fromAngle(aim + angleOffset), bulletSpeed * speedMult),
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
        });
    };

    return {
        get agent()         { return agent; },
        get agentBullets()  { return agentBullets; },
        get playerBullets() { return playerBullets; },
        get stats()         { return stats; },
        get frame()         { return step; },
        get done()          { return step >= ghost.frames.length; },

        step() {
            if (step >= ghost.frames.length) return;
            const frame = ghost.frames[step];
            const dt    = 1 / 60;

            if (frame.shot) {
                for (const shot of shotPlan) {
                    if (shot.delay <= 0) {
                        fireShot(frame.position, frame.rotation, shot.angleOffset, shot.speedMult, shot.homing ?? false);
                    } else {
                        queuedShots.push({ timer: shot.delay, angleOffset: shot.angleOffset, speedMult: shot.speedMult, homing: shot.homing ?? false });
                    }
                }
            }

            // Verzögerte Burst-Schüsse: feuern von der aktuellen Ghost-Position
            // aus, wenn ihr Timer abläuft (wie queuedPlayerShots in gameLoop.ts)
            for (let i = queuedShots.length - 1; i >= 0; i--) {
                queuedShots[i].timer -= dt;
                if (queuedShots[i].timer <= 0) {
                    const q = queuedShots[i];
                    fireShot(frame.position, frame.rotation, q.angleOffset, q.speedMult, q.homing);
                    queuedShots.splice(i, 1);
                }
            }

            // Homing Rounds: Player-Bullets Richtung Agent eindrehen — wie im
            // echten Spiel nur während der ersten Flugsekunde (homingActive)
            for (const b of playerBullets) {
                if (b.homing && homingActive(b.lifetime)) steerHomingBullet(b.position, b.velocity, agent.pos, HOMING_TURN_RATE, dt);
            }

            const ghostAsEnemy: SimAgent = {
                pos:      { ...frame.position },
                vel:      { ...frame.velocity },
                rot:      frame.rotation,
                cooldown: 0,
            };

            const [newAgent, agentBullet] = stepAgent(dna, agent, ghostAsEnemy, playerBullets, dt, rng);
            agent = newAgent;
            if (agentBullet) {
                agentBullets.push(agentBullet);
                stats.bulletsFired++;
            }

            agentBullets  = moveBullets(agentBullets, dt);
            // moveBullets verwendet { ...b } spread, daher bleibt _id bei Runtime erhalten
            playerBullets = moveBullets(playerBullets as SimBullet[], dt) as TrackedBullet[];

            // Distanz-Tracking
            stats.distanceSum     += vec.distance(agent.pos, frame.position);
            stats.distanceSamples += 1;

            // Agent-Bullet trifft Ghost
            agentBullets = agentBullets.filter(b => {
                if (vec.distance(b.position, frame.position) < GAME_CONFIG.PLAYER_RADIUS + b.radius) {
                    stats.hitsLanded++;
                    return false;
                }
                return true;
            });

            // Player-Bullet trifft Agent oder knapper Vorbeiflug
            playerBullets = playerBullets.filter(b => {
                const d = vec.distance(b.position, agent.pos);
                if (d < GAME_CONFIG.AGENT_RADIUS + b.radius) {
                    stats.hitsReceived++;
                    return false;
                }
                if (d < GAME_CONFIG.NEAR_MISS_RADIUS && !dodgedIds.has(b._id)) {
                    stats.dodgedBullets++;
                    dodgedIds.add(b._id);
                }
                return true;
            });

            stats.timeAlive = step * dt;
            step++;
        },
    };
}

function simulateAgainstGhost(dna: DNA, ghost: PlayerGhost): number {
    const sim = createGhostSim(dna, ghost);
    while (!sim.done) sim.step();
    return calculateFitness(sim.stats);
}

export function presimulateAgainstGhost(
    generations:      number,
    ghost:            PlayerGhost,
    startPopulation:  Population,
    crossoverType:    'uniform' | 'single-point' = 'uniform',
    hallOfFameGhost?: PlayerGhost,
    // Fürs Trainings-Replay: liefert die zuletzt evaluierte Generation
    // (Individuen MIT ihren Ghost-Fitness-Werten), bevor evolve() sie durch
    // Nachkommen ersetzt — das sind genau die Bewertungen, die die Auswahl
    // der nächsten Gegner-DNA entschieden haben.
    onLastEvaluation?: (individuals: Individual[]) => void,
): Population {
    let pop = startPopulation;

    for (let i = 0; i < generations; i++) {
        pop.individuals = pop.individuals.map(ind => {
            const lastFitness = simulateAgainstGhost(ind.dna, ghost);
            const hofFitness  = hallOfFameGhost
                ? simulateAgainstGhost(ind.dna, hallOfFameGhost)
                : 0;
            return {
                ...ind,
                fitness: hallOfFameGhost
                    ? (lastFitness + hofFitness) / 2
                    : lastFitness,
            };
        });

        if (i === generations - 1) {
            onLastEvaluation?.(pop.individuals.map(ind => ({ ...ind, dna: [...ind.dna] })));
        }

        pop = evolve(pop, undefined, GAME_CONFIG.MUTATION_RATE, GAME_CONFIG.MUTATION_STRENGTH, crossoverType);
    }

    return pop;
}
