import { useNavigate } from 'react-router-dom';
import { useScaledCanvas } from '../hooks/useScaledCanvas';
import { ARENA } from '../modules/shooterGame/shooter.types';
import { LAYOUT, GameLayout } from '../components/layout/GameLayout';
import { ShooterLeftBar } from '../components/layout/ShooterLeftBar';
import { ShooterCanvas } from '../modules/shooterGame/components/ShooterCanvas';
import { DNADisplay } from '../modules/shooterGame/components/dnaDisplay';
import PageContainer from '../components/layout/PageContainer';

export default function ShooterGamePage() {
    const navigate = useNavigate();

    const { containerRef, scale } = useScaledCanvas({
        baseWidth:    ARENA.WIDTH,
        baseHeight:   ARENA.HEIGHT,
        sidebarWidth: LAYOUT.LEFT_BAR + LAYOUT.RIGHT_PANEL + LAYOUT.SPACING * 2,
    });

    return (
        <PageContainer>
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
            >
                <GameLayout
                    leftBar={
                        <ShooterLeftBar
                            onAnalytics={() => navigate('/Analytics')}
                        />
                    }
                    sidebar={<DNADisplay />}
                >
                    <ShooterCanvas scale={scale} />
                </GameLayout>
            </div>
        </PageContainer>
    );
}