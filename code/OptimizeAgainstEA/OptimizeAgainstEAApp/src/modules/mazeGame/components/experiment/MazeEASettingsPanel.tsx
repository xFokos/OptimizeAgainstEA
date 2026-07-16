import type {
  EAConfig, SelectionStrategy, CrossoverStrategy, MutationStrategy,
} from '../../types/ea';
import type { WallRule } from '../../types/maze';
import { MAX_PATH_LENGTH } from '../../engine/mazeProblem';
import { SliderRow, SelectRow, SegmentedRow, Divider } from '../../../../components/settings/eaControls';

interface MazeEASettingsControlsProps {
  config: EAConfig;
  onConfigChange: (patch: Partial<EAConfig>) => void;
  /** Shortest start→goal path of the current maze, for the genome-length preview. */
  shortestPath?: number;
  /**
   * True once the run has started. Genome length is baked into every genome, so
   * it can only be changed before the first generation is bred — while a run is
   * live the length slider is locked.
   */
  runStarted?: boolean;
}

interface MazeEASettingsPanelProps extends MazeEASettingsControlsProps {
  onClose: () => void;
}

const fmtInt = (v: number) => String(Math.round(v));
const fmtPct = (v: number) => `${Math.round(v * 100)}%`;
const fmtFixed = (decimals: number) => (v: number) => v.toFixed(decimals);

/**
 * The EAConfig editors themselves (no drawer chrome), so they can be rendered
 * either inline in a panel or inside the drawer below. Note: maze
 * `mutationStrength` is a per-gene re-pick probability, not a perturbation
 * magnitude — labelled accordingly.
 */
export function MazeEASettingsControls({ config, onConfigChange, shortestPath, runStarted }: MazeEASettingsControlsProps) {
  const set = onConfigChange;

  const fmtGenomeLen = (v: number) =>
    shortestPath && shortestPath > 0
      ? `×${v.toFixed(2)} = ${Math.min(MAX_PATH_LENGTH, Math.ceil(shortestPath * v))} moves`
      : `×${v.toFixed(2)}`;

  return (
    <>
      <Divider label="Genome" />

      <SliderRow
        label="Length (× shortest path)" value={config.pathLengthFactor}
        min={1} max={5} step={0.25} format={fmtGenomeLen}
        onChange={(v) => set({ pathLengthFactor: v })}
        disabled={runStarted}
        title={runStarted
          ? 'Genome length is fixed once a run starts — reset the run to change it.'
          : undefined}
      />
      <p className="maze-note">
        {runStarted
          ? '×1 demands a perfect move string. Locked while a run is live — reset to change it.'
          : '×1 demands a perfect move string. Changing the length restarts the run.'}
      </p>

      <Divider label="Behaviour" />

      <SegmentedRow<WallRule>
        label="Wall rule" value={config.wallRule}
        options={[
          { value: 'waste', label: 'Waste', title: 'A blocked move is lost — the agent stays put and continues.' },
          { value: 'break', label: 'Break', title: 'Hitting a wall crashes the agent and stops the walk there.' },
          { value: 'repair', label: 'Repair', title: 'A blocked gene is replaced by a random open move — the repaired genome is what breeds on.' },
        ]}
        onChange={(v) => set({ wallRule: v })}
      />

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
    </>
  );
}

/**
 * The maze EA settings presented in the shared drawer (kept for callers that
 * still want the modal form). The experiment page renders
 * {@link MazeEASettingsControls} inline instead.
 */
export function MazeEASettingsPanel({ config, onConfigChange, onClose }: MazeEASettingsPanelProps) {
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
          <MazeEASettingsControls config={config} onConfigChange={onConfigChange} />
        </div>
      </div>
    </div>
  );
}
