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
import { computeShotPlan } from '../../mods/modTypes';
import { steerHomingBullet, type QueuedShot } from '../../mods/shotEngine';

let bulletIdCounter     = 0;
let playerShootCooldown = 0;
let agentShootCooldown  = 0;
let ghostFrameSkip      = 0;
const dodgedBulletIdSet = new Set<string>();

// Schüsse aus Verhaltens-Mods (z.B. Burst Shot), die zeitversetzt nach dem
// eigentlichen Trigger-Pull abgefeuert werden. Meist leer → kein GC-Druck.
const queuedPlayerShots: QueuedShot[] = [];

// Homing-Rounds-Mod: max. Drehrate in rad/s, mit der eine Kugel Richtung Agent einlenkt
const HOMING_TURN_RATE = 2;

// Scratch-Vektoren für updateAgent – einmal allokiert, jeden Frame wiederverwendet (kein GC)
const _agToP   = { x: 0, y: 0 };  // Agent → Spieler, normalisiert
const _agChase = { x: 0, y: 0 };
const _agDodge = { x: 0, y: 0 };
const _agRange = { x: 0, y: 0 };
const _agMove  = { x: 0, y: 0 };  // Kombinierte + normalisierte Bewegungskraft

export function resetGameLoop() {
    playerShootCooldown = 0;
    agentShootCooldown  = 0;
    ghostFrameSkip      = 0;
    dodgedBulletIdSet.clear();
    queuedPlayerShots.length = 0;
}

function spawnPlayerBullet(
    bullets:     Bullet[],
    player:      PlayerState,
    playerStats: PlayerStats,
    angleOffset: number,
    speedMult:   number,
    homing:      boolean,
) {
    const angle = player.rotation + angleOffset;
    const speed = playerStats.bulletSpeed * speedMult;
    bullets.push({
        id:       `p_${bulletIdCounter++}`,
        position: { ...player.position },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        ownerId:  'player',
        lifetime: GAME_CONFIG.BULLET_LIFETIME,
        radius:   GAME_CONFIG.BULLET_RADIUS,
        homing,
    });
}

// Update-Funktion – kriegt alten State, gibt neuen zurück
export function update(
    state:        GameState,
    dt:           number,
    input:        InputState,
    playerStats:  PlayerStats,
    activeModIds: string[] = [],
): GameState {
    if (state.phase !== 'playing') return state;

    let player  = { ...state.player,  position: { ...state.player.position },  velocity: { ...state.player.velocity }  };
    let agent   = { ...state.agent,   position: { ...state.agent.position },   velocity: { ...state.agent.velocity }   };
    // Shallow copy des Arrays – die Bullet-Objekte werden unten in-place mutiert (kein Spread nötig)
    const bullets = [...state.bullets];

    // ---- Timer ----
    const roundTimer = state.roundTimer - dt;
    if (roundTimer <= 0) {
        return { ...state, phase: 'roundEnd', roundTimer: 0 };
    }

    // ---- Spieler bewegen (inline, keine temp-Objekte) ----
    playerShootCooldown = Math.max(0, playerShootCooldown - dt);

    let mvx = 0, mvy = 0;
    if (input.up)    mvy -= 1;
    if (input.down)  mvy += 1;
    if (input.left)  mvx -= 1;
    if (input.right) mvx += 1;
    const mvLen = Math.sqrt(mvx * mvx + mvy * mvy);
    if (mvLen > 0) {
        player.velocity.x = (mvx / mvLen) * playerStats.moveSpeed;
        player.velocity.y = (mvy / mvLen) * playerStats.moveSpeed;
    } else {
        player.velocity.x = 0;
        player.velocity.y = 0;
    }

    player.rotation = Math.atan2(input.mouseY - player.position.y, input.mouseX - player.position.x);

    const pr = GAME_CONFIG.PLAYER_RADIUS;
    player.position.x = Math.max(pr, Math.min(ARENA.WIDTH  - pr, player.position.x + player.velocity.x * dt));
    player.position.y = Math.max(pr, Math.min(ARENA.HEIGHT - pr, player.position.y + player.velocity.y * dt));

    // ---- Spieler schießt ----
    const playerShotThisFrame = input.shoot && playerShootCooldown === 0;
    if (playerShotThisFrame) {
        playerShootCooldown = playerStats.shootCooldown;
        // Schuss-Mods (Triple Shot, Burst Shot, ...) nur beim tatsächlichen
        // Trigger-Pull berechnen, nicht jeden Frame – vernachlässigbare Kosten.
        for (const shot of computeShotPlan(activeModIds)) {
            if (shot.delay <= 0) {
                spawnPlayerBullet(bullets, player, playerStats, shot.angleOffset, shot.speedMult, shot.homing ?? false);
            } else {
                queuedPlayerShots.push({ timer: shot.delay, angleOffset: shot.angleOffset, speedMult: shot.speedMult, homing: shot.homing ?? false });
            }
        }
    }

    // ---- Verzögerte Mod-Schüsse abfeuern (z.B. Burst Shot) – meist leer ----
    if (queuedPlayerShots.length > 0) {
        for (let i = queuedPlayerShots.length - 1; i >= 0; i--) {
            const q = queuedPlayerShots[i];
            q.timer -= dt;
            if (q.timer <= 0) {
                spawnPlayerBullet(bullets, player, playerStats, q.angleOffset, q.speedMult, q.homing);
                queuedPlayerShots.splice(i, 1);
            }
        }
    }

    // ---- Agent bewegen (KI) ----
    agentShootCooldown = Math.max(0, agentShootCooldown - dt);
    const [updatedAgent, agentBullet] = updateAgent(agent, player, bullets, dt);
    agent = updatedAgent;
    if (agentBullet) bullets.push(agentBullet);

    // ---- Stats in-place mutieren (kein Spread pro Frame) ----
    const stats = agent.stats;
    stats.timeAlive += dt;
    const _pdx = player.position.x - agent.position.x;
    const _pdy = player.position.y - agent.position.y;
    stats.distanceSum     = (stats.distanceSum     ?? 0) + Math.sqrt(_pdx * _pdx + _pdy * _pdy);
    stats.distanceSamples = (stats.distanceSamples ?? 0) + 1;

    // ---- Bullets bewegen + filtern + Kollision: alles in einem Pass ----
    const newBullets: Bullet[] = [];
    for (const b of bullets) {
        // Homing Rounds: Geschwindigkeitsvektor pro Frame Richtung Agent eindrehen
        if (b.homing && b.ownerId === 'player') {
            steerHomingBullet(b.position, b.velocity, agent.position, HOMING_TURN_RATE, dt);
        }

        // In-place bewegen (kein Spread → kein GC-Druck)
        b.position.x += b.velocity.x * dt;
        b.position.y += b.velocity.y * dt;
        b.lifetime   -= dt;

        // Out-of-bounds oder abgelaufen → verwerfen
        if (b.lifetime <= 0 ||
            b.position.x <= 0 || b.position.x >= ARENA.WIDTH ||
            b.position.y <= 0 || b.position.y >= ARENA.HEIGHT) continue;

        // Kollision: inline squared-distance → kein temp-Objekt, kein sqrt
        if (b.ownerId === 'agent') {
            const dx = b.position.x - player.position.x;
            const dy = b.position.y - player.position.y;
            const r  = GAME_CONFIG.PLAYER_RADIUS + b.radius;
            if (dx * dx + dy * dy < r * r) { stats.hitsLanded++; continue; }
        } else {
            const dx = b.position.x - agent.position.x;
            const dy = b.position.y - agent.position.y;
            const d2 = dx * dx + dy * dy;
            const hr = GAME_CONFIG.AGENT_RADIUS + b.radius;
            if (d2 < hr * hr) { stats.hitsReceived++; continue; }
            const nr = GAME_CONFIG.NEAR_MISS_RADIUS;
            if (!dodgedBulletIdSet.has(b.id) && d2 < nr * nr) {
                stats.dodgedBullets++;
                dodgedBulletIdSet.add(b.id);
            }
        }
        newBullets.push(b);
    }

    // ---- Ghost Frames – jeden 2. Frame aufzeichnen (~30fps): feiner fürs
    // Trainings-Replay, und die Presim-Kosten (50% mehr Sim-Schritte im
    // Worker) sind unkritisch ----
    ghostFrameSkip = (ghostFrameSkip + 1) % 2;
    const lastPlayerFrame: PlayerGhostFrame | null = ghostFrameSkip === 0 ? {
        position: { ...player.position },
        velocity: { ...player.velocity },
        rotation: player.rotation,
        shot:     playerShotThisFrame,
        time:     state.roundTimer,
    } : null;

    const lastAgentFrame: AgentGhostFrame | null = ghostFrameSkip === 0 ? {
        position: { ...agent.position },
        rotation: agent.rotation,
        shot:     agentBullet !== null,
    } : null;

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

// ---- Agent KI (alle vec-Operationen inline, Scratch-Vektoren statt temp-Objekte) ----
function updateAgent(
    agent:   AgentState,
    player:  PlayerState,
    bullets: Bullet[],
    dt:      number,
): [AgentState, Bullet | null] {
    const dna = agent.dna;

    // 1. Richtungsvektor Agent → Spieler (normalisiert), direkt in _agToP schreiben
    {
        const dx  = player.position.x - agent.position.x;
        const dy  = player.position.y - agent.position.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0) { _agToP.x = dx / len; _agToP.y = dy / len; }
        else          { _agToP.x = 0;        _agToP.y = 0;        }
    }
    _agChase.x = _agToP.x * dna[DNA_INDEX.AGGRESSION];
    _agChase.y = _agToP.y * dna[DNA_INDEX.AGGRESSION];

    // 2. Nächste eingehende Bullet finden (squared-distance, kein sqrt)
    let nearBullet: Bullet | undefined;
    let nearDistSq = 120 * 120;
    for (const b of bullets) {
        if (b.ownerId !== 'player') continue;
        const bdx = b.position.x - agent.position.x;
        const bdy = b.position.y - agent.position.y;
        const d2  = bdx * bdx + bdy * bdy;
        if (d2 < nearDistSq) { nearBullet = b; nearDistSq = d2; }
    }

    // Dodge-Kraft direkt in _agDodge (kein IIFE, kein temp-Objekt)
    _agDodge.x = 0; _agDodge.y = 0;
    if (nearBullet && Math.random() <= dna[DNA_INDEX.DODGE_WEIGHT]) {
        // perp(normalize(bulletVel)): normalisieren dann 90° drehen (-y, x)
        const bvLen = Math.sqrt(nearBullet.velocity.x * nearBullet.velocity.x + nearBullet.velocity.y * nearBullet.velocity.y);
        const nvx   = bvLen > 0 ? nearBullet.velocity.x / bvLen : 0;
        const nvy   = bvLen > 0 ? nearBullet.velocity.y / bvLen : 0;
        const px = -nvy, py = nvx;
        // Seite: dot(perp, agent - bullet)
        const tax = agent.position.x - nearBullet.position.x;
        const tay = agent.position.y - nearBullet.position.y;
        let side = (px * tax + py * tay) >= 0 ? 1 : -1;
        // Wand-Kollision vermeiden
        const wm  = GAME_CONFIG.AGENT_RADIUS + 40;
        const dpx = px * side, dpy = py * side;
        if ((dpx > 0 && agent.position.x > ARENA.WIDTH  - wm) ||
            (dpx < 0 && agent.position.x < wm)                 ||
            (dpy > 0 && agent.position.y > ARENA.HEIGHT - wm)  ||
            (dpy < 0 && agent.position.y < wm)) side = -side;
        const s    = side * dna[DNA_INDEX.MOVEMENT_SPEED];
        _agDodge.x = px * s;
        _agDodge.y = py * s;
    }

    // 3. Abstand + Range-Kraft
    const _rdx      = agent.position.x - player.position.x;
    const _rdy      = agent.position.y - player.position.y;
    const dist      = Math.sqrt(_rdx * _rdx + _rdy * _rdy);
    const preferredDist = dna[DNA_INDEX.PREFERRED_RANGE] * 300 + 100;
    const rangeFactor   = (dist - preferredDist) / (preferredDist + 1);
    _agRange.x = _agToP.x * rangeFactor * 0.5;
    _agRange.y = _agToP.y * rangeFactor * 0.5;

    // 4. Kräfte kombinieren → normalisieren → auf Geschwindigkeit skalieren
    if (preferredDist > dist) { _agChase.x = 0; _agChase.y = 0; }
    _agMove.x = _agChase.x + _agDodge.x + _agRange.x;
    _agMove.y = _agChase.y + _agDodge.y + _agRange.y;
    const combLen = Math.sqrt(_agMove.x * _agMove.x + _agMove.y * _agMove.y);
    const speed   = GAME_CONFIG.AGENT_SPEED_BASE + dna[DNA_INDEX.MOVEMENT_SPEED] * GAME_CONFIG.AGENT_SPEED_BONUS;
    if (combLen > 0) { _agMove.x = (_agMove.x / combLen) * speed; _agMove.y = (_agMove.y / combLen) * speed; }
    else              { _agMove.x = 0;                              _agMove.y = 0;                              }

    // Velocity dämpfen (in-place, kein temp-Objekt)
    agent.velocity.x = (agent.velocity.x + _agMove.x) * 0.82;
    agent.velocity.y = (agent.velocity.y + _agMove.y) * 0.82;

    // Position clampen (in-place)
    const ar = GAME_CONFIG.AGENT_RADIUS;
    agent.position.x = Math.max(ar, Math.min(ARENA.WIDTH  - ar, agent.position.x + agent.velocity.x * dt));
    agent.position.y = Math.max(ar, Math.min(ARENA.HEIGHT - ar, agent.position.y + agent.velocity.y * dt));

    // 5. Zielen mit Predict-Lead (kein temp-Objekt)
    const la    = dna[DNA_INDEX.PREDICT_LEAD];
    const predX = player.position.x + player.velocity.x * la * 0.4;
    const predY = player.position.y + player.velocity.y * la * 0.4;
    agent.rotation = Math.atan2(predY - agent.position.y, predX - agent.position.x);

    // 6. Schießen
    let newBullet: Bullet | null = null;
    if (agentShootCooldown <= 0) {
        const scatter          = (Math.random() - 0.5) * (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 1.2;
        const agentBulletSpeed = GAME_CONFIG.BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN);
        const ang              = agent.rotation + scatter;
        newBullet = {
            id:       `a_${bulletIdCounter++}`,
            position: { ...agent.position },
            velocity: { x: Math.cos(ang) * agentBulletSpeed, y: Math.sin(ang) * agentBulletSpeed },
            ownerId:  'agent',
            lifetime: GAME_CONFIG.BULLET_LIFETIME,
            radius:   GAME_CONFIG.BULLET_RADIUS,
        };
        agent.stats.bulletsFired++;
        agentShootCooldown = GAME_CONFIG.SHOOT_COOLDOWN_MIN +
            (1 - dna[DNA_INDEX.FIRE_RATE]) * GAME_CONFIG.SHOOT_COOLDOWN_MAX;
    }

    return [agent, newBullet];
}
