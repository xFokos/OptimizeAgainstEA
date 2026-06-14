import { useState } from 'react';
import type {GameMode} from "../modules/BattleShips/types/game.ts";
import { ModeSelector } from '../modules/BattleShips/components/game/shared/ModeSelector';
import { CreateMode } from '../modules/BattleShips/components/game/create/CreateMode';
import { PlayMode } from '../modules/BattleShips/components/game/play/PlayMode';
import {VsEAMode} from "../modules/BattleShips/components/game/vs-ea/VsEAMode.tsx";
import '../modules/BattleShips/styles/BattleShipsStyles.css';

export default function BattleShipsPage() {
    const [mode, setMode] = useState<GameMode>('select');
    const [pendingCode, setPendingCode] = useState<string | null>(null);

    const goToMode = (m: GameMode, code?: string) => {
        setPendingCode(code ?? null);
        setMode(m);
    };
    const backToSelect = () => goToMode('select');

  return (
    <div className="app">
      {mode === 'select' && <ModeSelector onSelect={(m) => goToMode(m)} />}
      {mode === 'create' && <CreateMode onBack={backToSelect} onUseMap={goToMode} />}
      {mode === 'play'   && <PlayMode   onBack={backToSelect} initialCode={pendingCode ?? undefined} />}
      {mode === 'vs-ea'  && <VsEAMode   onBack={backToSelect} initialCode={pendingCode ?? undefined} />}
    </div>
  );

}
