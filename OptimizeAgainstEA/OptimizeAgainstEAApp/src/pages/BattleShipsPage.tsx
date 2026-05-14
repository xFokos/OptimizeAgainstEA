import { useState } from 'react';
import type {GameMode} from "../modules/BattleShips/types/game";
import { ModeSelector } from '../modules/BattleShips/components/game/shared/ModeSelector';
import { CreateMode } from '../modules/BattleShips/components/game/create/CreateMode';
import { PlayMode } from '../modules/BattleShips/components/game/play/PlayMode';
import '../modules/BattleShips/styles/BattleShipsStyles.css';

export default function BattleShipsPage() {
    const [mode, setMode] = useState<GameMode>('select');

    return (
        <div className="app">
            {mode === 'select' && <ModeSelector onSelect={setMode} />}
            {mode === 'create' && <CreateMode onBack={() => setMode('select')} />}
            {mode === 'play'   && <PlayMode   onBack={() => setMode('select')} />}
            {mode === 'vs-ea'  && (
                <div className="placeholder">
                    <p>Vs EA mode — coming soon</p>
                    <button className="btn btn--ghost" onClick={() => setMode('select')}>← Back</button>
                </div>
            )}
        </div>
    );
}
