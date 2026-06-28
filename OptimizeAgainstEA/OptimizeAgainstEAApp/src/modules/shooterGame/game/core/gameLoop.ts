import {
    type GameState,
    type InputState,
    type AgentState,
    type PlayerState,
    type PlayerStats,
    type Bullet,
    type PlayerGhostFrame,
    type AgentGhostFrame,
    DNA_INDEX,
} from '../../shooter.types';
import { GAME_CONFIG, ARENA } from '../../shooter.types';
import { vec } from './vec';

let bulletIdCounter     = 0;
let playerShootCooldown = 0;
let agentShootCooldown  = 0;
const dodgedBulletIdSet = new Set<string>();

export function resetGameLoop() {
    playerShootCooldown = 0;
    agentShootCooldown  = 0;
    dodgedBulletIdSet.clear();
}

// Update-Funktion – kriegt alten State, gibt neuen zurück
export function update(
    state:       GameState,
    dt:          number,
    input:       InputState,
    playerStats: PlayerStats,
): GameState {
    if (state.phase !== 'playing') return state;

    // Kopien erstellen damit wir den alten State nicht mutieren
    let player  = { ...state.player,  position: { ...state.player.position },  velocity: { ...state.player.velocity }  };
    let agent   = { ...state.agent,   position: { ...state.agent.position },   velocity: { ...state.agent.velocity }   };
    let bullets = state.bullets.map(b => ({ ...b, position: { ...b.position } }));

    // ---- Timer ----
    const roundTimer = state.roundTimer - dt;
    if (roundTimer <= 0) {
        return { ...state, phase: 'roundEnd', roundTimer: 0 };
    }

    // ---- Spieler bewegen ----
    playerShootCooldown = Math.max(0, playerShootCooldown - dt);

    const moveDir = vec.zero();
    if (input.up)    moveDir.y -= 1;
    if (input.down)  moveDir.y += 1;
    if (input.left)  moveDir.x -= 1;
    if (input.right) moveDir.x += 1;

    const normalizedMove = vec.normalize(moveDir);
    player.velocity = vec.scale(normalizedMove, playerStats.moveSpeed);


    // Rotation = Richtung der Bewegung (oder bleibt wenn stillstehend)
    player.rotation = vec.angle(player.position, {
        x: input.mouseX,
        y: input.mouseY,
    });

    player.position = vec.clamp(
        vec.add(player.position, vec.scale(player.velocity, dt)),
        GAME_CONFIG.PLAYER_RADIUS, ARENA.WIDTH  - GAME_CONFIG.PLAYER_RADIUS,
        GAME_CONFIG.PLAYER_RADIUS, ARENA.HEIGHT - GAME_CONFIG.PLAYER_RADIUS,
    );

    // ---- Spieler schießt ----
    const playerShotThisFrame = input.shoot && playerShootCooldown === 0;
    if (playerShotThisFrame) {
        playerShootCooldown = playerStats.shootCooldown;
        const bulletVel = vec.scale(vec.fromAngle(player.rotation), playerStats.bulletSpeed);
        bullets.push({
            id:       `p_${bulletIdCounter++}`,
            position: { ...player.position },
            velocity: bulletVel,
            ownerId:  'player',
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
        });
        agent = { ...agent, stats: { ...agent.stats, bulletsFired: agent.stats.bulletsFired } };
    }

    // ---- Agent bewegen (KI) ----
    agentShootCooldown = Math.max(0, agentShootCooldown - dt);
    const [updatedAgent, agentBullet] = updateAgent(agent, player, bullets, dt);
    agent = updatedAgent;
    if (agentBullet) bullets.push(agentBullet);

    // ---- Bullets bewegen & Lifetime ----
    bullets = bullets
        .map(b => ({
            ...b,
            position: vec.add(b.position, vec.scale(b.velocity, dt)),
            lifetime: b.lifetime - dt,
        }))
        .filter(b =>
            b.lifetime > 0 &&
            b.position.x > 0 && b.position.x < ARENA.WIDTH &&
            b.position.y > 0 && b.position.y < ARENA.HEIGHT
        );

    // ---- Kollisions-Detection ----
    const newStats = { ...agent.stats, timeAlive: agent.stats.timeAlive + dt };

    // Distanz-Tracking für Fitness
    const dist = vec.distance(player.position, agent.position);
    newStats.distanceSum     = (agent.stats.distanceSum     ?? 0) + dist;
    newStats.distanceSamples = (agent.stats.distanceSamples ?? 0) + 1;

    const newBullets = bullets.filter(bullet => {
        if (bullet.ownerId === 'agent') {
            if (vec.distance(bullet.position, player.position) < GAME_CONFIG.PLAYER_RADIUS + bullet.radius) {
                newStats.hitsLanded++;
                return false;
            }
        } else {
            if (vec.distance(bullet.position, agent.position) < GAME_CONFIG.AGENT_RADIUS + bullet.radius) {
                newStats.hitsReceived++;
                return false;
            }
            if (!dodgedBulletIdSet.has(bullet.id) &&
                vec.distance(bullet.position, agent.position) < GAME_CONFIG.NEAR_MISS_RADIUS) {
                newStats.dodgedBullets++;
                dodgedBulletIdSet.add(bullet.id);
            }
        }
        return true;
    });

    agent = { ...agent, stats: newStats };

    const lastPlayerFrame: PlayerGhostFrame = {
        position: { ...player.position },
        velocity: { ...player.velocity },
        rotation: player.rotation,
        shot:     playerShotThisFrame,
        time:     state.roundTimer,
    };

    const lastAgentFrame: AgentGhostFrame = {
        position: { ...agent.position },
        rotation: agent.rotation,
        shot:     agentBullet !== null,
    };

    return {
        ...state,
        roundTimer,
        player,
        agent,
        bullets:        newBullets,
        lastPlayerFrame,
        lastAgentFrame,
    };
}

// ---- Agent KI ----
function updateAgent(
    agent:   AgentState,
    player:  PlayerState,
    bullets: Bullet[],
    dt:      number,
): [AgentState, Bullet | null] {
    const dna = agent.dna;

    // 1. Auf Spieler zubewegen
    const toPlayer  = vec.normalize(vec.sub(player.position, agent.position));
    let chaseForce = vec.scale(toPlayer, dna[DNA_INDEX.AGGRESSION]);


    // 2. Eingehende Bullets ausweichen – single-pass statt filter+sort
    let nearBullet: Bullet | undefined;
    let nearDist = 120;
    for (const b of bullets) {
        if (b.ownerId !== 'player') continue;
        const d = vec.distance(b.position, agent.position);
        if (d < nearDist) { nearBullet = b; nearDist = d; }
    }

    const dodgeForce = (() => {
        if (!nearBullet) return vec.zero();
        if (Math.random() > dna[DNA_INDEX.DODGE_WEIGHT]) return vec.zero();
        const perp    = vec.perpendicular(vec.normalize(nearBullet.velocity));
        const toAgent = vec.sub(agent.position, nearBullet.position);
        let side      = perp.x * toAgent.x + perp.y * toAgent.y >= 0 ? 1 : -1;
        const margin  = GAME_CONFIG.AGENT_RADIUS + 40;
        const dx = perp.x * side;
        const dy = perp.y * side;
        const intoWall =
            (dx > 0 && agent.position.x > ARENA.WIDTH  - margin) ||
            (dx < 0 && agent.position.x < margin) ||
            (dy > 0 && agent.position.y > ARENA.HEIGHT - margin) ||
            (dy < 0 && agent.position.y < margin);
        if (intoWall) side = -side;
        return vec.scale(perp, side * dna[DNA_INDEX.MOVEMENT_SPEED]);
    })();

    // 3. Abstand zum Spieler regulieren
    const dist          = vec.distance(agent.position, player.position);
    const preferredDist = dna[DNA_INDEX.PREFERRED_RANGE] * 300 + 100; // PREFERRED_RANGE × 300px + 100px
    const rangeFactor   = (dist - preferredDist) / (preferredDist + 1);
    const rangeForce    = vec.scale(toPlayer, rangeFactor * 0.5);


    // Kräfte kombinieren
    if(preferredDist > dist) chaseForce = vec.zero();
    const combined = vec.add(vec.add(chaseForce, dodgeForce), rangeForce);
    const speed    = GAME_CONFIG.AGENT_SPEED_BASE + dna[DNA_INDEX.MOVEMENT_SPEED] * GAME_CONFIG.AGENT_SPEED_BONUS; // MOVEMENT_SPEED: 40 +  0 - 120 px/s
    const movement = vec.scale(vec.normalize(combined), speed);

    // Dämpfen für flüssigere Bewegung
    agent.velocity = vec.scale(vec.add(agent.velocity, movement), 0.82);

    agent.position = vec.clamp(
        vec.add(agent.position, vec.scale(agent.velocity, dt)),
        GAME_CONFIG.AGENT_RADIUS, ARENA.WIDTH  - GAME_CONFIG.AGENT_RADIUS,
        GAME_CONFIG.AGENT_RADIUS, ARENA.HEIGHT - GAME_CONFIG.AGENT_RADIUS,
    );

    // 4. Zielen – Spieler "leaden"
    const leadAmount    = dna[DNA_INDEX.PREDICT_LEAD]; // PREDICT_LEAD
    const predictedPos  = vec.add(player.position, vec.scale(player.velocity, leadAmount * 0.4));
    agent.rotation      = vec.angle(agent.position, predictedPos);

    // 5. Schießen (cooldown wird außerhalb verwaltet)
    let newBullet: Bullet | null = null;

    if (agentShootCooldown <= 0) {
        const scatter    = (Math.random() - 0.5) * (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 1.2;
        const agentBulletSpeed = GAME_CONFIG.BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN);
        const bulletVel = vec.scale(
            vec.fromAngle(agent.rotation + scatter),
            agentBulletSpeed
        );
        newBullet = {
            id:       `a_${bulletIdCounter++}`,
            position: { ...agent.position },
            velocity: bulletVel,
            ownerId:  'agent',
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
        };
        agent.stats = { ...agent.stats, bulletsFired: agent.stats.bulletsFired + 1 };

        agentShootCooldown = GAME_CONFIG.SHOOT_COOLDOWN_MIN +
            (1 - dna[DNA_INDEX.FIRE_RATE]) * GAME_CONFIG.SHOOT_COOLDOWN_MAX;
    }

    return [agent, newBullet];
}