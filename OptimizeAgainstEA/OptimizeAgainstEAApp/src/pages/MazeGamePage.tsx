import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameModeSelectorLayout } from '../components/layout/GameModeSelectorLayout';
import type { GameMode } from '../components/layout/GameModeSelectorLayout';
import { MazeCreateMode } from '../modules/mazeGame/components/create/MazeCreateMode';
import { MazeExperimentMode } from '../modules/mazeGame/components/experiment/MazeExperimentMode';
import type { SerializedMaze } from '../modules/mazeGame/types/maze';
import '../modules/mazeGame/styles/MazeGameStyles.css';

type MazeMode = 'select' | 'create' | 'experiment';

const MODES: GameMode[] = [
  {
    id: 'create',
    key: 'C',
    label: '🧱 Create',
    sub: 'Design your own maze — paint walls, place the start and the goal.',
  },
  {
    id: 'experiment',
    key: 'E',
    label: '🧬 Experiment',
    sub: 'Watch an EA evolve paths through the maze. Tweak its settings and compare fitness functions.',
  },
];

export default function MazeGamePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MazeMode>('select');
  // Maze handed from the creator to the experiment. Sticky for the session so
  // you can hop between modes; the experiment offers "use random" to drop it.
  const [customMaze, setCustomMaze] = useState<SerializedMaze | null>(null);

  // Keyboard shortcuts on the selector (the C / E chips on the cards).
  useEffect(() => {
    if (mode !== 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setMode('create');
      if (e.code === 'KeyE') setMode('experiment');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  if (mode === 'create') {
    return (
      <MazeCreateMode
        initialMaze={customMaze}
        onBack={() => setMode('select')}
        onExperiment={(maze) => { setCustomMaze(maze); setMode('experiment'); }}
      />
    );
  }

  if (mode === 'experiment') {
    return (
      <MazeExperimentMode
        maze={customMaze}
        onBack={() => setMode('select')}
        onClearMaze={() => setCustomMaze(null)}
      />
    );
  }

  return (
    <GameModeSelectorLayout
      title="MAZE LAB"
      subtitle="Build a maze, then watch an evolutionary algorithm learn to thread it."
      logoText="ML"
      modes={MODES}
      onSelect={(id) => setMode(id as MazeMode)}
      onBack={() => navigate('/Dashboard')}
      backLabel="← Back"
    />
  );
}
