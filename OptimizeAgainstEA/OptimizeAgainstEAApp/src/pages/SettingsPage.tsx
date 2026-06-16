import { useState } from 'react';
import PageContainer from '../components/layout/PageContainer';
import { EASettingsPanel } from '../components/settings/EASettings';
import { ShooterSettingsPanel } from '../modules/shooterGame/settings/ShooterSettings';


type GameTab = 'shooter' | 'horde';

const TABS: { id: GameTab; label: string; color: string }[] = [
    { id: 'shooter', label: 'Shooter', color: '#4fc3f7' },
    { id: 'horde',   label: 'Horde',   color: '#ef5350' },
];

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<GameTab>('shooter');

    return (
        <PageContainer>
            <div style={styles.page}>
                <h1 style={styles.title}>Einstellungen</h1>

                {/* Allgemeine EA Settings – immer sichtbar */}
                <EASettingsPanel />

                {/* Divider */}
                <div style={styles.divider}>
                    <span style={styles.dividerText}>Spiel-spezifische Einstellungen</span>
                </div>

                {/* Tabs */}
                <div style={styles.tabs}>
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                ...styles.tab,
                                background:  activeTab === tab.id ? `${tab.color}18` : 'transparent',
                                border:      `1px solid ${activeTab === tab.id ? tab.color : 'rgba(255,255,255,0.1)'}`,
                                color:       activeTab === tab.id ? tab.color : 'rgba(255,255,255,0.4)',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Spiel-spezifischer Content */}
                {activeTab === 'shooter' && <ShooterSettingsPanel />}

            </div>
        </PageContainer>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        width:     '100%',
        maxWidth:  '680px',
        margin:    '0 auto',
        padding:   '32px 16px',
        overflowY: 'auto',
        height:    '100%',
        boxSizing: 'border-box',
        color:     '#fff',
        fontFamily: 'monospace',
    },
    title: {
        fontSize:     '20px',
        fontWeight:   500,
        color:        'rgba(255,255,255,0.85)',
        marginBottom: '24px',
        margin:       '0 0 24px 0',
    },
    divider: {
        display:      'flex',
        alignItems:   'center',
        gap:          '12px',
        margin:       '24px 0 16px 0',
    },
    dividerText: {
        fontSize:      '11px',
        color:         'rgba(255,255,255,0.25)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        whiteSpace:    'nowrap',
    },
    tabs: {
        display:      'flex',
        gap:          '8px',
        marginBottom: '16px',
    },
    tab: {
        padding:      '8px 20px',
        borderRadius: '6px',
        cursor:       'pointer',
        fontFamily:   'monospace',
        fontSize:     '13px',
        letterSpacing: '0.06em',
        transition:   'all 0.15s',
    },
};