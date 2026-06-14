export type GameMode = 'select' | 'create' | 'play' | 'vs-ea';

export type CreateStep = 'place' | 'tune' | 'pick-global' | 'done';

export interface GameSession {
  mode: GameMode;
}
