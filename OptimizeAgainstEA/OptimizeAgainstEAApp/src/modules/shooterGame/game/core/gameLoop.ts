import {
    type GameState,
    type InputState,
    type AgentState,
    type PlayerState,
    type Bullet,
    type PlayerGhostFrame, // neu
    DNA_INDEX,
} from '../../shooter.types';
import { GAME_CONFIG, ARENA } from '../../shooter.types';
import { vec } from './vec';

let bulletIdCounter    = 0;
let playerShootCooldown = 0;
let agentShootCooldown  = 0;

// Update-Funktion – kriegt alten State, gibt neuen zurück
export function update(
    state: GameState,
    dt:    number,
    input: InputState,
    //mouseCordinates: { x: number; y: number },
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
    let   newBullets = [...bullets];

    // Distanz-Tracking für Fitness
    const dist = vec.distance(player.position, agent.position);
    newStats.distanceSum     = (agent.stats.distanceSum     ?? 0) + dist;
    newStats.distanceSamples = (agent.stats.distanceSamples ?? 0) + 1;

    newBullets = newBullets.filter(bullet => {
        if (bullet.ownerId === 'agent') {
            if (vec.distance(bullet.position, player.position) < GAME_CONFIG.PLAYER_RADIUS + bullet.radius) {
                newStats.hitsLanded++;
                return false;
            }
        }

        if (bullet.ownerId === 'player') {
            if (vec.distance(bullet.position, agent.position) < GAME_CONFIG.AGENT_RADIUS + bullet.radius) {
                newStats.hitsReceived++;
                return false;
            }
            if (
                !newStats.dodgedBulletIds.includes(bullet.id) &&
                vec.distance(bullet.position, agent.position) < GAME_CONFIG.NEAR_MISS_RADIUS
            ) {
                newStats.dodgedBullets++;
                newStats.dodgedBulletIds = [...newStats.dodgedBulletIds, bullet.id];
            }
        }

        return true;
    });

    agent = { ...agent, stats: newStats };

    const ghostFrame: PlayerGhostFrame = {
        position: { ...player.position },
        velocity: { ...player.velocity },
        rotation: player.rotation,
        shot:     input.shoot && playerShootCooldown === 0,
        time:     state.roundTimer,
    };

    return {
        ...state,
        roundTimer,
        player,
        agent,
        bullets:     newBullets,
        ghostFrames: [...state.ghostFrames, ghostFrame], // neu
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
    let chaseForce = vec.scale(toPlayer, (0.5 - dna[DNA_INDEX.AGGRESSION]) * 2); // AGGRESSION


    // 2. Eingehende Bullets ausweichen
    agent.dodgeSideTimer -= dt;
    if (agent.dodgeSideTimer <= 0) {
        agent.dodgeSide      = Math.random() > 0.5 ? 1 : -1;
        agent.dodgeSideTimer = 1 + Math.random(); // 1–2 Sekunden
    }

    const nearBullet = bullets
        .filter(b => b.ownerId === 'player' && vec.distance(b.position, agent.position) < 180)
        .sort((a, b) => vec.distance(a.position, agent.position) - vec.distance(b.position, agent.position))[0];

    const dodgeForce = nearBullet
        ? vec.scale(
            vec.scale(vec.perpendicular(vec.normalize(nearBullet.velocity)), agent.dodgeSide),
            dna[DNA_INDEX.DODGE_WEIGHT]
        )
        : vec.zero();

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
        const scatter = (Math.random() - 0.5) * (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 1.2;
        const bulletVel = vec.scale(
            vec.fromAngle(agent.rotation + scatter),
            GAME_CONFIG.BULLET_SPEED
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