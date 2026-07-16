// Content registry for the site-wide Help system. Add a new entry here and
// point a <HelpButton topic="..." /> at its key — no other wiring needed.
//
// Each topic is ONE component (see ./topics/*.tsx) built from HelpConceptCard
// + the visual widgets in helpVisuals.tsx — short captions paired with a real
// visual, instead of paragraphs of prose. Kept in their own files (not defined
// here) so this file only exports data, not components — react-refresh/Fast
// Refresh needs a file to be one or the other, not a mix.
//
// Deliberately the general picture only: what the mode is, what you do, and
// that an EA is driving the opponent. Everything below that — the gene list,
// selection/crossover/mutation, pre-simulation — belongs to the mode's
// technical tutorial (the ExplainerFlow behind the modal's "Technical
// Tutorial" button), which explains the same ground with live animations. Two
// tabs used to split this content; the second was a weaker duplicate of that
// tutorial.

import type { ReactNode } from 'react';
import * as SoloHelp from './topics/SoloHelp';
import * as RaidbossHelp from './topics/RaidbossHelp';
import * as HordeHelp from './topics/HordeHelp';

export interface HelpTopic {
    title:   string;
    Content: () => ReactNode;
}

export const HELP_TOPICS = {
    'shooter.solo': {
        title:   'Solo Play — How it works',
        Content: SoloHelp.Content,
    },
    'shooter.raidboss': {
        title:   'Community Raidboss — How it works',
        Content: RaidbossHelp.Content,
    },
    'shooter.horde': {
        title:   'Horde Mode — How it works',
        Content: HordeHelp.Content,
    },
} satisfies Record<string, HelpTopic>;

export type HelpTopicId = keyof typeof HELP_TOPICS;
