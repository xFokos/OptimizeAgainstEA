import type {
    EAConfig,
    SelectionStrategy,
    CrossoverStrategy,
    MutationStrategy,
} from '../../../types/ea';
import { HintPopover } from '../../../hints/HintPopover';

interface EASettingsPanelProps {
    config: EAConfig;
    gensPerProbe: number;
    onConfigChange: (patch: Partial<EAConfig>) => void;
    onGensPerProbeChange: (n: number) => void;
    onClose: () => void;
}

// ── Small reusable input atoms ────────────────────────────────────────────

function SliderRow({
                       label, value, min, max, step, format, onChange,
                   }: {
    label: string; value: number; min: number; max: number;
    step: number; format: (v: number) => string;
    onChange: (v: number) => void;
}) {
    return (
        <div className="ea-setting">
            <div className="ea-setting__header">
                <span className="ea-setting__label">{label}</span>
                <span className="ea-setting__value">{format(value)}</span>
            </div>
            <input
                type="range"
                className="ea-slider"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
            />
            <div className="ea-setting__range">
                <span>{format(min)}</span>
                <span>{format(max)}</span>
            </div>
        </div>
    );
}

function SelectRow<T extends string>({
                                         label, value, options, onChange,
                                     }: {
    label: string; value: T;
    options: { value: T; label: string }[];
    onChange: (v: T) => void;
}) {
    return (
        <div className="ea-setting">
            <div className="ea-setting__header">
                <span className="ea-setting__label">{label}</span>
            </div>
            <select
                className="ea-select"
                value={value}
                onChange={(e) => onChange(e.target.value as T)}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

function Divider({ label }: { label: string }) {
    return <div className="ea-divider">{label}</div>;
}

// ── Main panel ────────────────────────────────────────────────────────────

export function EASettingsPanel({
                                    config,
                                    gensPerProbe,
                                    onConfigChange,
                                    onGensPerProbeChange,
                                    onClose,
                                }: EASettingsPanelProps) {
    const set = (patch: Partial<EAConfig>) => onConfigChange(patch);
    const fmt = (decimals: number) => (v: number) => v.toFixed(decimals);
    const fmtInt = (v: number) => String(Math.round(v));

    return (
        <div
            className="ea-settings-backdrop"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <HintPopover id="vsEa.settingsPanel" placement="left">
            <div className="ea-settings-panel" onClick={(e) => e.stopPropagation()}>

                <div className="ea-settings-panel__header">
                    <span className="ea-settings-panel__title">EA Settings</span>
                    <button className="ea-settings-panel__close" onClick={onClose}>✕</button>
                </div>

                <div className="ea-settings-panel__body">

                    <Divider label="Competition" />

                    <SliderRow
                        label="EA generations per probe"
                        value={gensPerProbe}
                        min={1} max={20} step={1}
                        format={fmtInt}
                        onChange={onGensPerProbeChange}
                    />

                    <Divider label="Population" />

                    <SliderRow
                        label="Population size"
                        value={config.populationSize}
                        min={5} max={200} step={5}
                        format={fmtInt}
                        onChange={(v) => set({ populationSize: Math.round(v) })}
                    />

                    <SliderRow
                        label="Max generations"
                        value={config.maxGenerations}
                        min={10} max={1000} step={10}
                        format={fmtInt}
                        onChange={(v) => set({ maxGenerations: Math.round(v) })}
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
                        min={0.01} max={0.5} step={0.01}
                        format={fmt(2)}
                        onChange={(v) => set({ mutationStrength: v })}
                    />

                    <SliderRow
                        label="Decay per generation"
                        value={config.mutationDecay}
                        min={0.8} max={1.0} step={0.005}
                        format={fmt(3)}
                        onChange={(v) => set({ mutationDecay: v })}
                    />

                </div>
            </div>
          </HintPopover>
        </div>
    );
}