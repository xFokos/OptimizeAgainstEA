import type { GameState, InputState, AgentState, PlayerState, Bullet } from '../../shooter.types';
import { GAME_CONFIG, ARENA } from '../../shooter.types';
import { vec } from './vec';

let bulletIdCounter    = 0;
let playerShootCooldown = 0;
let agentShootCooldown  = 0;

// Pure(ish) update-Funktion – kriegt alten State, gibt neuen zurück
export function update(
    state: GameState,
    dt:    number,
    input: InputState,
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
    player.velocity = vec.scale(normalizedMove, GAME_CONFIG.PLAYER_SPEED);

    // Rotation = Richtung der Bewegung (oder bleibt wenn stillstehend)
    if (vec.length(normalizedMove) > 0) {
        player.rotation = Math.atan2(normalizedMove.y, normalizedMove.x);
    }

    player.position = vec.clamp(
        vec.add(player.position, vec.scale(player.velocity, dt)),
        GAME_CONFIG.PLAYER_RADIUS, ARENA.WIDTH  - GAME_CONFIG.PLAYER_RADIUS,
        GAME_CONFIG.PLAYER_RADIUS, ARENA.HEIGHT - GAME_CONFIG.PLAYER_RADIUS,
    );

    // ---- Spieler schießt ----
    if (input.shoot && playerShootCooldown === 0) {
        playerShootCooldown = GAME_CONFIG.SHOOT_COOLDOWN;
        const bulletVel = vec.scale(vec.fromAngle(player.rotation), GAME_CONFIG.BULLET_SPEED);
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
    agent = updateAgent(agent, player, bullets, dt);

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
    let   newBullets = [...bullets];

    // Distanz-Tracking für Fitness
    const dist = vec.distance(player.position, agent.position);
    newStats.distanceSum     = (agent.stats.distanceSum     ?? 0) + dist;
    newStats.distanceSamples = (agent.stats.distanceSamples ?? 0) + 1;

    newBullets = newBullets.filter(bullet => {
        // Agent-Bullet trifft Spieler
        if (bullet.ownerId === 'agent') {
            if (vec.distance(bullet.position, player.position) < GAME_CONFIG.PLAYER_RADIUS + bullet.radius) {
                newStats.hitsLanded = newStats.hitsLanded + 1;
                return false; // Bullet entfernen
            }
        }

        // Spieler-Bullet trifft Agent
        if (bullet.ownerId === 'player') {
            if (vec.distance(bullet.position, agent.position) < GAME_CONFIG.AGENT_RADIUS + bullet.radius) {
                newStats.hitsReceived = newStats.hitsReceived + 1;
                return false;
            }
            // Near-miss: Bullet geht nah an Agent vorbei ohne zu treffen
            if (vec.distance(bullet.position, agent.position) < GAME_CONFIG.NEAR_MISS_RADIUS) {
                newStats.dodgedBullets = newStats.dodgedBullets + 1;
            }
        }

        return true;
    });

    agent = { ...agent, stats: newStats };

    return {
        ...state,
        roundTimer,
        player,
        agent,
        bullets: newBullets,
    };
}

// ---- Agent KI ----
function updateAgent(
    agent:   AgentState,
    player:  PlayerState,
    bullets: Bullet[],
    dt:      number,
): AgentState {
    const dna = agent.dna;

    // 1. Auf Spieler zubewegen
    const toPlayer  = vec.normalize(vec.sub(player.position, agent.position));
    const chaseForce = vec.scale(toPlayer, dna[0]); // AGGRESSION

    // 2. Eingehende Bullets ausweichen
    const nearBullet = bullets
        .filter(b => b.ownerId === 'player' && vec.distance(b.position, agent.position) < 180)
        .sort((a, b) => vec.distance(a.position, agent.position) - vec.distance(b.position, agent.position))[0];

    const dodgeForce = nearBullet
        ? vec.scale(vec.perpendicular(vec.normalize(nearBullet.velocity)), dna[1]) // DODGE_WEIGHT
        : vec.zero();

    // 3. Abstand zum Spieler regulieren
    const dist          = vec.distance(agent.position, player.position);
    const preferredDist = dna[3] * 300; // PREFERRED_RANGE × 300px
    const rangeFactor   = (dist - preferredDist) / (preferredDist + 1);
    const rangeForce    = vec.scale(toPlayer, rangeFactor * 0.5);

    // Kräfte kombinieren
    const combined = vec.add(vec.add(chaseForce, dodgeForce), rangeForce);
    const speed    = 80 + dna[4] * 180; // MOVEMENT_SPEED: 80–260 px/s
    const movement = vec.scale(vec.normalize(combined), speed);

    // Dämpfen für flüssigere Bewegung
    agent.velocity = vec.scale(vec.add(agent.velocity, movement), 0.82);

    agent.position = vec.clamp(
        vec.add(agent.position, vec.scale(agent.velocity, dt)),
        GAME_CONFIG.AGENT_RADIUS, ARENA.WIDTH  - GAME_CONFIG.AGENT_RADIUS,
        GAME_CONFIG.AGENT_RADIUS, ARENA.HEIGHT - GAME_CONFIG.AGENT_RADIUS,
    );

    // 4. Zielen – Spieler "leaden"
    const leadAmount    = dna[5]; // PREDICT_LEAD
    const predictedPos  = vec.add(player.position, vec.scale(player.velocity, leadAmount * 0.4));
    const aimAngle      = vec.angle(agent.position, predictedPos);
    const scatter       = (Math.random() - 0.5) * (1 - dna[2]) * 1.2; // SHOOT_ACCURACY
    agent.rotation      = aimAngle + scatter;

    // 5. Schießen (cooldown wird außerhalb verwaltet)
    if (agentShootCooldown === 0) {
        agentShootCooldown = GAME_CONFIG.SHOOT_COOLDOWN * (0.8 + (1 - dna[0]) * 0.8);
        const bulletVel = vec.scale(vec.fromAngle(agent.rotation), GAME_CONFIG.BULLET_SPEED);
        agent.pendingBullet = {
            id:       `a_${bulletIdCounter++}`,
            position: { ...agent.position },
            velocity: bulletVel,
            ownerId:  'agent',
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
        };
        agent.stats = { ...agent.stats, bulletsFired: agent.stats.bulletsFired + 1 };
    }

    return agent;
}