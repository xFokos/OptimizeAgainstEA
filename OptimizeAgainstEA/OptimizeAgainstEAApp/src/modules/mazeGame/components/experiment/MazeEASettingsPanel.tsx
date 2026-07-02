import type {
  EAConfig, SelectionStrategy, CrossoverStrategy, MutationStrategy,
} from '../../types/ea';
import { SliderRow, SelectRow, Divider } from '../../../../components/settings/eaControls';

interface MazeEASettingsPanelProps {
  config: EAConfig;
  onConfigChange: (patch: Partial<EAConfig>) => void;
  onClose: () => void;
}

const fmtInt = (v: number) => String(Math.round(v));
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
const fmtFixed = (decimals: number) => (v: number) => v.toFixed(decimals);

/**
 * Editors for the maze EA's EAConfig, presented in the shared settings drawer
 * (styles/specific/EASettingsPanel.css) so it matches the other games. Note:
 * maze `mutationStrength` is a per-gene re-pick probability, not a
 * perturbation magnitude — labelled accordingly.
 */
export function MazeEASettingsPanel({ config, onConfigChange, onClose }: MazeEASettingsPanelProps) {
  const set = onConfigChange;

  return (
    <div
      className="ea-settings-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="ea-settings-panel" onClick={(e) => e.stopPropagation()}>

        <div className="ea-settings-panel__header">
          <span className="ea-settings-panel__title">EA Settings</span>
          <button className="ea-settings-panel__close" onClick={onClose}>✕</button>
        </div>

        <div className="ea-settings-panel__body">
          <p className="maze-note">
            Changing a setting restarts the run on the same maze.
          </p>

          <Divider label="Population" />

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

          <Divider label="Operators" />

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

          <Divider label="Rates" />

          <SliderRow
            label="Crossover rate" value={config.crossoverRate}
            min={0} max={1} step={0.05} format={fmtFixed(2)}
            onChange={(v) => set({ crossoverRate: v })}
          />
          <SliderRow
            label="Mutation rate" value={config.mutationRate}
            min={0} max={1} step={0.05} format={fmtFixed(2)}
            onChange={(v) => set({ mutationRate: v })}
          />
          <SliderRow
            label="Mutation strength (per-move flip prob.)" value={config.mutationStrength}
            min={0.01} max={0.5} step={0.01} format={fmtFixed(2)}
            onChange={(v) => set({ mutationStrength: v })}
          />
          <SliderRow
            label="Mutation decay / generation" value={config.mutationDecay}
            min={0.9} max={1} step={0.005} format={fmtFixed(3)}
            onChange={(v) => set({ mutationDecay: v })}
          />
        </div>
      </div>
    </div>
  );
}
