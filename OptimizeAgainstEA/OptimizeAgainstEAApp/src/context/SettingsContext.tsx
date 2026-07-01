import { createContext, useContext, useState, type ReactNode } from 'react';
import { STARTER_DNA, DNA_LENGTH, GAME_CONFIG, type PlayerStats } from '../modules/shooterGame/shooter.types';

// ---- Allgemeine EA Settings (spielübergreifend) ----
export interface EASettings {
    mutationRate:           number;                      // 0–0.5
    mutationStrength:       number;                      // 0–0.5
    presimGenerations:      number;                      // 0–10
    populationSize:         number;                      // 5–50
    crossoverType:          'uniform' | 'single-point';  // Gen-Mischmethode
    useHallOfFame:          boolean;                     // Beste Spieler-Runde als Extra-Trainingsdruck
    maxAnalyticsRounds:     number;                      // Wie viele Runden im Analytics-Store behalten
    injectionDeviation:     number;                      // Max. Abweichung der Diversity-Injections vom besten Individuum (0–1)
}

export const defaultEASettings: EASettings = {
    mutationRate:           0.1,
    mutationStrength:       0.2,
    presimGenerations:      3,
    populationSize:         20,
    crossoverType:          'uniform',
    useHallOfFame:          true,
    maxAnalyticsRounds:     20,
    injectionDeviation:     0.3,
};

// ---- Shooter Settings ----
export interface ShooterSettings {
    starterDna:      number[];
    roundDuration:   number;
    tugWinThreshold: number;
    playerStats:     PlayerStats;
}

export const defaultShooterSettings: ShooterSettings = {
    starterDna:      [...STARTER_DNA],
    roundDuration:   20,
    tugWinThreshold: 15,
    playerStats: {
        bulletSpeed:   GAME_CONFIG.BULLET_SPEED,
        moveSpeed:     GAME_CONFIG.PLAYER_SPEED,
        shootCooldown: GAME_CONFIG.SHOOT_COOLDOWN,
    },
};

// ---- Horde Settings ----
export interface HordeSettings {
    starterDna:        number[];
    waveSize:          number;
    wavePauseDuration: number;
}

export const defaultHordeSettings: HordeSettings = {
    starterDna:        [...STARTER_DNA],
    waveSize:          20,
    wavePauseDuration: 3,
};

// ---- Context Type ----
interface SettingsContextType {
    eaSettings:         EASettings;
    setEaSettings:      (s: EASettings) => void;
    shooterSettings:    ShooterSettings;
    setShooterSettings: (s: ShooterSettings) => void;
    hordeSettings:      HordeSettings;
    setHordeSettings:   (s: HordeSettings) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [eaSettings,      setEaSettings]      = useState<EASettings>(defaultEASettings);
    const [shooterSettings, setShooterSettings] = useState<ShooterSettings>(defaultShooterSettings);
    const [hordeSettings,   setHordeSettings]   = useState<HordeSettings>(defaultHordeSettings);

    return (
        <SettingsContext.Provider value={{
            eaSettings,      setEaSettings,
            shooterSettings, setShooterSettings,
            hordeSettings,   setHordeSettings,
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings muss innerhalb von SettingsProvider verwendet werden');
    return ctx;
}

export const resetEASettings      = (): EASettings      => ({ ...defaultEASettings });
export const resetShooterSettings = (): ShooterSettings => ({
    ...defaultShooterSettings,
    starterDna: Array(DNA_LENGTH).fill(0.1),
});
export const resetHordeSettings   = (): HordeSettings   => ({
    ...defaultHordeSettings,
    starterDna: Array(DNA_LENGTH).fill(0.1),
});