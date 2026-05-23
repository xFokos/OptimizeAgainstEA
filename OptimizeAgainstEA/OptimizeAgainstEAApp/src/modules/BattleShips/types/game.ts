export type GameMode = 'select' | 'create' | 'play' | 'vs-ea';

export type CreateStep = 'place' | 'pick-global' | 'done';

export interface GameSession {
  mode: GameMode;
}