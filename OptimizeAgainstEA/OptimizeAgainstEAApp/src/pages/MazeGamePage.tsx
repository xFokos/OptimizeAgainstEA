import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MazeVsEAMode } from '../modules/mazeGame/components/vs-ea/MazeVsEAMode';
import { MazePlayMode } from '../modules/mazeGame/components/play/MazePlayMode';

type MazeMode = 'select' | 'play' | 'vs-ea';

const cardBtn: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'rgba(255,255,255,0.05)', color: '#e8eaf0',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
  padding: '18px 20px', marginBottom: 14, cursor: 'pointer',
};

export default function MazeGamePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MazeMode>('select');

  return (
    <div style={{ minHeight: '100vh', background: '#0a0b10', color: '#e8eaf0' }}>
      {mode === 'select' && (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: 48 }}>
          <h1 style={{ marginTop: 0 }}>Maze Game</h1>
          <p style={{ opacity: 0.75, lineHeight: 1.5, marginBottom: 28 }}>
            A teaching exhibit for evolutionary algorithms. Explore a maze blind by hand,
            then watch an EA evolve a population of paths to the same goal.
          </p>

          <button style={cardBtn} onClick={() => setMode('play')}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>🕹 Explore blind</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
              Walk the maze yourself with fog-of-war, then peek at how the EA does it.
            </div>
          </button>

          <button style={cardBtn} onClick={() => setMode('vs-ea')}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>🧬 EA exhibit</div>
            <div style={{ opacity: 0.7, fontSize: 13, marginTop: 4 }}>
              Run the evolutionary algorithm, compare fitness functions, dissect a generation.
            </div>
          </button>

          <button style={{ ...cardBtn, marginTop: 8, background: 'transparent' }} onClick={() => navigate('/')}>
            ← Home
          </button>
        </div>
      )}
      {mode === 'play' && <MazePlayMode onBack={() => setMode('select')} />}
      {mode === 'vs-ea' && <MazeVsEAMode onBack={() => setMode('select')} />}
    </div>
  );
}
