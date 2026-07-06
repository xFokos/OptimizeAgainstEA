// Content registry for the site-wide Help system. Add a new entry here and
// point a <HelpButton topic="..." /> at its key — no other wiring needed.

export interface HelpSection {
  heading: string;
  body:    string[]; // one string per paragraph
}

export interface HelpTopic {
  title:     string;
  gameplay:  HelpSection[];
  technical: HelpSection[];
}

export const HELP_TOPICS = {
  'shooter.solo': {
    title: 'Solo Play — How it works',
    gameplay: [
      {
        heading: 'Objective',
        body: [
          'You face a single AI-controlled agent in a top-down duel. Move with WASD or the arrow keys, aim with the mouse, and shoot with left click or Space.',
          'A round lasts 20 seconds. Land more hits than you take before the timer runs out to win the round.',
        ],
      },
      {
        heading: 'Rounds & evolution',
        body: [
          'After every round, the opponent evolves based on how it performed against you — it gets a little better at countering your playstyle each time.',
          'Sliding a DNA gene mid-round (or resetting) restarts the opponent\'s learning from that new baseline.',
        ],
      },
      {
        heading: 'Difficulty presets',
        body: [
          'Easy, Medium and Hard change the opponent\'s starting DNA and how many generations it "pre-trains" internally before your first round even begins — Hard opponents have already fought 3 simulated generations before you meet them.',
        ],
      },
    ],
    technical: [
      {
        heading: 'DNA — what makes an agent',
        body: [
          'Each opponent is defined by an 8-gene DNA vector, every gene a number between 0 and 1: aggression (how hard it chases you), dodge weight, shoot accuracy, preferred combat range, movement speed, predictive aim lead, fire rate, and bullet speed.',
          'These genes directly drive the steering forces and firing logic in the simulation — there is no hidden neural network, the DNA numbers are the behavior.',
        ],
      },
      {
        heading: 'The genetic algorithm',
        body: [
          'Between rounds, a small population evolves via tournament selection, uniform crossover between two parents, and per-gene random mutation.',
          'Fitness rewards net hits (hits landed minus hits taken), with a bonus for winning outright — so the population drifts toward whatever behavior beat you last time.',
          'The top individuals (elites) survive unchanged into the next generation, guaranteeing progress is never lost.',
        ],
      },
      {
        heading: 'Pre-simulation',
        body: [
          'Before you ever play, harder presets run several generations of round-robin fights — every individual in the population fights every other — entirely in simulation, so the opponent already has a baseline strategy on round 1.',
          'During real rounds, your movement and shots are recorded as a "ghost". The algorithm can replay that ghost to test candidate opponents against your exact playstyle without needing you to play again.',
        ],
      },
    ],
  },

  'shooter.raidboss': {
    title: 'Community Raidboss — How it works',
    gameplay: [
      {
        heading: 'Objective',
        body: [
          'One shared boss population is trained by every player on the server. When you click "Fight Raidboss", you\'re matched against the next individual in that population that nobody has evaluated yet.',
          'Controls are the same as Solo Play: WASD/arrows to move, mouse to aim, left click or Space to shoot.',
        ],
      },
      {
        heading: 'Shared progress',
        body: [
          'Your fight result is recorded against that individual. Once every individual in the current generation has been fought by someone, the whole population evolves to the next generation automatically — for everyone.',
          'This means the boss you fight today may be noticeably tougher than the one players fought yesterday.',
        ],
      },
    ],
    technical: [
      {
        heading: 'Distributed evaluation',
        body: [
          'A genetic algorithm normally needs every individual\'s fitness before it can evolve a new generation. Here, that evaluation step is spread across many players instead of one machine simulating it — each player\'s round is one fitness sample.',
        ],
      },
      {
        heading: 'Raidboss fitness',
        body: [
          'Fitness combines net hits (as in Solo Play) with a survival bonus — a boss that stays alive for more of the round scores higher even if the fight is close, rewarding agents that hold their ground under pressure rather than trading hits recklessly.',
        ],
      },
    ],
  },

  'shooter.horde': {
    title: 'Horde Mode — How it works',
    gameplay: [
      {
        heading: 'Objective',
        body: [
          'Survive endless waves of agents spawning from the edges of the map. Move with WASD/arrows, aim with the mouse, shoot with left click or Space. There is no round timer — the game ends when you die.',
        ],
      },
      {
        heading: 'Maps & obstacles',
        body: [
          'Each map defines which edges agents can spawn from and where cover blocks live. Solid-bordered obstacles block bullets too; dashed-bordered ones only block movement.',
          'The Map tab lets you pick a built-in layout or build your own in the Map Editor.',
        ],
      },
      {
        heading: 'Difficulty',
        body: [
          'The Algorithm tab controls how aggressively the horde\'s population evolves and how many agents are on the field at once — more concurrent agents and faster mutation both raise the pressure.',
        ],
      },
    ],
    technical: [
      {
        heading: 'A living population, not scripted waves',
        body: [
          'There\'s no hand-authored wave list. A fixed-size population of agents is kept on the field at all times; when you kill one, its slot respawns from the evolving population rather than a preset list.',
          'An agent\'s fitness is based on how long it survived and how close it got to you before dying — agents that pressured you effectively are more likely to pass their DNA on.',
        ],
      },
      {
        heading: 'Elites & continuity',
        body: [
          'A handful of top performers (elites) are reincarnated with unchanged DNA when they die, and their fitness is smoothed across each of their lives — so a genuinely strong strategy isn\'t discarded just because of one unlucky death.',
        ],
      },
      {
        heading: 'Pathfinding around obstacles',
        body: [
          'Agents navigate maps with a flow-field: the map is divided into a grid, and a breadth-first search from your position gives every cell a direction pointing toward you. Agents follow that field instead of the direct straight-line chase used in Solo Play, so they path around walls instead of getting stuck on them.',
        ],
      },
    ],
  },
} as const;

export type HelpTopicId = keyof typeof HELP_TOPICS;
