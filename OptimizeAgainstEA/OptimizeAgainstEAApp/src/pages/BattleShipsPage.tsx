import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {GameMode} from "../modules/BattleShips/types/game.ts";
import { ModeSelector } from '../modules/BattleShips/components/game/shared/ModeSelector';
import { CreateMode } from '../modules/BattleShips/components/game/create/CreateMode';
import { PlayMode } from '../modules/BattleShips/components/game/play/PlayMode';
import {VsEAMode} from "../modules/BattleShips/components/game/vs-ea/VsEAMode.tsx";
import { HintsProvider, HintToggle, HintLayer } from '../components/hints';
import '../modules/BattleShips/styles/BattleShipsStyles.css';

export default function BattleShipsPage() {
    const navigate = useNavigate();
    const [mode, setMode] = useState<GameMode>('select');
    const [pendingCode, setPendingCode] = useState<string | null>(null);

    const goToMode = (m: GameMode, code?: string) => {
        setPendingCode(code ?? null);
        setMode(m);
    };
    const backToSelect = () => goToMode('select');
    // On the selector itself, Home leaves PeakFinder for the website homepage;
    // inside a mode it returns to the selector first.
    const onHome = () => (mode === 'select' ? navigate('/Dashboard') : backToSelect());

  return (
    <HintsProvider>
      <div className="app">
        <header className="peakfinder-topbar">
          <button
            className="btn btn--ghost btn--sm peakfinder-topbar__home"
            onClick={onHome}
          >
            ← Back
          </button>
          <HintToggle />
        </header>
        {mode === 'select' && <ModeSelector onSelect={(m) => goToMode(m)} />}
        {mode === 'create' && <CreateMode onBack={backToSelect} onUseMap={goToMode} />}
        {mode === 'play'   && <PlayMode   onBack={backToSelect} initialCode={pendingCode ?? undefined} />}
        {mode === 'vs-ea'  && <VsEAMode   onBack={backToSelect} initialCode={pendingCode ?? undefined} />}
        <HintLayer />
      </div>
    </HintsProvider>
  );

}
