import type {
  EAConfig, SelectionStrategy, CrossoverStrategy, MutationStrategy,
} from '../../types/ea';
import { panel, lbl, select, settingRow, settingHeader, settingValue, slider, divider } from '../shared/mazeStyles';

interface MazeEASettingsPanelProps {
  config: EAConfig;
  onConfigChange: (patch: Partial<EAConfig>) => void;
}

function SliderRow({
  label, value, min, max, step, format, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={settingRow}>
      <div style={settingHeader}>
        <span style={{ opacity: 0.8 }}>{label}</span>
        <span style={settingValue}>{format(value)}</span>
      </div>
      <input
        type="range" className="slider" style={slider}
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function SelectRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div style={settingRow}>
      <label style={lbl}>{label}</label>
      <select style={select} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

const fmtInt = (v: number) => String(Math.round(v));
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
const fmt2 = (v: number) => v.toFixed(2);

/**
 * Editors for the maze EA's EAConfig. Self-contained (inline-styled) so it does
 * not depend on BattleShips' CSS. Note: maze `mutationStrength` is a per-gene
 * re-pick probability, not a perturbation magnitude — labelled accordingly.
 */
export function MazeEASettingsPanel({ config, onConfigChange }: MazeEASettingsPanelProps) {
  const set = (patch: Partial<EAConfig>) => onConfigChange(patch);

  return (
    <div style={panel}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>EA settings</div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
        Changing a setting restarts the run on the same maze.
      </div>

      <div style={divider}>Population</div>
      <SliderRow
        label="Population size" value={config.populationSize}
        min={10} max={300} step={10} format={fmtInt}
        onChange={(v) => set({ populationSize: Math.round(v) })}
      />
      <SliderRow
        label="Max generations" value={config.maxGenerations}
        min={50} max={1000} step={50} format={fmtInt}
        onChange={(v) => set({ maxGenerations: Math.round(v) })}
      />
      <SliderRow
        label="Win fraction (paths at goal)" value={config.winPopulationFraction}
        min={0.02} max={0.5} step={0.02} format={fmtPct}
        onChange={(v) => set({ winPopulationFraction: v })}
      />

      <div style={divider}>Operators</div>
      <SelectRow<SelectionStrategy>
        label="Selection" value={config.selectionStrategy}
        options={[
          { value: 'tournament', label: 'Tournament — best of k random' },
          { value: 'roulette', label: 'Roulette — fitness-proportionate' },
          { value: 'elitist', label: 'Elitist — top 20% only' },
        ]}
        onChange={(v) => set({ selectionStrategy: v })}
      />
      <SelectRow<CrossoverStrategy>
        label="Crossover" value={config.crossoverStrategy}
        options={[
          { value: 'singlePoint', label: 'Single point — splice at one cut' },
          { value: 'uniform', label: 'Uniform — per-move coin flip' },
        ]}
        onChange={(v) => set({ crossoverStrategy: v })}
      />
      <SelectRow<MutationStrategy>
        label="Mutation" value={config.mutationStrategy}
        options={[
          { value: 'point', label: 'Point — re-pick individual moves' },
          { value: 'segment', label: 'Segment — re-pick a contiguous block' },
        ]}
        onChange={(v) => set({ mutationStrategy: v })}
      />

      <div style={divider}>Rates</div>
      <SliderRow
        label="Crossover rate" value={config.crossoverRate}
        min={0} max={1} step={0.05} format={fmt2}
        onChange={(v) => set({ crossoverRate: v })}
      />
      <SliderRow
        label="Mutation rate" value={config.mutationRate}
        min={0} max={1} step={0.05} format={fmt2}
        onChange={(v) => set({ mutationRate: v })}
      />
      <SliderRow
        label="Mutation strength (per-move flip prob.)" value={config.mutationStrength}
        min={0.01} max={0.5} step={0.01} format={fmt2}
        onChange={(v) => set({ mutationStrength: v })}
      />
      <SliderRow
        label="Mutation decay / generation" value={config.mutationDecay}
        min={0.9} max={1} step={0.005} format={(v) => v.toFixed(3)}
        onChange={(v) => set({ mutationDecay: v })}
      />
    </div>
  );
}
