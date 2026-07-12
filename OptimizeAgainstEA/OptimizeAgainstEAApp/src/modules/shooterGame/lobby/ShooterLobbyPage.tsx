import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PageContainer from '../../../components/layout/PageContainer';
import { GameModeSelectorLayout } from '../../../components/layout/GameModeSelectorLayout';
import { HintsProvider, HintToggle, HintLayer } from '../../../components/hints';
import { useMobile } from './lobbyHooks';
import { SHOOTER_MODES, type LobbyMode, type HordeTab } from './lobbyConstants';
import { TopBar } from './TopBar';
import { NormalLobby } from './NormalLobby';
import { RaidbossLobby } from './RaidbossLobby';
import { HordeLobby } from './HordeLobby';

// ---- Root ----

function ShooterLobbyContent() {
    const location = useLocation();
    const locationState = location.state as { mode?: LobbyMode; hordeTab?: HordeTab } | null;
    const initialMode = locationState?.mode ?? null;
    const [mode, setMode] = useState<LobbyMode | null>(initialMode);
    const navigate = useNavigate();
    const isMobile = useMobile();

    // react-router's history.state is the browser's, not React's — it survives
    // a hard reload of this same entry (F5 replays whatever `state` a past
    // navigate(..., { state }) call attached to it). Without this, reloading
    // the page while state={mode:'horde'} is attached to the current entry
    // silently re-opens Horde (or whatever mode was last navigated to) again,
    // instead of showing the mode picker a fresh visit to this URL should
    // show. Clearing it via a replace (once, after consuming it into `mode`
    // above) leaves the picker as what a subsequent reload actually sees.
    useEffect(() => {
        if (locationState) navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (mode === null) {
        return (
            <GameModeSelectorLayout
                title="SHOOTER VS EA"
                subtitle="Choose your game mode"
                logoText="SG"
                modes={SHOOTER_MODES}
                onSelect={(id) => setMode(id as LobbyMode)}
                onBack={() => navigate('/dashboard')}
                backLabel="← Dashboard"
                rightContent={<HintToggle />}
            />
        );
    }

    return (
        <PageContainer>
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
                <TopBar onBack={() => setMode(null)} />
                <div style={{ flex: 1, minHeight: 0, overflow: isMobile ? 'auto' : 'hidden' }}>
                    {mode === 'normal'   && <NormalLobby />}
                    {mode === 'raidboss' && <RaidbossLobby />}
                    {mode === 'horde'    && <HordeLobby initialTab={locationState?.hordeTab} />}
                </div>
            </div>
        </PageContainer>
    );
}

export default function ShooterLobbyPage() {
    return (
        <HintsProvider>
            <ShooterLobbyContent />
            <HintLayer />
        </HintsProvider>
    );
}
