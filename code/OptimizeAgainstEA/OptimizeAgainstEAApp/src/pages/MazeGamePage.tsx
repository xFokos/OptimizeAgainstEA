import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameModeSelectorLayout } from '../components/layout/GameModeSelectorLayout';
import type { GameMode } from '../components/layout/GameModeSelectorLayout';
import { MazeCreateMode } from '../modules/mazeGame/components/create/MazeCreateMode';
import { MazeExperimentMode } from '../modules/mazeGame/components/experiment/MazeExperimentMode';
import { MazeSetupScreen } from '../modules/mazeGame/components/experiment/MazeSetupScreen';
import { MazePlayMode } from '../modules/mazeGame/components/play/MazePlayMode';
import type { SerializedMaze } from '../modules/mazeGame/types/maze';
import { HintsProvider, HintLayer, HintToggle } from '../components/hints';
import '../modules/mazeGame/styles/MazeGameStyles.css';

type MazeMode = 'select' | 'create' | 'experiment' | 'play';

const MODES: GameMode[] = [
  {
    id: 'create',
    key: 'C',
    label: '🧱 Create',
    sub: 'Design your own maze — draw walls, place the start and the goal.',
  },
  {
    id: 'play',
    key: 'S',
    label: '🕹️ Solve',
    sub: 'You are the EA: hand-write move strings, read the fitness, and thread a fogged maze yourself.',
  },
  {
    id: 'experiment',
    key: 'E',
    label: '🧬 Control the EA',
    sub: 'Watch an EA evolve paths through the maze. Tweak its settings and compare fitness functions.',
  },
];

export default function MazeGamePage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<MazeMode>('select');
  // The creator's latest build — sticky for the session so you can hop back
  // and keep editing.
  const [draftMaze, setDraftMaze] = useState<SerializedMaze | null>(null);
  // The maze the experiment runs on. Null while the setup screen (choose /
  // generate / load) is deciding; entering from the selector always resets it
  // so the player gets the choice, while the creator's handoff skips it.
  const [expMaze, setExpMaze] = useState<SerializedMaze | null>(null);
  // The maze the Solve mode runs on — same setup-screen handoff as experiment.
  const [playMaze, setPlayMaze] = useState<SerializedMaze | null>(null);

  const enterExperiment = () => {
    setExpMaze(null);
    setMode('experiment');
  };

  const enterPlay = () => {
    setPlayMaze(null);
    setMode('play');
  };

  // Keyboard shortcuts on the selector (the C / S / E chips on the cards).
  useEffect(() => {
    if (mode !== 'select') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyC') setMode('create');
      if (e.code === 'KeyS') enterPlay();
      if (e.code === 'KeyE') enterExperiment();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode]);

  let content: ReactNode;
  if (mode === 'create') {
    content = (
      <MazeCreateMode
        initialMaze={draftMaze}
        onBack={() => setMode('select')}
        onExperiment={(maze) => {
          setDraftMaze(maze);
          setExpMaze(maze);
          setMode('experiment');
        }}
      />
    );
  } else if (mode === 'experiment') {
    content = expMaze ? (
      <MazeExperimentMode
        maze={expMaze}
        onBack={() => setMode('select')}
        onEdit={(m) => {
          setDraftMaze(m);
          setMode('create');
        }}
      />
    ) : (
      <MazeSetupScreen
        onBack={() => setMode('select')}
        onStart={setExpMaze}
      />
    );
  } else if (mode === 'play') {
    content = playMaze ? (
      <MazePlayMode
        maze={playMaze}
        onBack={() => setMode('select')}
        onNewMaze={() => setPlayMaze(null)}
      />
    ) : (
      <MazeSetupScreen
        icon="🕹️"
        title="Solve"
        onBack={() => setMode('select')}
        onStart={setPlayMaze}
      />
    );
  } else {
    content = (
      <GameModeSelectorLayout
        title="MAZE EXPLORER"
        subtitle="Build a maze, then watch an evolutionary algorithm learn to thread it."
        logoText="ML"
        modes={MODES}
        onSelect={(id) => {
          if (id === 'experiment') enterExperiment();
          else if (id === 'play') enterPlay();
          else setMode(id as MazeMode);
        }}
        onBack={() => navigate('/Dashboard')}
        backLabel="← Back"
        rightContent={<div className="maze-menu-hint"><HintToggle /></div>}
      />
    );
  }

  return (
    <HintsProvider>
      {content}
      <HintLayer />
    </HintsProvider>
  );
}
