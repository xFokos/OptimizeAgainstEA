import { useNavigate } from 'react-router-dom';
import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { ARENA } from '../modules/shooterGame/shooter.types';
import { GameLayout } from '../components/layout/GameLayout';
import { ShooterLeftBar } from '../components/layout/ShooterLeftBar';
import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas';
import { DNADisplay } from '../modules/shooterGame/components/dnaDisplay';
import PageContainer from '../components/layout/PageContainer';

export default function ShooterGamePage() {
    const navigate = useNavigate();

    const { containerRef, scale } = useScaledCanvas({
        baseWidth:  ARENA.WIDTH,
        baseHeight: ARENA.HEIGHT,
    });

    return (
        <PageContainer>
            <GameLayout
                canvasRef={containerRef}
                leftBar={
                    <ShooterLeftBar
                        onAnalytics={() => navigate('/Analytics')}
                    />
                }
                sidebar={<DNADisplay />}
            >
                <ShooterCanvas scale={scale} />
            </GameLayout>
        </PageContainer>
    );
}
