import type {
    EAConfig,
    EAPreset,
    SelectionStrategy,
    CrossoverStrategy,
    MutationStrategy,
} from '../../../types/ea';
import { EA_PRESETS } from '../../../types/ea';
import { HintPopover } from '../../../../../components/hints';
import { SliderRow, SelectRow, Divider } from '../../../../../components/settings/eaControls';

interface EASettingsPanelProps {
    config: EAConfig;
    revealRadius: number;
    onConfigChange: (patch: Partial<EAConfig>) => void;
    onRevealRadiusChange: (r: number) => void;
    onClose: () => void;
}

// True when the live settings exactly match a preset (so we can light it up).
function matchesPreset(
    preset: EAPreset, config: EAConfig, revealRadius: number,
): boolean {
    if (Math.abs(preset.revealRadius - revealRadius) > 1e-9) return false;
    return (Object.keys(preset.config) as (keyof typeof preset.config)[])
        .every((k) => preset.config[k] === config[k]);
}

function PresetsPanel({
    config, revealRadius, onApply,
}: {
    config: EAConfig; revealRadius: number;
    onApply: (preset: EAPreset) => void;
}) {
    const activeId = EA_PRESETS.find(
        (p) => matchesPreset(p, config, revealRadius),
    )?.id ?? null;

    return (
        <div className="ea-presets-panel" onClick={(e) => e.stopPropagation()}>
            <div className="ea-settings-panel__header">
                <span className="ea-settings-panel__title">Presets</span>
            </div>
            <div className="ea-presets-panel__body">
                {EA_PRESETS.map((p) => (
                    <button
                        key={p.id}
                        className={`btn ea-preset-btn ${activeId === p.id ? 'btn--active' : 'btn--ghost'}`}
                        onClick={() => onApply(p)}
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────

export function EASettingsPanel({
                                    config,
                                    revealRadius,
                                    onConfigChange,
                                    onRevealRadiusChange,
                                    onClose,
                                }: EASettingsPanelProps) {
    const set = (patch: Partial<EAConfig>) => onConfigChange(patch);
    const fmt = (decimals: number) => (v: number) => v.toFixed(decimals);
    const fmtInt = (v: number) => String(Math.round(v));
    const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

    // Applying a preset sets the EA config plus the probe reveal radius at once.
    const applyPreset = (preset: EAPreset) => {
        onConfigChange(preset.config);
        onRevealRadiusChange(preset.revealRadius);
    };

    return (
        <div
            className="ea-settings-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <PresetsPanel
            config={config}
            revealRadius={revealRadius}
            onApply={applyPreset}
          />
          <HintPopover id="vsEa.settingsPanel" placement="left">
            <div className="ea-settings-panel" onClick={(e) => e.stopPropagation()}>

                <div className="ea-settings-panel__header">
                    <span className="ea-settings-panel__title">EA Settings</span>
                    <button className="ea-settings-panel__close" onClick={onClose}>✕</button>
                </div>

                <div className="ea-settings-panel__body">

                    <Divider label="Competition" />

                    <SliderRow
                        label="Population in win radius to solve"
                        value={config.winPopulationFraction}
                        min={0.05} max={1.0} step={0.05}
                        format={fmtPct}
                        onChange={(v) => set({ winPopulationFraction: v })}
                    />

                    <SliderRow
                        label="Probe reveal radius"
                        value={revealRadius}
                        min={0.01} max={0.5} step={0.01}
                        format={fmt(2)}
                        onChange={onRevealRadiusChange}
                    />

                    <Divider label="Population" />

                    <SliderRow
                        label="Population size"
                        value={config.populationSize}
                        min={5} max={200} step={5}
                        format={fmtInt}
                        onChange={(v) => set({ populationSize: Math.round(v) })}
                    />

                    <Divider label="Operators" />

                    <SelectRow<SelectionStrategy>
                        label="Selection strategy"
                        value={config.selectionStrategy}
                        options={[
                            { value: 'tournament', label: 'Tournament — pick best of k random' },
                            { value: 'roulette',   label: 'Roulette — fitness-proportionate' },
                            { value: 'elitist',    label: 'Elitist — top 20% only' },
                        ]}
                        onChange={(v) => set({ selectionStrategy: v })}
                    />

                    <SelectRow<CrossoverStrategy>
                        label="Crossover strategy"
                        value={config.crossoverStrategy}
                        options={[
                            { value: 'arithmetic',  label: 'Arithmetic — weighted average' },
                            { value: 'uniform',     label: 'Uniform — gene-by-gene coin flip' },
                            { value: 'singlePoint', label: 'Single point — split at x or y' },
                        ]}
                        onChange={(v) => set({ crossoverStrategy: v })}
                    />

                    <SelectRow<MutationStrategy>
                        label="Mutation strategy"
                        value={config.mutationStrategy}
                        options={[
                            { value: 'gaussian', label: 'Gaussian — normal distribution' },
                            { value: 'uniform',  label: 'Uniform — flat random perturbation' },
                            { value: 'cauchy',   label: 'Cauchy — heavy-tailed, escapes traps' },
                        ]}
                        onChange={(v) => set({ mutationStrategy: v })}
                    />

                    <Divider label="Rates" />

                    <SliderRow
                        label="Crossover rate"
                        value={config.crossoverRate}
                        min={0} max={1} step={0.05}
                        format={fmt(2)}
                        onChange={(v) => set({ crossoverRate: v })}
                    />

                    <SliderRow
                        label="Mutation rate"
                        value={config.mutationRate}
                        min={0} max={1} step={0.05}
                        format={fmt(2)}
                        onChange={(v) => set({ mutationRate: v })}
                    />

                    <Divider label="Mutation strength" />

                    <SliderRow
                        label="Initial strength"
                        value={config.mutationStrength}
                        min={0.01} max={1.0} step={0.01}
                        format={fmt(2)}
                        onChange={(v) => set({ mutationStrength: v })}
                    />

                    <SliderRow
                        label="Decay per generation"
                        value={config.mutationDecay}
                        min={0} max={1.0} step={0.005}
                        format={fmt(3)}
                        onChange={(v) => set({ mutationDecay: v })}
                    />

                </div>
            </div>
          </HintPopover>
        </div>
    );
}