// Content registry for the site-wide Help system. Add a new entry here and
// point a <HelpButton topic="..." /> at its key — no other wiring needed.
//
// Each topic's Gameplay/Technical tab is a small React component (see
// ./topics/*.tsx) built from HelpConceptCard + the visual widgets in
// helpVisuals.tsx — short captions paired with a real visual, instead of
// paragraphs of prose. Kept in their own files (not defined here) so this
// file only exports data, not components — react-refresh/Fast Refresh needs
// a file to be one or the other, not a mix.

import type { ReactNode } from 'react';
import * as SoloHelp from './topics/SoloHelp';
import * as RaidbossHelp from './topics/RaidbossHelp';
import * as HordeHelp from './topics/HordeHelp';

export interface HelpTopic {
    title:     string;
    Gameplay:  () => ReactNode;
    Technical: () => ReactNode;
}

export const HELP_TOPICS = {
    'shooter.solo': {
        title:     'Solo Play — How it works',
        Gameplay:  SoloHelp.Gameplay,
        Technical: SoloHelp.Technical,
    },
    'shooter.raidboss': {
        title:     'Community Raidboss — How it works',
        Gameplay:  RaidbossHelp.Gameplay,
        Technical: RaidbossHelp.Technical,
    },
    'shooter.horde': {
        title:     'Horde Mode — How it works',
        Gameplay:  HordeHelp.Gameplay,
        Technical: HordeHelp.Technical,
    },
} satisfies Record<string, HelpTopic>;

export type HelpTopicId = keyof typeof HELP_TOPICS;
