import { DNA_INDEX, DNA_GENE_INFO } from '../shooter.types';
import type { DnaGeneDescriptor } from '../settings/ShooterSettings';
import { LOOP_STEPS, LOOP_GENE_START, SIZE_GENE_INDEX, OPACITY_GENE_INDEX } from '../horde/hordeDna';

// ---- Mode type ----

export type LobbyMode = 'normal' | 'raidboss' | 'horde';

export const SHOOTER_MODES = [
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
export const PRESETS = [
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

export type PresetId = typeof PRESETS[number]['id'] | 'custom';

// ---- Settings Tabs ----

export const LOBBY_TABS = ['Overview', 'Algorithm', 'DnaRound', 'Player'] as const;
export type LobbyTab = typeof LOBBY_TABS[number];

// Friendlier display text — internal ids stay stable so nothing else needs to change.
export const LOBBY_TAB_LABELS: Record<LobbyTab, string> = {
    Overview: 'Overview',
    Algorithm: 'Algorithm',
    DnaRound:  'DNA & Round',
    Player:    'Player',
};

// ---- Horde Lobby ----

export const HORDE_TABS = ['Overview', 'Algorithm', 'DnaWave', 'Player', 'Map'] as const;
export type HordeTab = typeof HORDE_TABS[number];

// Friendlier display text — internal ids stay stable so nothing else needs to change.
export const HORDE_TAB_LABELS: Record<HordeTab, string> = {
    Overview:  'Overview',
    Algorithm: 'Algorithm',
    DnaWave:   'DNA & Wave',
    Player:    'Player',
    Map:       'Map',
};

// Horde-only difficulty presets — deliberately independent of the Solo Play PRESETS
// above, since HordeSettings no longer shares state with the global EASettings.
export const HORDE_PRESETS = [
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

export type HordePresetId = typeof HORDE_PRESETS[number]['id'] | 'custom';

// Horde agents are melee-only (touch = death, they never shoot) — updateHorde()
// only ever reads these three shared genes (not Fire Rate/Bullet Speed/Accuracy/
// Range/Lead), plus its own Size/Opacity/Movement Loop genes, which have no
// shared DNA_GENE_INFO entry since they're Horde-only concepts.
//
// AGGRESSION is labeled explicitly here instead of via DNA_GENE_INFO.AGGRESSION —
// that shared entry was renamed to 'Pursuit' because the 1v1 Shooter's own
// updateAgent() zeroes the gene out once in range (see shooter.types.ts's comment).
// Horde's wander/chase blend (HordeCanvas.tsx) has no such cutoff and "Aggression"
// genuinely fits it, so it keeps its own label/tooltip here rather than inheriting
// the Shooter-specific rename.
export const HORDE_BAR_GENES: DnaGeneDescriptor[] = [
    { index: DNA_INDEX.AGGRESSION,     label: 'Aggression', tooltip: 'How much the agent overrides careful pathing to rush straight at you instead of wandering.' },
    { index: DNA_INDEX.DODGE_WEIGHT,   label: DNA_GENE_INFO.DODGE_WEIGHT.label,   tooltip: DNA_GENE_INFO.DODGE_WEIGHT.tooltip },
    { index: DNA_INDEX.MOVEMENT_SPEED, label: DNA_GENE_INFO.MOVEMENT_SPEED.label, tooltip: DNA_GENE_INFO.MOVEMENT_SPEED.tooltip },
    { index: SIZE_GENE_INDEX,    label: 'Size',    tooltip: "How large the agent's hitbox is — smaller is genuinely harder to hit." },
    { index: OPACITY_GENE_INDEX, label: 'Opacity', tooltip: 'How visible the agent is — fainter is harder to spot.' },
];

// Movement Loop gets its own degree-badge display in the read-only Overview
// (see HordeOverview), but as plain 0-1 sliders it's just 4 more editable rows here.
export const HORDE_LOOP_GENES: DnaGeneDescriptor[] = Array.from({ length: LOOP_STEPS }, (_, i) => ({
    index:   LOOP_GENE_START + i,
    label:   `Loop Step ${i + 1}`,
    tooltip: 'One step of the evolved movement loop — a steering-rotation offset applied on top of the normal chase/dodge direction.',
}));

export const HORDE_EDITABLE_GENES: DnaGeneDescriptor[] = [...HORDE_BAR_GENES, ...HORDE_LOOP_GENES];
