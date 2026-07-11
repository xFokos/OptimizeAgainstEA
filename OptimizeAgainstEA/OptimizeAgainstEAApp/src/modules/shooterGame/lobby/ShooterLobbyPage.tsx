import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { GameModeSelectorLayout } from '../../../components/layout/GameModeSelectorLayout';
import { HintsProvider, HintToggle, HintLayer, useHints, HINTS, TourSpotlight } from '../../../components/hints';
import type { HintId } from '../../../components/hints';
import { HelpButton } from '../../../components/help';
import { CompiTooltip } from '../../../components/ui/CompiTooltip';
import { ShooterPlayerSection, ShooterRoundSection, ShooterDnaSection, HordeWaveSection, type DnaGeneDescriptor } from '../settings/ShooterSettings';
import { useSettings, resetShooterSettings, defaultShooterSettings } from '../../../context/SettingsContext';
import { EASettingsPanel, HordeEASettingsPanel } from '../../../components/settings/EASettings';
import { makeInitialGameState } from '../game/makeGameState';
import { vec } from '../game/core/vec';
import { ARENA, DNA_INDEX, DNA_NAMES, DNA_GENE_INFO, GAME_CONFIG } from '../shooter.types';
import { gameStore } from '../game/gameStore';
import { initPopulation } from '../game/ga/population';
import { analyticsStore } from '../game/analyticsStore';
import { hordeRunStore } from '../horde/hordeRunStore';
import { hordeGameStore } from '../horde/hordeGameStore';
import { runModsStore } from '../mods/runModsStore';
import { MOD_POOL } from '../mods/modTypes';
import { HORDE_MAPS, CUSTOM_MAP_ID, resolveHordeMap } from '../horde/hordeMaps';
import { LOOP_STEPS, LOOP_STEP_DURATION, LOOP_GENE_START, SIZE_GENE_INDEX, OPACITY_GENE_INDEX, loopOffsetRad } from '../horde/hordeDna';
import type { HordeMap } from '../horde/hordeTypes';
import { getRaidbossStatus, claimRaidbossSlot } from '../game/raidbossStore';
import type { RaidbossDoc } from '../game/raidbossStore';

// ---- Mobile-Breakpoint Hook ----

function useMobile(bp = 768) {
    const [mob, setMob] = useState(() => window.innerWidth < bp);
    useEffect(() => {
        const h = () => setMob(window.innerWidth < bp);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, [bp]);
    return mob;
}

// ---- Viewport-height zoom: shrinks the lobby on small screens ----

function useZoom(referenceH = 900, minZoom = 0.72) {
    const [h, setH] = useState(() => window.innerHeight);
    useEffect(() => {
        const update = () => setH(window.innerHeight);
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);
    return Math.min(1, Math.max(minZoom, h / referenceH));
}

// ---- Mini Preview Canvas ----

const PREVIEW_W = 400;
const PREVIEW_H = 400;

interface PreviewAgent {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    rot:      number;
    color:    string;
    glowColor: string;
}

interface PreviewBullet {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    color:    string;
    lifetime: number;
    owner:    'a' | 'b';
}

function ShooterPreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { shooterSettings } = useSettings();

    const dnaRef = useRef(shooterSettings.starterDna);
    useEffect(() => { dnaRef.current = shooterSettings.starterDna; }, [shooterSettings.starterDna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let agentA: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.25, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: 0,
            color:     '#4fc3f7',
            glowColor: 'rgba(79, 195, 247, 0.3)',
        };
        let agentB: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.75, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: Math.PI,
            color:     '#ef5350',
            glowColor: 'rgba(239, 83, 80, 0.3)',
        };

        let bullets: PreviewBullet[] = [];
        let bulletTimer   = 0;
        let lastTimestamp = 0;

        // Statischer Hintergrund gecacht – einmal zeichnen, dann per drawImage kopieren
        const bgCache = document.createElement('canvas');
        bgCache.width  = PREVIEW_W;
        bgCache.height = PREVIEW_H;
        const bgCtx = bgCache.getContext('2d')!;
        bgCtx.fillStyle = '#0f0f1a';
        bgCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        bgCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        bgCtx.lineWidth   = 1;
        bgCtx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { bgCtx.moveTo(0, y); bgCtx.lineTo(PREVIEW_W, y); }
        bgCtx.stroke();
        bgCtx.strokeStyle = 'rgba(255,255,255,0.12)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

        const drawAgent = (agent: PreviewAgent) => {
            ctx.save();
            ctx.translate(agent.pos.x, agent.pos.y);
            ctx.rotate(agent.rot);
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = agent.color;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(26, 0);
            ctx.strokeStyle = agent.color;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.strokeStyle = agent.glowColor;
            ctx.lineWidth   = 3;
            ctx.stroke();
            ctx.restore();
        };

        // Bullets gebündelt nach Farbe, kein shadowBlur
        const drawBullets = () => {
            const groups: Record<string, PreviewBullet[]> = {};
            for (const b of bullets) {
                (groups[b.color] ??= []).push(b);
            }
            for (const [color, group] of Object.entries(groups)) {
                ctx.fillStyle = color;
                ctx.beginPath();
                for (const b of group) {
                    ctx.moveTo(b.pos.x + 4, b.pos.y);
                    ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
            }
        };

        const updateAgent = (agent: PreviewAgent, target: PreviewAgent, dt: number): PreviewAgent => {
            const dna        = dnaRef.current;
            const speed      = 30 + dna[DNA_INDEX.MOVEMENT_SPEED] * 70;
            const aggression = 0.3 + dna[DNA_INDEX.AGGRESSION] * 0.7;
            const prefRange  = 60 + dna[DNA_INDEX.PREFERRED_RANGE] * 150;

            const diff     = vec.sub(target.pos, agent.pos);
            const dist     = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
            const toTarget = dist > 1 ? vec.scale(diff, 1 / dist) : { x: 1, y: 0 };

            const orbitAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const orbitVel   = { x: Math.cos(orbitAngle) * speed, y: Math.sin(orbitAngle) * speed };

            const rangeError = dist - prefRange;
            const rangeVel   = vec.scale(toTarget, rangeError * aggression * 1.5);

            const combined = vec.add(orbitVel, rangeVel);
            agent.vel = vec.scale(vec.add(agent.vel, vec.scale(combined, dt)), 0.88);
            agent.pos = {
                x: Math.max(20, Math.min(PREVIEW_W - 20, agent.pos.x + agent.vel.x * dt)),
                y: Math.max(20, Math.min(PREVIEW_H - 20, agent.pos.y + agent.vel.y * dt)),
            };
            agent.rot = Math.atan2(toTarget.y, toTarget.x);
            return agent;
        };

        const spawnBullets = (a: PreviewAgent, b: PreviewAgent) => {
            const dna         = dnaRef.current;
            const spread      = (1 - dna[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
            const bulletSpeed = (GAME_CONFIG.BULLET_SPEED_MIN + dna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);

            const shoot = (from: PreviewAgent, to: PreviewAgent, color: string, owner: 'a' | 'b') => {
                const base  = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({
                    pos:      { ...from.pos },
                    vel:      { x: Math.cos(angle) * bulletSpeed, y: Math.sin(angle) * bulletSpeed },
                    color,
                    lifetime: 1.5,
                    owner,
                });
            };

            shoot(a, b, '#80d8ff', 'a');
            shoot(b, a, '#ff8a80', 'b');
        };

        const loop = (timestamp: number) => {
            // Preview braucht nur 30fps (rein dekorativ).
            // Threshold 31ms statt 33.33ms damit auf 60Hz-Displays (16.67ms/Frame) nie ein Frame
            // knapp unter dem Threshold liegt und das Preview unregelmäßig läuft.
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;

            agentA = updateAgent(agentA, agentB, dt);
            agentB = updateAgent(agentB, agentA, dt);

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                const fireRate  = dnaRef.current[DNA_INDEX.FIRE_RATE];
                bulletTimer = 1.4 - fireRate * 1.1 + Math.random() * 0.2;
                spawnBullets(agentA, agentB);
            }

            const AGENT_RADIUS  = 14;
            const BULLET_RADIUS = 4;
            const HIT_DIST      = AGENT_RADIUS + BULLET_RADIUS;

            bullets = bullets
                .map(b => ({
                    ...b,
                    pos:      { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt },
                    lifetime: b.lifetime - dt,
                }))
                .filter(b => {
                    if (b.lifetime <= 0 || !Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.y) || b.pos.x <= 0 || b.pos.x >= PREVIEW_W || b.pos.y <= 0 || b.pos.y >= PREVIEW_H)
                        return false;
                    const target = b.owner === 'a' ? agentB : agentA;
                    const dx = b.pos.x - target.pos.x;
                    const dy = b.pos.y - target.pos.y;
                    return dx * dx + dy * dy >= HIT_DIST * HIT_DIST;
                });

            drawArena();
            drawBullets();
            drawAgent(agentA);
            drawAgent(agentB);

            animRef = requestAnimationFrame(loop);
        };

        let animRef = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
                borderRadius: '8px',
                border:       '1px solid rgba(255,255,255,0.08)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}

// ---- Raidboss Preview Canvas ----

const BOSS_DNA = [0.85, 0.7, 0.9, 0.5, 0.8, 0.8, 0.9, 0.8];
const PLAYER_R = 14;
const BOSS_R   = 22;

function RaidbossPreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { shooterSettings } = useSettings();
    const dnaRef = useRef(shooterSettings.starterDna);
    useEffect(() => { dnaRef.current = shooterSettings.starterDna; }, [shooterSettings.starterDna]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        let agentA: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.25, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: 0,
            color:     '#4fc3f7',
            glowColor: 'rgba(79, 195, 247, 0.3)',
        };
        let agentB: PreviewAgent = {
            pos: { x: PREVIEW_W * 0.75, y: PREVIEW_H * 0.5 },
            vel: { x: 0, y: 0 },
            rot: Math.PI,
            color:     '#a855f7',
            glowColor: 'rgba(168, 85, 247, 0.55)',
        };

        let bullets: PreviewBullet[] = [];
        let bulletTimer   = 0;
        let lastTimestamp = 0;

        const bgCache = document.createElement('canvas');
        bgCache.width  = PREVIEW_W;
        bgCache.height = PREVIEW_H;
        const bgCtx = bgCache.getContext('2d')!;
        bgCtx.fillStyle = '#0f0f1a';
        bgCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        bgCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        bgCtx.lineWidth   = 1;
        bgCtx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { bgCtx.moveTo(0, y); bgCtx.lineTo(PREVIEW_W, y); }
        bgCtx.stroke();
        bgCtx.strokeStyle = 'rgba(168,85,247,0.18)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

        const drawAgent = (agent: PreviewAgent, radius: number) => {
            ctx.save();
            ctx.translate(agent.pos.x, agent.pos.y);
            ctx.rotate(agent.rot);
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = agent.color;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(radius + 12, 0);
            ctx.strokeStyle = agent.color;
            ctx.lineWidth   = radius === BOSS_R ? 4 : 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, radius + 5, 0, Math.PI * 2);
            ctx.strokeStyle = agent.glowColor;
            ctx.lineWidth   = radius === BOSS_R ? 5 : 3;
            ctx.stroke();
            ctx.restore();
        };

        const drawBullets = () => {
            const groups: Record<string, PreviewBullet[]> = {};
            for (const b of bullets) { (groups[b.color] ??= []).push(b); }
            for (const [color, group] of Object.entries(groups)) {
                ctx.fillStyle = color;
                ctx.beginPath();
                for (const b of group) {
                    ctx.moveTo(b.pos.x + 4, b.pos.y);
                    ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
                }
                ctx.fill();
            }
        };

        const updateAgent = (agent: PreviewAgent, target: PreviewAgent, dna: readonly number[], dt: number): PreviewAgent => {
            const speed      = 30 + dna[DNA_INDEX.MOVEMENT_SPEED] * 70;
            const aggression = 0.3 + dna[DNA_INDEX.AGGRESSION] * 0.7;
            const prefRange  = 60 + dna[DNA_INDEX.PREFERRED_RANGE] * 150;
            const diff       = vec.sub(target.pos, agent.pos);
            const dist       = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
            const toTarget   = dist > 1 ? vec.scale(diff, 1 / dist) : { x: 1, y: 0 };
            const orbitAngle = Math.atan2(toTarget.y, toTarget.x) + Math.PI / 2;
            const orbitVel   = { x: Math.cos(orbitAngle) * speed, y: Math.sin(orbitAngle) * speed };
            const rangeError = dist - prefRange;
            const rangeVel   = vec.scale(toTarget, rangeError * aggression * 1.5);
            const combined   = vec.add(orbitVel, rangeVel);
            agent.vel = vec.scale(vec.add(agent.vel, vec.scale(combined, dt)), 0.88);
            agent.pos = {
                x: Math.max(20, Math.min(PREVIEW_W - 20, agent.pos.x + agent.vel.x * dt)),
                y: Math.max(20, Math.min(PREVIEW_H - 20, agent.pos.y + agent.vel.y * dt)),
            };
            agent.rot = Math.atan2(toTarget.y, toTarget.x);
            return agent;
        };

        const spawnBullets = (a: PreviewAgent, b: PreviewAgent) => {
            const playerDna = dnaRef.current;
            const shootA = (from: PreviewAgent, to: PreviewAgent) => {
                const spread = (1 - playerDna[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
                const speed  = (GAME_CONFIG.BULLET_SPEED_MIN + playerDna[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);
                const base   = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle  = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({ pos: { ...from.pos }, vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, color: '#80d8ff', lifetime: 1.5, owner: 'a' });
            };
            const shootB = (from: PreviewAgent, to: PreviewAgent) => {
                const spread = (1 - BOSS_DNA[DNA_INDEX.SHOOT_ACCURACY]) * 0.6;
                const speed  = (GAME_CONFIG.BULLET_SPEED_MIN + BOSS_DNA[DNA_INDEX.BULLET_SPEED] * (GAME_CONFIG.BULLET_SPEED_MAX - GAME_CONFIG.BULLET_SPEED_MIN)) * (PREVIEW_W / 800);
                const base   = Math.atan2(to.pos.y - from.pos.y, to.pos.x - from.pos.x);
                const angle  = base + (Math.random() - 0.5) * spread * 2;
                bullets.push({ pos: { ...from.pos }, vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }, color: '#cc88ff', lifetime: 1.5, owner: 'b' });
            };
            shootA(a, b);
            shootB(b, a);
        };

        const loop = (timestamp: number) => {
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;

            agentA = updateAgent(agentA, agentB, dnaRef.current, dt);
            agentB = updateAgent(agentB, agentA, BOSS_DNA, dt);

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                const fireRate  = BOSS_DNA[DNA_INDEX.FIRE_RATE];
                bulletTimer = 1.4 - fireRate * 1.1 + Math.random() * 0.2;
                spawnBullets(agentA, agentB);
            }

            bullets = bullets
                .map(b => ({ ...b, pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt }, lifetime: b.lifetime - dt }))
                .filter(b => {
                    if (b.lifetime <= 0 || !Number.isFinite(b.pos.x) || !Number.isFinite(b.pos.y) || b.pos.x <= 0 || b.pos.x >= PREVIEW_W || b.pos.y <= 0 || b.pos.y >= PREVIEW_H) return false;
                    const target = b.owner === 'a' ? agentB : agentA;
                    const hitR   = b.owner === 'a' ? BOSS_R : PLAYER_R;
                    const dx = b.pos.x - target.pos.x;
                    const dy = b.pos.y - target.pos.y;
                    return dx * dx + dy * dy >= (hitR + 4) * (hitR + 4);
                });

            drawArena();
            drawBullets();
            drawAgent(agentA, PLAYER_R);
            drawAgent(agentB, BOSS_R);

            animRef = requestAnimationFrame(loop);
        };

        let animRef = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
                borderRadius: '8px',
                border:       '1px solid rgba(168,85,247,0.2)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}

// ---- Horde Preview Canvas ----

const HORDE_PREVIEW_HC          = '#fb923c';
const HORDE_PREVIEW_AGENT_COUNT = 7;
const HORDE_PREVIEW_AGENT_R     = 12;

interface HordePreviewAgent {
    baseAngle:    number;
    radiusJitter: number;
    wobblePhase:  number;
}

interface HordePreviewBullet {
    pos:      { x: number; y: number };
    vel:      { x: number; y: number };
    lifetime: number;
}

function HordePreview() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;

        const bgCache = document.createElement('canvas');
        bgCache.width  = PREVIEW_W;
        bgCache.height = PREVIEW_H;
        const bgCtx = bgCache.getContext('2d')!;
        bgCtx.fillStyle = '#0f0f1a';
        bgCtx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        bgCtx.strokeStyle = 'rgba(255,255,255,0.04)';
        bgCtx.lineWidth   = 1;
        bgCtx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { bgCtx.moveTo(x, 0); bgCtx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { bgCtx.moveTo(0, y); bgCtx.lineTo(PREVIEW_W, y); }
        bgCtx.stroke();
        bgCtx.strokeStyle = 'rgba(251,146,60,0.18)';
        bgCtx.lineWidth   = 2;
        bgCtx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        const drawArena = () => ctx.drawImage(bgCache, 0, 0);

        const center      = { x: PREVIEW_W / 2, y: PREVIEW_H / 2 };
        const ringRadius  = PREVIEW_W * 0.4;

        const agents: HordePreviewAgent[] = Array.from({ length: HORDE_PREVIEW_AGENT_COUNT }, (_, i) => ({
            baseAngle:    (i / HORDE_PREVIEW_AGENT_COUNT) * Math.PI * 2,
            radiusJitter: (Math.random() - 0.5) * 20,
            wobblePhase:  Math.random() * Math.PI * 2,
        }));

        let bullets: HordePreviewBullet[] = [];
        let bulletTimer   = 0;
        let playerRot     = 0;
        let t             = 0;
        let lastTimestamp = 0;

        const drawPlayer = () => {
            ctx.save();
            ctx.translate(center.x, center.y);
            ctx.rotate(playerRot);
            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#4fc3f7';
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(14, 0);
            ctx.lineTo(26, 0);
            ctx.strokeStyle = '#4fc3f7';
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(79, 195, 247, 0.3)';
            ctx.lineWidth   = 3;
            ctx.stroke();
            ctx.restore();
        };

        const drawAgents = () => {
            for (const a of agents) {
                const angle  = a.baseAngle + t * 0.08;
                const radius = ringRadius + a.radiusJitter + Math.sin(t * 1.4 + a.wobblePhase) * 6;
                const x = center.x + Math.cos(angle) * radius;
                const y = center.y + Math.sin(angle) * radius;
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle + Math.PI);
                ctx.beginPath(); ctx.arc(0, 0, HORDE_PREVIEW_AGENT_R + 4, 0, Math.PI * 2);
                ctx.strokeStyle = HORDE_PREVIEW_HC; ctx.lineWidth = 2; ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, HORDE_PREVIEW_AGENT_R, 0, Math.PI * 2);
                ctx.fillStyle = HORDE_PREVIEW_HC; ctx.fill();
                ctx.restore();
            }
        };

        const drawBullets = () => {
            ctx.fillStyle = '#80d8ff';
            ctx.beginPath();
            for (const b of bullets) {
                ctx.moveTo(b.pos.x + 4, b.pos.y);
                ctx.arc(b.pos.x, b.pos.y, 4, 0, Math.PI * 2);
            }
            ctx.fill();
        };

        const loop = (timestamp: number) => {
            if (timestamp - lastTimestamp < 31) {
                animRef = requestAnimationFrame(loop);
                return;
            }
            const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
            lastTimestamp = timestamp;
            t += dt;

            playerRot += dt * 1.1;

            bulletTimer -= dt;
            if (bulletTimer <= 0) {
                bulletTimer = 0.3;
                bullets.push({
                    pos:      { ...center },
                    vel:      { x: Math.cos(playerRot) * 260, y: Math.sin(playerRot) * 260 },
                    lifetime: 1,
                });
            }

            bullets = bullets
                .map(b => ({ ...b, pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt }, lifetime: b.lifetime - dt }))
                .filter(b => b.lifetime > 0 && b.pos.x >= 0 && b.pos.x <= PREVIEW_W && b.pos.y >= 0 && b.pos.y <= PREVIEW_H);

            drawArena();
            drawAgents();
            drawBullets();
            drawPlayer();

            animRef = requestAnimationFrame(loop);
        };

        let animRef = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animRef);
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
                borderRadius: '8px',
                border:       '1px solid rgba(251,146,60,0.2)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}

// ---- Horde Map Preview (static — swaps in for HordePreview while the Map tab is open) ----

function HordeMapPreview({ map }: { map: HordeMap }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = PREVIEW_W / ARENA.WIDTH; // ARENA is square, same factor on both axes

        ctx.fillStyle = '#0f0f1a';
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        for (let x = 0; x <= PREVIEW_W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, PREVIEW_H); }
        for (let y = 0; y <= PREVIEW_H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(PREVIEW_W, y); }
        ctx.stroke();

        // Orange glow along whichever edges agents can spawn from on this map
        const GLOW = 60;
        for (const side of map.spawnSides) {
            let grad: CanvasGradient;
            let gx = 0, gy = 0, gw = PREVIEW_W, gh = PREVIEW_H;
            if (side === 'top')    { grad = ctx.createLinearGradient(0, 0, 0, GLOW); gh = GLOW; }
            else if (side === 'bottom') { grad = ctx.createLinearGradient(0, PREVIEW_H, 0, PREVIEW_H - GLOW); gy = PREVIEW_H - GLOW; gh = GLOW; }
            else if (side === 'left')   { grad = ctx.createLinearGradient(0, 0, GLOW, 0); gw = GLOW; }
            else                        { grad = ctx.createLinearGradient(PREVIEW_W, 0, PREVIEW_W - GLOW, 0); gx = PREVIEW_W - GLOW; gw = GLOW; }
            grad.addColorStop(0, 'rgba(251,146,60,0.5)');
            grad.addColorStop(1, 'rgba(251,146,60,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gx, gy, gw, gh);
        }

        ctx.strokeStyle = 'rgba(251,146,60,0.18)';
        ctx.lineWidth   = 2;
        ctx.strokeRect(1, 1, PREVIEW_W - 2, PREVIEW_H - 2);

        // Obstacles — solid border = blocks bullets, dashed = movement-only (mirrors in-game render)
        for (const o of map.obstacles) {
            const x = o.x * scale, y = o.y * scale, w = o.w * scale, h = o.h * scale;
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = o.blocksBullets ? 'rgba(251,146,60,0.6)' : 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 2;
            ctx.setLineDash(o.blocksBullets ? [] : [5, 3]);
            ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
            ctx.setLineDash([]);
        }

        // Player start marker
        const spawnX = map.playerSpawn.x * scale, spawnY = map.playerSpawn.y * scale;
        ctx.beginPath();
        ctx.arc(spawnX, spawnY, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#4fc3f7';
        ctx.fill();
        ctx.strokeStyle = 'rgba(79,195,247,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(spawnX, spawnY, 13, 0, Math.PI * 2);
        ctx.stroke();
    }, [map]);

    return (
        <canvas
            ref={canvasRef}
            width={PREVIEW_W}
            height={PREVIEW_H}
            style={{
                borderRadius: '8px',
                border:       '1px solid rgba(251,146,60,0.2)',
                display:      'block',
                width:        '100%',
                height:       'auto',
                maxWidth:     PREVIEW_W,
            }}
        />
    );
}

// ---- Fullscreen vor dem Navigieren zum Spiel anfordern ----
// Chrome on Android erlaubt orientation.lock nur in Fullscreen → innerhalb des User-Gesture-Kontexts aufrufen

async function enterGameFullscreen() {
    // pointer: coarse = Touch als primäres Eingabegerät (Phones, Tablets)
    // zuverlässiger als Screen-Größe, die bei großen Tablets versagt
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice) return;
    if (!document.fullscreenElement) {
        try { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch {}
    }
}

// ---- Mode type ----

type LobbyMode = 'normal' | 'raidboss' | 'horde';

const SHOOTER_MODES = [
    {
        id:    'raidboss',
        key:   'R',
        label: 'Community Raidboss',
        sub:   'Train the community population. Every battle improves the shared boss for all players.',
    },
    {
        id:    'normal',
        key:   'S',
        label: 'Solo Play',
        sub:   'Fight a genetic algorithm that adapts to your playstyle after every round.',
    },
    {
        id:    'horde',
        key:   'H',
        label: 'Horde Mode',
        sub:   'Survive endless waves of increasingly powerful agents. How long can you last?',
    },
];

// ---- Difficulty Presets ----

// DNA-Reihenfolge: AGGRESSION, DODGE, ACCURACY, RANGE, SPEED, LEAD, FIRE_RATE, BULLET_SPEED
const PRESETS = [
    {
        id:       'easy',
        label:    'Easy',
        color:    '#4ade80',
        desc:     'The EA learns slowly and without pre-simulation.',
        dna:      [0.2, 0.2, 0.2, 0.4, 0.2, 0.2, 0.2, 0.2],
        mutation: 0.05,
        strength: 0.1,
        presim:   0,
        modInterval: 4,
    },
    {
        id:       'medium',
        label:    'Medium',
        color:    '#facc15',
        desc:     'Balanced start with 1 pre-sim generation.',
        dna:      [0.2, 0.25, 0.25, 0.4, 0.25, 0.25, 0.25, 0.25],
        mutation: 0.15,
        strength: 0.2,
        presim:   1,
        modInterval: 5,
    },
    {
        id:       'hard',
        label:    'Hard',
        color:    '#f87171',
        desc:     'The EA simulates 3 generations against your playstyle.',
        dna:      [0.2, 0.3, 0.3, 0.4, 0.3, 0.3, 0.35, 0.3],
        mutation: 0.25,
        strength: 0.3,
        presim:   3,
        modInterval: 6,
    },
] as const;

type PresetId = typeof PRESETS[number]['id'] | 'custom';

// ---- DNA gene row — read-only stat bar with a delta badge on evolution.
// Editing starter DNA happens in the Algorithm tab (ShooterDnaSection); this
// is a "look, don't touch" view so the Overview stays glanceable. ----

function DnaDeltaBadge({ delta }: { delta: number }) {
    if (Math.abs(delta) < 0.005) return null;
    return (
        <span style={{ ...ovStyles.geneDelta, color: delta > 0 ? '#4ade80' : '#f87171' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
        </span>
    );
}

function DnaGeneRow({ label, tooltip, value, delta }: {
    label:   string;
    tooltip: string;
    value:   number;
    delta:   number;
}) {
    return (
        <div style={ovStyles.geneRow}>
            <div style={ovStyles.geneHeader}>
                <CompiTooltip text={tooltip}>
                    <span style={ovStyles.geneName}>{label}</span>
                </CompiTooltip>
                <span style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={ovStyles.geneValue}>{value.toFixed(2)}</span>
                    <DnaDeltaBadge delta={delta} />
                </span>
            </div>
            <div style={ovStyles.geneBarTrack}>
                <div style={{ ...ovStyles.geneBarFill, width: `${value * 100}%` }} />
            </div>
        </div>
    );
}

// ---- Solo Play Overview (tab 1) ----

interface SoloPlayOverviewProps {
    selectedPreset:    PresetId;
    setSelectedPreset: (p: PresetId) => void;
    onNavigateTab:     (tab: LobbyTab) => void;
    /** Anchors for the guided tour's spotlight (see NormalLobby's TOUR_STEPS). */
    presetsRef?:  RefObject<HTMLDivElement | null>;
    dnaPanelRef?: RefObject<HTMLDivElement | null>;
}

function SoloPlayOverview({ selectedPreset, setSelectedPreset, onNavigateTab, presetsRef, dnaPanelRef }: SoloPlayOverviewProps) {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const [round, setRound]     = useState(gameStore.state?.roundNumber ?? 0);
    const [hasGame, setHasGame] = useState(!!gameStore.state);
    const [lastRecord, setLastRecord] = useState(analyticsStore.rounds.at(-1) ?? null);
    const { shooterSettings, setShooterSettings, eaSettings, setEaSettings } = useSettings();

    useEffect(() => {
        const syncGame = () => {
            setHasGame(!!gameStore.state);
            setRound(gameStore.state?.roundNumber ?? 0);
        };
        const syncAnalytics = () => setLastRecord(analyticsStore.rounds.at(-1) ?? null);
        syncGame();
        syncAnalytics();
        const unsub1 = gameStore.subscribe(syncGame);
        const unsub2 = analyticsStore.subscribe(syncAnalytics);
        return () => { unsub1(); unsub2(); };
    }, []);

    const handlePrepare = () => {
        gameStore.state = makeInitialGameState(shooterSettings);
        gameStore.notify();
    };

    const handleReset = () => {
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        analyticsStore.clear();
    };

    const applyPreset = (p: typeof PRESETS[number]) => {
        setSelectedPreset(p.id);
        setShooterSettings({ ...defaultShooterSettings, starterDna: [...p.dna], modChoiceInterval: p.modInterval });
        setEaSettings({ ...eaSettings, mutationRate: p.mutation, mutationStrength: p.strength, presimGenerations: p.presim });
    };

    const activePreset = PRESETS.find(p => p.id === selectedPreset) ?? null;

    const showActiveDna = round > 0 && !!gameStore.state?.agent.dna;
    const displayDna    = showActiveDna ? gameStore.state.agent.dna : shooterSettings.starterDna;

    const [displayedDna, setDisplayedDna] = useState<number[]>([...displayDna]);
    const [prevDna, setPrevDna] = useState<number[]>([...displayDna]);
    const animTimers   = useRef<ReturnType<typeof setTimeout>[]>([]);
    const prevRoundRef = useRef(round);

    useEffect(() => {
        const roundIncreased = round > prevRoundRef.current;
        prevRoundRef.current = round;

        if (!roundIncreased || !showActiveDna) {
            setDisplayedDna([...displayDna]);
            setPrevDna([...displayDna]);
        } else {
            setPrevDna([...displayedDna]); // freeze the last-shown values as the delta baseline
            displayDna.forEach((target, i) => {
                const t = setTimeout(() => {
                    setDisplayedDna(prev => {
                        const next = [...prev];
                        next[i] = target;
                        return next;
                    });
                }, Math.floor(i / 2) * 200 + 80);
                animTimers.current.push(t);
            });
        }

        return () => {
            animTimers.current.forEach(clearTimeout);
            animTimers.current = [];
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [round, displayDna, showActiveDna]);

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
            <div style={ovStyles.slot}>
            {hasGame ? (
                    <div className="panel panel--md" style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Round</div>
                            <div style={ovStyles.roundValue}>{round}</div>
                        </div>

                        <div style={ovStyles.divider} />

                        {lastRecord ? (
                            <div style={ovStyles.statsCompact}>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>EA Accuracy</span>
                                    <span style={ovStyles.statsCompactValue}>{Math.round(lastRecord.accuracy * 100)}%</span>
                                </div>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>Score (EA : You)</span>
                                    <span style={ovStyles.statsCompactValue}>{lastRecord.hitsLanded} : {lastRecord.hitsReceived}</span>
                                </div>
                                <div style={ovStyles.statsCompactRow}>
                                    <span style={ovStyles.statsCompactLabel}>EA Fitness</span>
                                    <span style={ovStyles.statsCompactValue}>{lastRecord.fitness.toFixed(1)}</span>
                                </div>
                            </div>
                        ) : (
                            <div style={{ ...ovStyles.statsCompactLabel, flex: 1 }}>No round completed yet</div>
                        )}

                        <div style={ovStyles.divider} />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn--outline btn--c-danger btn--sm" onClick={handleReset}>
                                Reset
                            </button>
                            {round > 0 && (
                                <button className="btn btn--ghost btn--sm" onClick={() => navigate('/Analytics')}>
                                    Analytics →
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div style={ovStyles.emptySlot}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <span style={ovStyles.slotIcon}>🎮</span>
                            <span style={ovStyles.slotTitle}>No active game</span>
                            <span style={ovStyles.slotSub}>
                                Choose a difficulty<br />
                                and start your first round.
                            </span>
                        </div>
                        <button
                            className="btn btn--outline btn--sm"
                            style={{ width: '100%', marginTop: 16 }}
                            onClick={handlePrepare}
                        >
                            Set up round →
                        </button>
                    </div>
                )}
            </div>

            {/* Right column: Difficulty stacked above the (read-only) DNA display.
                Both stretch to the same width automatically; the Status box on the
                left stretches to match this column's combined height. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div ref={presetsRef} className="panel panel--md" style={{ ...ovStyles.placeholder, flex: 'none' }}>
                    <span style={ovStyles.placeholderHeading}>Game</span>
                    <div style={ovStyles.presetBtns}>
                        {PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p)}
                                disabled={round > 0}
                                style={{
                                    ...ovStyles.presetBtn,
                                    borderColor: selectedPreset === p.id ? p.color : 'var(--border)',
                                    color:       selectedPreset === p.id ? p.color : 'var(--text-dim)',
                                    background:  selectedPreset === p.id ? `${p.color}18` : 'transparent',
                                    opacity:     round > 0 ? 0.35 : 1,
                                    cursor:      round > 0 ? 'not-allowed' : 'pointer',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedPreset('custom')}
                            style={{
                                ...ovStyles.presetBtn,
                                borderColor: selectedPreset === 'custom' ? 'rgba(255,255,255,0.4)' : 'var(--border)',
                                color:       selectedPreset === 'custom' ? 'rgba(255,255,255,0.75)' : 'var(--text-dim)',
                                background:  selectedPreset === 'custom' ? 'rgba(255,255,255,0.06)' : 'transparent',
                            }}
                        >
                            Custom
                        </button>
                    </div>
                    <p style={ovStyles.presetDesc}>
                        {activePreset
                            ? activePreset.desc
                            : 'Custom configuration — settings adjusted manually.'}
                    </p>
                    <div style={ovStyles.divider} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Time Limit</span>
                            <span style={ovStyles.statsCompactValue}>{shooterSettings.roundDuration}s</span>
                        </div>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Hit to Win</span>
                            <span style={ovStyles.statsCompactValue}>{shooterSettings.tugWinThreshold}</span>
                        </div>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Powerups</span>
                            <span style={ovStyles.statsCompactValue}>
                                {shooterSettings.modChoiceEnabled ? `Every ${shooterSettings.modChoiceInterval} rounds` : 'Off'}
                            </span>
                        </div>
                    </div>
                    <button
                        className="btn btn--ghost btn--sm"
                        style={{ alignSelf: 'flex-end' }}
                        onClick={() => onNavigateTab('DnaRound')}
                    >
                        Round Settings →
                    </button>
                </div>

                {/* DNA-Sektion — read-only here; edited from the DNA & Round tab.
                    No separate "starter vs current" label — it's just DNA,
                    whichever is currently true (live agent if a game exists). */}
                <div ref={dnaPanelRef} className="panel panel--md">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ ...tabStyles.sectionLabel, margin: 0 }}>DNA</p>
                        <button className="btn btn--ghost btn--sm" onClick={() => onNavigateTab('DnaRound')}>
                            Edit →
                        </button>
                    </div>
                    <div style={{ ...ovStyles.geneList, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
                        {DNA_NAMES.map((name, i) => (
                            <DnaGeneRow
                                key={i}
                                label={DNA_GENE_INFO[name].label}
                                tooltip={DNA_GENE_INFO[name].tooltip}
                                value={displayedDna[i] ?? 0}
                                delta={showActiveDna ? (displayedDna[i] ?? 0) - (prevDna[i] ?? 0) : 0}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

const ovStyles: Record<string, React.CSSProperties> = {
    layout: {
        display: 'flex',
        gap:     16,
        height:  260,
    },
    slot: {
        flex:          '0 0 50%',
        display:       'flex',
        flexDirection: 'column',
        overflow:      'hidden',
    },
    // Surface chrome (background/border/radius/padding) comes from the shared
    // "panel panel--md" className — this only carries the flex layout.
    placeholder: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
        overflow:      'hidden',
    },
    placeholderHeading: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
        flexShrink:    0,
    },
    presetBtns: {
        display:   'flex',
        gap:       6,
        flexShrink: 0,
    },
    presetBtn: {
        flex:          1,
        padding:       '9px 0',
        border:        '1px solid',
        borderRadius:  'var(--r-sm)',
        cursor:        'pointer',
        fontFamily:    'var(--font-mono)',
        fontSize:      13,
        fontWeight:    700,
        letterSpacing: '0.03em',
        transition:    'all 0.15s ease',
    },
    presetDesc: {
        fontSize:   13,
        color:      'var(--text-muted)',
        lineHeight: 1.5,
        margin:     0,
        flexShrink: 0,
    },
    emptySlot: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        border:        '1px dashed rgba(255,255,255,0.12)',
        borderRadius:  'var(--r-md)',
        padding:       '32px 28px 24px',
        textAlign:     'center',
    },
    // Surface chrome comes from "panel panel--md" — see placeholder above.
    activeSlot: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        gap:           12,
    },
    slotIcon: {
        fontSize:  40,
        opacity:   0.45,
    },
    slotTitle: {
        fontFamily:    'var(--font-mono)',
        fontSize:      14,
        fontWeight:    700,
        color:         'rgba(255,255,255,0.35)',
        letterSpacing: '0.04em',
    },
    slotSub: {
        fontSize:   13,
        color:      'rgba(255,255,255,0.22)',
        lineHeight: 1.6,
    },

    header: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        flexShrink:     0,
    },
    roundLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'var(--text-muted)',
        marginBottom:  2,
    },
    roundValue: {
        fontFamily:  'var(--font-mono)',
        fontSize:    48,
        fontWeight:  700,
        color:       'var(--accent)',
        lineHeight:  1,
        textShadow:  '0 0 24px var(--accent-glow)',
    },


    divider: {
        height:     1,
        background: 'var(--border)',
    },
    dnaRow: {
        display:     'flex',
        gap:         3,
        flex:        1,
        flexWrap:    'wrap' as const,
        alignItems:  'center',
        marginLeft:  10,
    },
    dnaLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      9,
        fontWeight:    700,
        letterSpacing: '0.06em',
        color:         'rgba(255,255,255,0.25)',
        marginRight:   4,
        flexShrink:    0,
    },
    dnaCell: {
        fontFamily: 'var(--font-mono)',
        fontSize:   9,
        color:      'rgba(255,255,255,0.35)',
        lineHeight: 1,
    },

    geneList: {
        display:             'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap:                 '10px 20px',
    },
    geneRow: {
        display:       'flex',
        flexDirection: 'column',
        gap:           4,
    },
    geneHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
    },
    geneName: {
        fontFamily:    'var(--font-mono)',
        fontSize:      13,
        color:         'var(--text-dim)',
        letterSpacing: '0.03em',
    },
    geneValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   14,
        fontWeight: 700,
        color:      'var(--accent)',
        flexShrink: 0,
    },
    geneDelta: {
        fontFamily: 'var(--font-mono)',
        fontSize:   12,
        fontWeight: 700,
        marginLeft: 6,
    },
    geneBarTrack: {
        height:       8,
        borderRadius: 4,
        background:   'var(--border)',
        overflow:     'hidden',
    },
    geneBarFill: {
        height:       '100%',
        borderRadius: 4,
        background:   'var(--accent)',
        opacity:      0.85,
        transition:   'width 0.2s ease',
    },

    statsCompact: {
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap:           4,
        minHeight:     0,
    },
    statsCompactRow: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'baseline',
        gap:            8,
    },
    statsCompactLabel: {
        fontFamily: 'var(--font-mono)',
        fontSize:   12,
        color:      'var(--text-muted)',
    },
    statsCompactValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   13,
        fontWeight: 700,
        color:      'rgba(255,255,255,0.8)',
    },

};

// ---- Settings Tabs ----

const LOBBY_TABS = ['Overview', 'Algorithm', 'DnaRound', 'Player'] as const;
type LobbyTab = typeof LOBBY_TABS[number];

// Friendlier display text — internal ids stay stable so nothing else needs to change.
const LOBBY_TAB_LABELS: Record<LobbyTab, string> = {
    Overview: 'Overview',
    Algorithm: 'Algorithm',
    DnaRound:  'DNA & Round',
    Player:    'Player',
};

const tabStyles: Record<string, React.CSSProperties> = {
    shell: {
        display:       'flex',
        flexDirection: 'column',
        gap:           0,
        minWidth:      0,
        flex:          1,
        minHeight:     0,
        overflow:      'hidden',
    },
    bar: {
        display:      'flex',
        gap:          6,
        marginBottom: 16,
    },
    tabActive: {
        padding:       '8px 16px',
        background:    'var(--accent-dim)',
        border:        '1px solid var(--accent)',
        borderRadius:  'var(--r-sm)',
        color:         'var(--accent)',
        cursor:        'pointer',
        fontSize:      '13px',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.03em',
    },
    tabInactive: {
        padding:       '8px 16px',
        background:    'transparent',
        border:        '1px solid var(--border)',
        borderRadius:  'var(--r-sm)',
        color:         'var(--text-dim)',
        cursor:        'pointer',
        fontSize:      '13px',
        fontFamily:    'var(--font-mono)',
        fontWeight:    600,
        letterSpacing: '0.03em',
    },
    panel: {
        flex:      1,
        minHeight: 0,
        overflowY: 'auto',
    },
    sectionLabel: {
        fontSize:      '12px',
        color:         'var(--text-muted)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        margin:        '0 0 12px 0',
        fontFamily:    'var(--font-mono)',
    },
    resetBtn: {
        marginTop:    '12px',
        padding:      '8px 18px',
        background:   'transparent',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        color:        'var(--text-muted)',
        cursor:       'pointer',
        fontFamily:   'var(--font)',
        fontSize:     '13px',
    },

};

// ---- Normal Lobby ----

function NormalLobby() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<LobbyTab>('Overview');
    const [hasActiveGame, setHasActiveGame] = useState(!!gameStore.state);
    // The live agent's DNA once a game exists — there's no separate "starter vs
    // current" concept in the UI, just "DNA": this is it whenever a game is
    // running, falling back to the starter setting otherwise (see dna={} below).
    const [liveDna, setLiveDna] = useState<number[] | null>(gameStore.state?.agent?.dna ?? null);
    const { shooterSettings, eaSettings, setShooterSettings } = useSettings();
    const { showHint, dismiss } = useHints();
    const [selectedPreset, setSelectedPreset] = useState<PresetId>(() => {
        const match = PRESETS.find(p =>
            p.dna.every((v, i) => Math.abs(v - shooterSettings.starterDna[i]) < 0.001) &&
            Math.abs(p.mutation - eaSettings.mutationRate) < 0.001 &&
            Math.abs(p.strength - eaSettings.mutationStrength) < 0.001 &&
            p.presim === eaSettings.presimGenerations &&
            p.modInterval === shooterSettings.modChoiceInterval
        );
        return match?.id ?? 'custom';
    });
    const isMobile = useMobile();
    const zoom = useZoom();

    useEffect(() => {
        const sync = () => {
            setHasActiveGame(!!gameStore.state);
            setLiveDna(gameStore.state?.agent?.dna ?? null);
        };
        sync();
        return gameStore.subscribe(sync);
    }, []);

    // Wenn Settings manuell geändert werden → zurück zu Custom.
    // Lives here (not in a single tab) since DNA/round settings can now be
    // edited from the Algorithm and Player tabs, not just Overview.
    useEffect(() => {
        if (selectedPreset === 'custom') return;
        const active = PRESETS.find(p => p.id === selectedPreset);
        if (!active) return;
        const dnaMatch = active.dna.every((v, i) => Math.abs(v - (shooterSettings.starterDna[i] ?? 0)) < 0.001);
        const mutMatch = Math.abs(active.mutation - eaSettings.mutationRate) < 0.001 &&
                         Math.abs(active.strength  - eaSettings.mutationStrength) < 0.001;
        const presimMatch = active.presim === eaSettings.presimGenerations;
        const intervalMatch = active.modInterval === shooterSettings.modChoiceInterval;
        if (!dnaMatch || !mutMatch || !presimMatch || !intervalMatch) setSelectedPreset('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shooterSettings.starterDna, shooterSettings.modChoiceInterval, eaSettings.mutationRate, eaSettings.mutationStrength, eaSettings.presimGenerations]);

    const warnIfMidRound = () => { if (hasActiveGame) showHint('shooter.dnaChangeDuringRound'); };

    // Guided lobby tour: a spotlight dims the screen except the one real UI
    // element each step is about (tab bar → difficulty presets → DNA panel →
    // Play button) instead of a corner-pinned bubble — see TourSpotlight.
    // Wording still comes from hintContent.ts; the Next/Skip chain lives here
    // since HintDef has no action field and only the call site knows "next".
    const tabBarRef   = useRef<HTMLDivElement>(null);
    const presetsRef  = useRef<HTMLDivElement>(null);
    const dnaPanelRef = useRef<HTMLDivElement>(null);
    const playBtnRef  = useRef<HTMLButtonElement>(null);
    const TOUR_STEPS: { id: HintId; ref: RefObject<HTMLElement | null> }[] = [
        { id: 'shooter.tour.modes',      ref: tabBarRef },
        { id: 'shooter.tour.difficulty', ref: presetsRef },
        { id: 'shooter.tour.dna',        ref: dnaPanelRef },
        { id: 'shooter.tour.start',      ref: playBtnRef },
    ];
    const [tourStep, setTourStep] = useState<number | null>(null);
    const startTour = () => {
        setTab('Overview'); // every step's target lives on this tab
        setTourStep(0);
    };
    const stopTour = () => setTourStep(null);

    const tourOverlay = tourStep !== null && (() => {
        const step   = TOUR_STEPS[tourStep];
        const def    = HINTS[step.id];
        const isLast = tourStep === TOUR_STEPS.length - 1;
        return (
            <TourSpotlight
                key={step.id}
                targetRef={step.ref}
                title={def.title}
                body={def.body}
                actions={[
                    {
                        label:   isLast ? 'Got it' : 'Next',
                        onClick: () => (isLast ? stopTour() : setTourStep(tourStep + 1)),
                        variant: 'primary',
                    },
                    ...(isLast ? [] : [{ label: 'Skip', onClick: stopTour, variant: 'ghost' as const }]),
                ]}
                onSkip={stopTour}
            />
        );
    })();

    // First visit to the Solo lobby this session → offer the tour once.
    useEffect(() => {
        showHint('shooter.tour.welcome', {
            actions: [
                { label: 'Show me around', onClick: startTour, variant: 'primary' },
                { label: 'No thanks', onClick: dismiss, variant: 'ghost' },
            ],
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const startPractice = async () => {
        await enterGameFullscreen();
        gameStore.state = null as unknown as typeof gameStore.state;
        gameStore.notify();
        navigate('/ShooterGame', { state: { tutorial: true } });
    };

    const tabBar = (
        <div ref={tabBarRef} style={{ ...tabStyles.bar, overflowX: 'auto', flexWrap: 'nowrap' as const, flexShrink: 0 }}>
            {LOBBY_TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                    style={{ ...(tab === t ? tabStyles.tabActive : tabStyles.tabInactive), flexShrink: 0 }}>
                    {LOBBY_TAB_LABELS[t]}
                </button>
            ))}
        </div>
    );

    const tabContent = (
        <div style={{ ...tabStyles.panel, overflowY: isMobile ? 'visible' : 'auto' }}>
            {tab === 'Overview' && (
                <SoloPlayOverview
                    selectedPreset={selectedPreset}
                    setSelectedPreset={setSelectedPreset}
                    onNavigateTab={setTab}
                    presetsRef={presetsRef}
                    dnaPanelRef={dnaPanelRef}
                />
            )}
            {tab === 'Algorithm' && <EASettingsPanel />}
            {tab === 'DnaRound' && (
                <>
                    <div className="panel panel--md" style={{ marginBottom: 12 }}>
                        <p style={tabStyles.sectionLabel}>DNA</p>
                        <ShooterDnaSection
                            dna={liveDna ?? shooterSettings.starterDna}
                            onChange={(i, v) => {
                                warnIfMidRound();
                                // Not "starter vs current" — just DNA. This always updates
                                // the setting (so it's what the next reset starts from),
                                // and if a game is actually running right now, it also
                                // patches the live agent so the edit takes effect immediately
                                // instead of silently doing nothing until you reset.
                                const newDna = [...(liveDna ?? shooterSettings.starterDna)];
                                newDna[i] = v;
                                setShooterSettings({ ...shooterSettings, starterDna: newDna });
                                if (gameStore.state) {
                                    const newPop  = initPopulation(newDna);
                                    const prevGen = gameStore.state.population?.generation ?? 1;
                                    gameStore.state = {
                                        ...gameStore.state,
                                        population: { ...newPop, generation: prevGen },
                                        agent:      { ...gameStore.state.agent, dna: newDna },
                                    };
                                    gameStore.notify();
                                }
                            }}
                        />
                    </div>
                    <div className="panel panel--md">
                        <p style={tabStyles.sectionLabel}>Round Settings</p>
                        <ShooterRoundSection
                            locked={selectedPreset !== 'custom'}
                            onBeforeChange={warnIfMidRound}
                        />
                    </div>
                </>
            )}
            {tab === 'Player' && (
                <>
                    <div className="panel panel--md">
                        <ShooterPlayerSection />
                    </div>
                    <button style={tabStyles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>Reset</button>
                </>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, margin: 0 }}>Solo Play</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {tabBar}
                    {tabContent}
                </div>
                <div style={mobileBtnsStyle}>
                    <HelpButton topic="shooter.solo" onTakeTour={startTour} />
                    <button className="btn btn--outline btn--sm" onClick={startPractice} title="Tutorial">🎓</button>
                    <button ref={playBtnRef} className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={async () => { await enterGameFullscreen(); navigate('/ShooterGame'); }}>
                        {hasActiveGame ? 'Continue →' : 'Play →'}
                    </button>
                </div>
                {tourOverlay}
            </div>
        );
    }

    return (
        <div style={{ ...lobbyStyles.page, zoom }}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.leftTopPreview}>
                    <div style={lobbyStyles.brand}>
                        <div style={lobbyStyles.brandLogo}>SG</div>
                        <span style={lobbyStyles.brandName}>Shooter Game</span>
                    </div>
                    <ShooterPreview />
                    <div style={lobbyStyles.previewLabel}>Live Preview</div>
                </div>
                <div style={{ ...lobbyStyles.leftTopHelpSlot, flexDirection: 'column', gap: 8 }}>
                    <HelpButton topic="shooter.solo" className="btn btn--outline btn--block help-button" onTakeTour={startTour} />
                </div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={lobbyStyles.title}>Solo Play</h1>
                </div>
                <div style={tabStyles.shell}>
                    {tabBar}
                    {tabContent}
                </div>
            </div>

            <div style={{ ...lobbyStyles.rightBottom, gap: 10 }}>
                <button className="btn btn--outline btn--lg" onClick={startPractice}>🎓 Tutorial</button>
                <button ref={playBtnRef} className="btn btn--primary btn--lg" onClick={async () => { await enterGameFullscreen(); navigate('/ShooterGame'); }}>
                    {hasActiveGame ? 'Continue →' : 'Play →'}
                </button>
            </div>
            {tourOverlay}
        </div>
    );
}

// ---- Raidboss Lobby ----

const RB = '#a855f7';

function RaidbossLobby() {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const zoom = useZoom();
    const [doc,     setDoc]     = useState<RaidbossDoc | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getRaidbossStatus().then(setDoc).catch(() => {});
    }, []);

    const handlePlay = async () => {
        setLoading(true);
        try {
            await enterGameFullscreen();
            await claimRaidbossSlot();
            gameStore.state = null as unknown as typeof gameStore.state;
            gameStore.notify();
            analyticsStore.clear();
            navigate('/ShooterGame');
        } catch (err) {
            console.error('[Raidboss] Fehler:', err);
            setLoading(false);
        }
    };

    const evalCount  = doc ? doc.individuals.filter(i => i.fitness !== null).length : 0;
    const total      = doc?.populationSize ?? 0;
    const nextIndex  = doc ? doc.individuals.findIndex(i => i.fitness === null) : -1;
    const progress   = total > 0 ? evalCount / total : 0;
    const genTotal   = doc ? (doc.generation - 1) * total + evalCount : 0;

    const statusContent = doc === null ? (
        <div style={rbStyles.emptyState}>
            <span style={rbStyles.emptyIcon}>🧬</span>
            <span style={rbStyles.emptyTitle}>No boss trained yet</span>
            <span style={rbStyles.emptySub}>Be the first and start the first generation.</span>
        </div>
    ) : (
        <div style={rbStyles.statusPanel}>
            <div style={rbStyles.genRow}>
                <span style={rbStyles.genLabel}>Generation</span>
                <span style={rbStyles.genValue}>{doc.generation}</span>
                <span style={rbStyles.genTotal}>{genTotal} individuals evaluated in total</span>
            </div>
            <div style={rbStyles.progressBlock}>
                <div style={rbStyles.progressHeader}>
                    <span style={rbStyles.progressLabel}>Progress this generation</span>
                    <span style={rbStyles.progressCount}>{evalCount} / {total}</span>
                </div>
                <div style={rbStyles.progressTrack}>
                    <div style={{ ...rbStyles.progressFill, width: `${progress * 100}%` }} />
                </div>
            </div>
            <div style={rbStyles.dotsRow}>
                {doc.individuals.map((ind, i) => {
                    const isDone = ind.fitness !== null;
                    const isNext = i === nextIndex;
                    return (
                        <div
                            key={i}
                            title={`Individual ${i + 1}${isDone ? ` · Fitness ${ind.fitness?.toFixed(2)}` : isNext ? ' · Next up' : ''}`}
                            style={{
                                ...rbStyles.dot,
                                background:  isDone ? RB : isNext ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.08)',
                                border:      isNext ? `1px solid ${RB}` : '1px solid transparent',
                                boxShadow:   isDone ? `0 0 6px rgba(168,85,247,0.5)` : 'none',
                            }}
                        />
                    );
                })}
            </div>
            {nextIndex !== -1 ? (
                <div style={rbStyles.nextUp}>
                    <span style={rbStyles.nextUpLabel}>Next up</span>
                    <span style={rbStyles.nextUpValue}>Individual {nextIndex + 1} of {total}</span>
                </div>
            ) : (
                <div style={rbStyles.nextUp}>
                    <span style={rbStyles.nextUpLabel}>Status</span>
                    <span style={{ ...rbStyles.nextUpValue, color: '#4ade80' }}>All evaluated — evolution running</span>
                </div>
            )}
        </div>
    );

    const playBtn = (
        <button
            className="btn btn--outline btn--lg"
            style={{ '--btn-color': RB } as React.CSSProperties}
            onClick={handlePlay}
            disabled={loading}
        >
            {loading ? 'Loading...' : 'Fight Raidboss →'}
        </button>
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, color: RB, margin: 0 }}>Community Raidboss</h1>
                <p style={{ ...lobbyStyles.description, margin: 0 }}>
                    Each player evaluates one agent from the community population.
                    Once all are evaluated, the population automatically evolves to the next generation.
                </p>
                {statusContent}
                <div style={mobileBtnsStyle}>
                    <HelpButton topic="shooter.raidboss" />
                    <div style={{ flex: 1 }}>{playBtn}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ ...lobbyStyles.page, zoom }}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.leftTopPreview}>
                    <div style={lobbyStyles.brand}>
                        <div style={{ ...lobbyStyles.brandLogo, color: RB, background: 'rgba(168,85,247,0.1)', borderColor: 'rgba(168,85,247,0.25)' }}>SG</div>
                        <span style={lobbyStyles.brandName}>Shooter Game</span>
                    </div>
                    <RaidbossPreview />
                    <div style={lobbyStyles.previewLabel}>Boss Preview</div>
                </div>
                <div style={lobbyStyles.leftTopHelpSlot}>
                    <HelpButton topic="shooter.raidboss" className="btn btn--outline btn--block help-button" />
                </div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={{ ...lobbyStyles.title, color: RB }}>Community Raidboss</h1>
                    <p style={lobbyStyles.description}>
                        Jeder Spieler bewertet einen Agenten der Community-Population.
                        Sind alle bewertet, evoliert die Population automatisch zur nächsten Generation.
                    </p>
                </div>
                {statusContent}
            </div>

            <div style={lobbyStyles.rightBottom}>
                {playBtn}
            </div>
        </div>
    );
}

const rbStyles: Record<string, React.CSSProperties> = {
    emptyState: {
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            6,
        padding:        '20px',
        background:     'rgba(168,85,247,0.05)',
        border:         '1px dashed rgba(168,85,247,0.25)',
        borderRadius:   10,
    },
    emptyIcon:  { fontSize: 28 },
    emptyTitle: { fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'rgba(192,158,255,0.9)' },
    emptySub:   { fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 },

    statusPanel: {
        display:       'flex',
        flexDirection: 'column',
        gap:           20,
    },
    genRow: {
        display:    'flex',
        alignItems: 'baseline',
        gap:        12,
    },
    genLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      11,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'rgba(168,85,247,0.6)',
    },
    genValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   48,
        fontWeight: 700,
        color:      RB,
        lineHeight: 1,
        textShadow: '0 0 24px rgba(168,85,247,0.4)',
    },
    genTotal: {
        fontSize: 13,
        color:    'rgba(255,255,255,0.35)',
    },

    progressBlock: {
        display:       'flex',
        flexDirection: 'column',
        gap:           6,
    },
    progressHeader: {
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
    },
    progressLabel: {
        fontSize:      11,
        letterSpacing: '0.06em',
        textTransform: 'uppercase' as const,
        color:         'rgba(255,255,255,0.35)',
        fontFamily:    'var(--font-mono)',
    },
    progressCount: {
        fontFamily: 'var(--font-mono)',
        fontSize:   14,
        fontWeight: 700,
        color:      'rgba(192,158,255,0.85)',
    },
    progressTrack: {
        height:       6,
        borderRadius: 999,
        background:   'rgba(255,255,255,0.08)',
        overflow:     'hidden',
    },
    progressFill: {
        height:           '100%',
        borderRadius:     999,
        background:       `linear-gradient(90deg, rgba(168,85,247,0.7), ${RB})`,
        transition:       'width 0.4s ease',
        boxShadow:        '0 0 8px rgba(168,85,247,0.5)',
    },

    dotsRow: {
        display:   'flex',
        flexWrap:  'wrap' as const,
        gap:       6,
    },
    dot: {
        width:        14,
        height:       14,
        borderRadius: '50%',
        flexShrink:   0,
        transition:   'all 0.2s ease',
        cursor:       'default',
    },

    nextUp: {
        display:    'flex',
        alignItems: 'center',
        gap:        10,
        padding:    '10px 14px',
        background: 'rgba(168,85,247,0.07)',
        border:     '1px solid rgba(168,85,247,0.2)',
        borderRadius: 8,
    },
    nextUpLabel: {
        fontFamily:    'var(--font-mono)',
        fontSize:      10,
        letterSpacing: '0.1em',
        textTransform: 'uppercase' as const,
        color:         'rgba(168,85,247,0.55)',
        flexShrink:    0,
    },
    nextUpValue: {
        fontFamily: 'var(--font-mono)',
        fontSize:   14,
        fontWeight: 700,
        color:      'rgba(192,158,255,0.9)',
    },
};

// ---- Horde Lobby ----

const HORDE_TABS = ['Overview', 'Algorithm', 'DnaWave', 'Player', 'Map'] as const;
type HordeTab = typeof HORDE_TABS[number];

// Friendlier display text — internal ids stay stable so nothing else needs to change.
const HORDE_TAB_LABELS: Record<HordeTab, string> = {
    Overview:  'Overview',
    Algorithm: 'Algorithm',
    DnaWave:   'DNA & Wave',
    Player:    'Player',
    Map:       'Map',
};

// Horde-only difficulty presets — deliberately independent of the Solo Play PRESETS
// above, since HordeSettings no longer shares state with the global EASettings.
const HORDE_PRESETS = [
    {
        id:       'easy',
        label:    'Easy',
        color:    '#4ade80',
        desc:     'Small waves, gentle mutation, and a faster trigger finger.',
        waveSize:  12,
        mutation:  0.05,
        strength:  0.10,
        shootCd:   0.09,
        crossover: 'uniform',
    },
    {
        id:       'medium',
        label:    'Medium',
        color:    '#facc15',
        desc:     'Balanced wave size, mutation pressure, and fire rate.',
        waveSize:  20,
        mutation:  0.15,
        strength:  0.20,
        shootCd:   0.12,
        crossover: 'uniform',
    },
    {
        id:       'hard',
        label:    'Hard',
        color:    '#f87171',
        desc:     'Large waves, aggressive mutation, and a slower trigger — brutal.',
        waveSize:  30,
        mutation:  0.25,
        strength:  0.30,
        shootCd:   0.18,
        crossover: 'uniform',
    },
] as const;

type HordePresetId = typeof HORDE_PRESETS[number]['id'] | 'custom';

// Horde agents are melee-only (touch = death, they never shoot) — updateHorde()
// only ever reads these three shared genes (not Fire Rate/Bullet Speed/Accuracy/
// Range/Lead), plus its own Size/Opacity/Movement Loop genes, which have no
// shared DNA_GENE_INFO entry since they're Horde-only concepts.
const HORDE_BAR_GENES: DnaGeneDescriptor[] = [
    { index: DNA_INDEX.AGGRESSION,     label: DNA_GENE_INFO.AGGRESSION.label,     tooltip: DNA_GENE_INFO.AGGRESSION.tooltip },
    { index: DNA_INDEX.DODGE_WEIGHT,   label: DNA_GENE_INFO.DODGE_WEIGHT.label,   tooltip: DNA_GENE_INFO.DODGE_WEIGHT.tooltip },
    { index: DNA_INDEX.MOVEMENT_SPEED, label: DNA_GENE_INFO.MOVEMENT_SPEED.label, tooltip: DNA_GENE_INFO.MOVEMENT_SPEED.tooltip },
    { index: SIZE_GENE_INDEX,    label: 'Size',    tooltip: "How large the agent's hitbox is — smaller is genuinely harder to hit." },
    { index: OPACITY_GENE_INDEX, label: 'Opacity', tooltip: 'How visible the agent is — fainter is harder to spot.' },
];

// Movement Loop gets its own degree-badge display in the read-only Overview
// (see below), but as plain 0-1 sliders it's just 4 more editable rows here.
const HORDE_LOOP_GENES: DnaGeneDescriptor[] = Array.from({ length: LOOP_STEPS }, (_, i) => ({
    index:   LOOP_GENE_START + i,
    label:   `Loop Step ${i + 1}`,
    tooltip: 'One step of the evolved movement loop — a steering-rotation offset applied on top of the normal chase/dodge direction.',
}));

const HORDE_EDITABLE_GENES: DnaGeneDescriptor[] = [...HORDE_BAR_GENES, ...HORDE_LOOP_GENES];

function HordeOverview({ onNavigateTab }: { onNavigateTab: (tab: HordeTab) => void }) {
    const isMobile = useMobile();
    const [lastRun, setLastRun]     = useState(hordeRunStore.lastRun);
    const [activeRun, setActiveRun] = useState(hordeGameStore.state);
    const activeModIds = useSyncExternalStore(cb => runModsStore.subscribe(cb), () => runModsStore.activeModIds);
    const { hordeSettings, setHordeSettings } = useSettings();

    useEffect(() => hordeRunStore.subscribe(() => setLastRun(hordeRunStore.lastRun)), []);
    useEffect(() => hordeGameStore.subscribe(() => setActiveRun(hordeGameStore.state)), []);

    // Abandon the in-progress run without having to die first — mirrors Solo
    // Play's Reset. Doesn't touch "Last Run": that's a separate, already-
    // completed run's scoreboard, not part of what's being abandoned here.
    const handleReset = () => {
        hordeGameStore.state = null;
        hordeGameStore.notify();
    };

    const [selectedPreset, setSelectedPreset] = useState<HordePresetId>(() => {
        const match = HORDE_PRESETS.find(p =>
            p.waveSize === hordeSettings.waveSize &&
            Math.abs(p.mutation - hordeSettings.mutationRate) < 0.001 &&
            Math.abs(p.strength - hordeSettings.mutationStrength) < 0.001 &&
            Math.abs(p.shootCd  - hordeSettings.shootCooldown) < 0.001 &&
            p.crossover === hordeSettings.crossoverType
        );
        return match?.id ?? 'custom';
    });

    const applyPreset = (p: typeof HORDE_PRESETS[number]) => {
        setSelectedPreset(p.id);
        setHordeSettings({
            ...hordeSettings,
            waveSize:         p.waveSize,
            mutationRate:     p.mutation,
            mutationStrength: p.strength,
            shootCooldown:    p.shootCd,
            crossoverType:    p.crossover,
        });
    };

    // Wenn Settings manuell geändert werden → zurück zu Custom
    useEffect(() => {
        if (selectedPreset === 'custom') return;
        const active = HORDE_PRESETS.find(p => p.id === selectedPreset);
        if (!active) return;
        const matches = active.waveSize === hordeSettings.waveSize &&
                         Math.abs(active.mutation - hordeSettings.mutationRate) < 0.001 &&
                         Math.abs(active.strength - hordeSettings.mutationStrength) < 0.001 &&
                         Math.abs(active.shootCd  - hordeSettings.shootCooldown) < 0.001 &&
                         active.crossover === hordeSettings.crossoverType;
        if (!matches) setSelectedPreset('custom');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hordeSettings.waveSize, hordeSettings.mutationRate, hordeSettings.mutationStrength, hordeSettings.shootCooldown, hordeSettings.crossoverType]);

    const activePreset = HORDE_PRESETS.find(p => p.id === selectedPreset) ?? null;

    const activeMods = activeRun ? MOD_POOL.filter(m => activeModIds.includes(m.id)) : [];
    const bestIndividual = activeRun
        ? activeRun.population.individuals.reduce((a, b) => (b.fitness > a.fitness ? b : a))
        : null;
    const displayDna = bestIndividual ? bestIndividual.dna : hordeSettings.starterDna;

    return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
            <div style={ovStyles.slot}>
                {activeRun ? (
                    <div className="panel panel--md" style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Run In Progress</div>
                            <div style={ovStyles.roundValue}>{activeRun.score}</div>
                        </div>
                        <div style={ovStyles.divider} />
                        <div style={ovStyles.statsCompact}>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Kills</span>
                                <span style={ovStyles.statsCompactValue}>{activeRun.score}</span>
                            </div>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Generation</span>
                                <span style={ovStyles.statsCompactValue}>{activeRun.generation}</span>
                            </div>
                        </div>
                        {activeMods.length > 0 && (
                            <>
                                <div style={ovStyles.divider} />
                                <div>
                                    <span style={ovStyles.statsCompactLabel}>Active Items</span>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                                        {activeMods.map(mod => (
                                            <span
                                                key={mod.id}
                                                title={`${mod.name} — ${mod.description}`}
                                                style={{
                                                    display:      'inline-flex',
                                                    alignItems:   'center',
                                                    gap:          4,
                                                    padding:      '4px 9px',
                                                    borderRadius: 999,
                                                    background:   'rgba(251,146,60,0.1)',
                                                    border:       '1px solid rgba(251,146,60,0.25)',
                                                    fontSize:     12,
                                                    color:        'rgba(255,255,255,0.75)',
                                                }}
                                            >
                                                {mod.icon} {mod.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                        <div style={ovStyles.divider} />
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="btn btn--outline btn--c-danger btn--sm" onClick={handleReset}>
                                Reset
                            </button>
                        </div>
                    </div>
                ) : lastRun ? (
                    <div className="panel panel--md" style={ovStyles.activeSlot}>
                        <div style={ovStyles.header}>
                            <div style={ovStyles.roundLabel}>Last Run</div>
                            <div style={ovStyles.roundValue}>{lastRun.score}</div>
                        </div>
                        <div style={ovStyles.divider} />
                        <div style={ovStyles.statsCompact}>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Kills</span>
                                <span style={ovStyles.statsCompactValue}>{lastRun.score}</span>
                            </div>
                            <div style={ovStyles.statsCompactRow}>
                                <span style={ovStyles.statsCompactLabel}>Generations Reached</span>
                                <span style={ovStyles.statsCompactValue}>{lastRun.generation}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={ovStyles.emptySlot}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                            <span style={ovStyles.slotIcon}>💀</span>
                            <span style={ovStyles.slotTitle}>No runs yet</span>
                            <span style={ovStyles.slotSub}>
                                Start a wave and see<br />how long you survive.
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Right column: Difficulty stacked above the (read-only) DNA display —
                same pattern as Solo's Overview. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="panel panel--md" style={{ ...ovStyles.placeholder, flex: 'none' }}>
                    <span style={ovStyles.placeholderHeading}>Game</span>
                    <div style={ovStyles.presetBtns}>
                        {HORDE_PRESETS.map(p => (
                            <button
                                key={p.id}
                                onClick={() => applyPreset(p)}
                                style={{
                                    ...ovStyles.presetBtn,
                                    borderColor: selectedPreset === p.id ? p.color : 'var(--border)',
                                    color:       selectedPreset === p.id ? p.color : 'var(--text-dim)',
                                    background:  selectedPreset === p.id ? `${p.color}18` : 'transparent',
                                }}
                            >
                                {p.label}
                            </button>
                        ))}
                        <button
                            onClick={() => setSelectedPreset('custom')}
                            style={{
                                ...ovStyles.presetBtn,
                                borderColor: selectedPreset === 'custom' ? 'rgba(255,255,255,0.4)' : 'var(--border)',
                                color:       selectedPreset === 'custom' ? 'rgba(255,255,255,0.75)' : 'var(--text-dim)',
                                background:  selectedPreset === 'custom' ? 'rgba(255,255,255,0.06)' : 'transparent',
                            }}
                        >
                            Custom
                        </button>
                    </div>
                    <p style={ovStyles.presetDesc}>
                        {activePreset ? activePreset.desc : 'Custom configuration — wave size adjusted manually.'}
                    </p>
                    <div style={ovStyles.divider} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Wave Size</span>
                            <span style={ovStyles.statsCompactValue}>{hordeSettings.waveSize}</span>
                        </div>
                        <div style={ovStyles.statsCompactRow}>
                            <span style={ovStyles.statsCompactLabel}>Powerups</span>
                            <span style={ovStyles.statsCompactValue}>{hordeSettings.modChoiceEnabled ? 'On' : 'Off'}</span>
                        </div>
                    </div>
                    <button
                        className="btn btn--ghost btn--sm"
                        style={{ alignSelf: 'flex-end' }}
                        onClick={() => onNavigateTab('DnaWave')}
                    >
                        Wave Settings →
                    </button>
                </div>

                {/* DNA-Sektion — read-only here; edited from the DNA & Wave tab.
                    No separate "starter vs current" label — displayDna is
                    either the current run's best agent, or (now that
                    Size/Opacity/Movement Loop are real starter-DNA slots too)
                    the starter DNA setting itself. Either way there's always
                    a real value, so this never needs placeholders. */}
                <div className="panel panel--md">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <p style={{ ...tabStyles.sectionLabel, margin: 0 }}>DNA</p>
                        <button className="btn btn--ghost btn--sm" onClick={() => onNavigateTab('DnaWave')}>
                            Edit →
                        </button>
                    </div>
                    <div style={{ ...ovStyles.geneList, gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)' }}>
                        {HORDE_BAR_GENES.map(g => (
                            <DnaGeneRow
                                key={g.index}
                                label={g.label}
                                tooltip={g.tooltip}
                                value={displayDna[g.index] ?? 0}
                                delta={0}
                            />
                        ))}
                    </div>
                    <div style={{ marginTop: 14 }}>
                        <span style={ovStyles.placeholderHeading}>Movement Loop</span>
                        <p style={{ ...ovStyles.presetDesc, marginTop: 4 }}>
                            Evolved steering offsets, applied on top of the normal chase/dodge — repeats every {(LOOP_STEPS * LOOP_STEP_DURATION).toFixed(1)}s.
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                            {Array.from({ length: LOOP_STEPS }, (_, i) => {
                                const gene = displayDna[LOOP_GENE_START + i] ?? 0.5;
                                const deg  = Math.round((loopOffsetRad(gene) * 180) / Math.PI);
                                return (
                                    <span
                                        key={i}
                                        style={{
                                            display:      'inline-flex',
                                            alignItems:   'center',
                                            padding:      '4px 10px',
                                            borderRadius: 999,
                                            background:   'rgba(251,146,60,0.1)',
                                            border:       '1px solid rgba(251,146,60,0.25)',
                                            fontSize:     12,
                                            fontFamily:   'var(--font-mono)',
                                            color:        'rgba(255,255,255,0.75)',
                                        }}
                                    >
                                        {deg > 0 ? `+${deg}°` : `${deg}°`}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function HordeMapSection() {
    const navigate = useNavigate();
    const { hordeSettings, setHordeSettings } = useSettings();
    const customCount = hordeSettings.customObstacles.length;

    const btnStyle = (active: boolean): React.CSSProperties => ({
        ...ovStyles.presetBtn,
        flex:        'none',
        textAlign:   'left',
        padding:     '10px 14px',
        borderColor: active ? '#fb923c' : 'var(--border)',
        color:       active ? '#fb923c' : 'var(--text-dim)',
        background:  active ? 'rgba(251,146,60,0.09)' : 'transparent',
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={ovStyles.placeholderHeading}>Map</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {HORDE_MAPS.map(m => (
                    <button
                        key={m.id}
                        onClick={() => setHordeSettings({ ...hordeSettings, mapId: m.id })}
                        style={btnStyle(hordeSettings.mapId === m.id)}
                    >
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{m.label}</div>
                        <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>
                            {m.description}
                        </div>
                    </button>
                ))}
                <button
                    onClick={() => {
                        setHordeSettings({ ...hordeSettings, mapId: CUSTOM_MAP_ID });
                        navigate('/HordeMapEditor');
                    }}
                    style={btnStyle(hordeSettings.mapId === CUSTOM_MAP_ID)}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>Custom</span>
                        <span style={{ fontSize: 11, opacity: 0.6 }}>Edit →</span>
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>
                        {customCount === 0
                            ? 'Build your own layout in the map editor.'
                            : `${customCount} obstacle${customCount === 1 ? '' : 's'} placed — click to keep editing.`}
                    </div>
                </button>
            </div>
        </div>
    );
}

function HordeLobby({ initialTab }: { initialTab?: HordeTab }) {
    const navigate = useNavigate();
    const isMobile = useMobile();
    const zoom     = useZoom();
    const HO       = '#fb923c';
    const [tab, setTab] = useState<HordeTab>(initialTab ?? 'Overview');
    const { hordeSettings, setHordeSettings, setShooterSettings } = useSettings();
    const selectedMap = resolveHordeMap(hordeSettings.mapId, hordeSettings.customObstacles, hordeSettings.customSpawnSides, hordeSettings.customPlayerSpawn);

    const [activeRun, setActiveRun] = useState(hordeGameStore.state);
    useEffect(() => hordeGameStore.subscribe(() => setActiveRun(hordeGameStore.state)), []);
    const hasActiveRun = !!activeRun;
    // While a run is in progress, show the map it actually started with — the
    // player may have changed the map setting since without restarting.
    const previewMap = activeRun?.map ?? selectedMap;

    // No "starter vs current" distinction in the UI — just DNA. While a run is
    // active this is the best-performing individual's actual genome (editing
    // it patches that individual directly); otherwise it's the starter setting.
    const bestIndex = activeRun
        ? activeRun.population.individuals.reduce((bestI, cur, i, arr) => cur.fitness > arr[bestI].fitness ? i : bestI, 0)
        : -1;
    const bestIndividual = activeRun && bestIndex >= 0 ? activeRun.population.individuals[bestIndex] : null;
    const displayDna = bestIndividual ? bestIndividual.dna : hordeSettings.starterDna;

    const handlePlay = async () => {
        await enterGameFullscreen();
        navigate('/HordeGame');
    };

    const startHordeTutorial = async () => {
        await enterGameFullscreen();
        hordeGameStore.state = null;
        hordeGameStore.notify();
        navigate('/HordeGame', { state: { tutorial: true } });
    };

    const playBtn = (
        <button
            className="btn btn--outline btn--lg"
            style={{ '--btn-color': HO } as React.CSSProperties}
            onClick={handlePlay}
        >
            {hasActiveRun ? 'Continue Horde →' : 'Play Horde →'}
        </button>
    );

    const tabBar = (
        <div style={{ ...tabStyles.bar, overflowX: 'auto', flexWrap: 'nowrap' as const, flexShrink: 0 }}>
            {HORDE_TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                    style={{ ...(tab === t ? tabStyles.tabActive : tabStyles.tabInactive), flexShrink: 0 }}>
                    {HORDE_TAB_LABELS[t]}
                </button>
            ))}
        </div>
    );

    const tabContent = (
        <div style={{ ...tabStyles.panel, overflowY: isMobile ? 'visible' : 'auto' }}>
            {tab === 'Overview' && <HordeOverview onNavigateTab={setTab} />}
            {tab === 'Algorithm' && <HordeEASettingsPanel />}
            {tab === 'DnaWave' && (
                <>
                    <div className="panel panel--md" style={{ marginBottom: 12 }}>
                        <p style={tabStyles.sectionLabel}>DNA</p>
                        <ShooterDnaSection
                            dna={displayDna}
                            onChange={(i, v) => {
                                // Not "starter vs current" — just DNA. Always updates the
                                // setting (so it's what the next run starts from). If a run
                                // is active, broadcast just this one gene to the whole swarm
                                // — every individual in the gene pool *and* every agent
                                // currently alive — rather than only the single best agent.
                                // Every other gene each of them already has stays untouched,
                                // so this doesn't erase what's evolved so far.
                                const newDna = [...displayDna];
                                newDna[i] = v;
                                setHordeSettings({ ...hordeSettings, starterDna: newDna });
                                if (activeRun) {
                                    const setGene = (dna: number[]) => {
                                        const next = [...dna];
                                        next[i] = v;
                                        return next;
                                    };
                                    hordeGameStore.state = {
                                        ...activeRun,
                                        population: {
                                            ...activeRun.population,
                                            individuals: activeRun.population.individuals.map(ind => ({ ...ind, dna: setGene(ind.dna) })),
                                        },
                                        agents: activeRun.agents.map(a => ({ ...a, dna: setGene(a.dna) })),
                                    };
                                    hordeGameStore.notify();
                                }
                            }}
                            genes={HORDE_EDITABLE_GENES}
                        />
                    </div>
                    <div className="panel panel--md">
                        <p style={tabStyles.sectionLabel}>Wave Settings</p>
                        <HordeWaveSection />
                    </div>
                </>
            )}
            {tab === 'Map' && <HordeMapSection />}
            {tab === 'Player' && (
                <>
                    <div className="panel panel--md">
                        <ShooterPlayerSection />
                    </div>
                    <button style={tabStyles.resetBtn} onClick={() => setShooterSettings(resetShooterSettings())}>Reset</button>
                </>
            )}
        </div>
    );

    if (isMobile) {
        return (
            <div style={mobilePageStyle}>
                <h1 style={{ ...lobbyStyles.title, fontSize: 20, color: HO, margin: 0 }}>Horde Mode</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    {tabBar}
                    {tabContent}
                </div>
                <div style={mobileBtnsStyle}>
                    <HelpButton topic="shooter.horde" />
                    <button className="btn btn--outline btn--sm" style={{ '--btn-color': HO } as React.CSSProperties} onClick={startHordeTutorial} title="Tutorial">🎓</button>
                    <div style={{ flex: 1 }}>{playBtn}</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ ...lobbyStyles.page, zoom }}>
            <div style={lobbyStyles.leftTop}>
                <div style={lobbyStyles.leftTopPreview}>
                    <div style={lobbyStyles.brand}>
                        <div style={{ ...lobbyStyles.brandLogo, color: HO, background: 'rgba(251,146,60,0.1)', borderColor: 'rgba(251,146,60,0.25)' }}>SG</div>
                        <span style={lobbyStyles.brandName}>Shooter Game</span>
                    </div>
                    {/* Show the real map layout — not the generic decorative demo —
                        once a run is active, so this actually reflects the run. */}
                    {(tab === 'Map' || activeRun) ? <HordeMapPreview map={previewMap} /> : <HordePreview />}
                    <div style={lobbyStyles.previewLabel}>
                        {tab === 'Map' ? 'Map Preview' : activeRun ? 'Current Map' : 'Live Preview'} · {previewMap.label}
                    </div>
                </div>
                <div style={lobbyStyles.leftTopHelpSlot}>
                    <HelpButton topic="shooter.horde" className="btn btn--outline btn--block help-button" />
                </div>
            </div>

            <div style={lobbyStyles.rightTop}>
                <div style={lobbyStyles.header}>
                    <h1 style={{ ...lobbyStyles.title, color: HO }}>Horde Mode</h1>
                </div>
                <div style={tabStyles.shell}>
                    {tabBar}
                    {tabContent}
                </div>
            </div>

            <div style={{ ...lobbyStyles.rightBottom, gap: 10 }}>
                <button className="btn btn--outline btn--lg" style={{ '--btn-color': HO } as React.CSSProperties} onClick={startHordeTutorial}>🎓 Tutorial</button>
                {playBtn}
            </div>
        </div>
    );
}

// ---- Shared Mobile Styles ----

const mobilePageStyle: React.CSSProperties = {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
    padding:       '16px',
    boxSizing:     'border-box',
};

const mobileBtnsStyle: React.CSSProperties = {
    display:    'flex',
    gap:        10,
    flexShrink: 0,
    paddingTop: 4,
};

// ---- Shared Lobby Styles (same layout for all modes) ----

const lobbyStyles: Record<string, React.CSSProperties> = {
    page: {
        display:             'grid',
        gridTemplateColumns: 'auto 1fr',
        gridTemplateRows:    '1fr auto',
        width:               '100%',
        height:              '100%',
        columnGap:           '32px',
        padding:             '24px 32px',
        boxSizing:           'border-box',
        overflow:            'hidden',
    },
    leftTop: {
        display:       'flex',
        flexDirection: 'column',
        minHeight:     0,
        overflow:      'visible', // must not clip — Compi pokes outside the help button's box below
        gridRow:       '1 / 3', // spans both rows so the help button sits right under the canvas, independent of the right column's height
    },
    leftTopPreview: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '12px',
        flexShrink:    0,
    },
    leftTopHelpSlot: {
        flex:           1,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      0,
    },
    rightTop: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '16px',
        minWidth:      0,
        minHeight:     0,
        overflow:      'hidden',
    },
    rightBottom: {
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px 0 0',
    },
    brand: {
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        gap:           '8px',
        paddingBottom: '12px',
        borderBottom:  '1px solid rgba(255,255,255,0.07)',
    },
    brandLogo: {
        width:          '48px',
        height:         '48px',
        borderRadius:   '12px',
        background:     'rgba(79, 195, 247, 0.12)',
        border:         '1px solid rgba(79, 195, 247, 0.25)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '15px',
        fontWeight:     700,
        letterSpacing:  '0.05em',
        color:          '#4fc3f7',
        fontFamily:     'var(--font-mono)',
    },
    brandName: {
        fontSize:      '11px',
        fontWeight:    600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        color:         'rgba(255,255,255,0.28)',
        textAlign:     'center' as const,
        fontFamily:    'var(--font-mono)',
    },
    previewLabel: {
        fontSize:      '11px',
        color:         'rgba(255,255,255,0.25)',
        textAlign:     'center',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily:    'var(--font-mono)',
    },
    header: {
        display:       'flex',
        flexDirection: 'column',
        gap:           '8px',
    },
    title: {
        fontFamily: 'var(--font-mono)',
        fontSize:   '26px',
        fontWeight: 600,
        color:      'rgba(255,255,255,0.9)',
        margin:     0,
    },
    description: {
        fontFamily:  'var(--font)',
        fontSize:    '14px',
        color:       'rgba(255,255,255,0.5)',
        lineHeight:  1.55,
        margin:      0,
    },
};

// ---- Top Bar (lobby modes only) ----

function TopBar({ onBack }: { onBack: () => void }) {
    return (
        <div style={topBarStyles.bar}>
            <div style={topBarStyles.side}>
                <button className="btn btn--ghost btn--sm" onClick={onBack}>
                    ← Mode
                </button>
            </div>

            <div style={topBarStyles.center} />

            <div style={{ ...topBarStyles.side, justifyContent: 'flex-end' }}>
                <HintToggle />
            </div>
        </div>
    );
}

const topBarStyles: Record<string, React.CSSProperties> = {
    bar: {
        width:          '100%',
        height:         56,
        flexShrink:     0,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '0 16px',
        boxSizing:      'border-box',
        background:     'rgba(0,0,0,0.35)',
        borderBottom:   '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(8px)',
    },
    side: {
        display:    'flex',
        alignItems: 'center',
        minWidth:   120,
    },
    center: {
        display:    'flex',
        alignItems: 'center',
        gap:        10,
    },
    logoMark: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      11,
        fontWeight:    700,
        letterSpacing: '0.06em',
        color:         '#4fc3f7',
        background:    'rgba(79,195,247,0.12)',
        border:        '1px solid rgba(79,195,247,0.22)',
        borderRadius:  6,
        padding:       '2px 7px',
    },
    centerTitle: {
        fontFamily:    '"JetBrains Mono", monospace',
        fontSize:      13,
        fontWeight:    600,
        letterSpacing: '0.08em',
        color:         'rgba(255,255,255,0.55)',
        textTransform: 'uppercase',
    },
};

// ---- Root ----

function ShooterLobbyContent() {
    const location = useLocation();
    const locationState = location.state as { mode?: LobbyMode; hordeTab?: HordeTab } | null;
    const initialMode = locationState?.mode ?? null;
    const [mode, setMode] = useState<LobbyMode | null>(initialMode);
    const navigate = useNavigate();
    const isMobile = useMobile();

    if (mode === null) {
        return (
            <GameModeSelectorLayout
                title="SHOOTER VS EA"
                subtitle="Choose your game mode"
                logoText="SG"
                modes={SHOOTER_MODES}
                onSelect={(id) => setMode(id as LobbyMode)}
                onBack={() => navigate('/dashboard')}
                backLabel="← Dashboard"
                rightContent={<HintToggle />}
            />
        );
    }

    return (
        <PageContainer>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                <TopBar onBack={() => setMode(null)} />
                <div style={{ flex: 1, minHeight: 0, overflow: isMobile ? 'auto' : 'hidden' }}>
                    {mode === 'normal'   && <NormalLobby />}
                    {mode === 'raidboss' && <RaidbossLobby />}
                    {mode === 'horde'    && <HordeLobby initialTab={locationState?.hordeTab} />}
                </div>
            </div>
        </PageContainer>
    );
}

export default function ShooterLobbyPage() {
    return (
        <HintsProvider>
            <ShooterLobbyContent />
            <HintLayer />
        </HintsProvider>
    );
}
