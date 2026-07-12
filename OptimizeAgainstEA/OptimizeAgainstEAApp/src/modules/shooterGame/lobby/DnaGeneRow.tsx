import { CompiTooltip } from '../../../components/ui/CompiTooltip';
import { ovStyles } from './lobbyStyles';

// ---- DNA gene row — read-only stat bar with a delta badge on evolution.
// Editing starter DNA happens in the Algorithm tab (ShooterDnaSection); this
// is a "look, don't touch" view so the Overview stays glanceable. ----

function DnaDeltaBadge({ delta }: { delta: number }) {
    if (Math.abs(delta) < 0.005) return null;
    return (
        <span style={{ ...ovStyles.geneDelta, color: delta > 0 ? '#4ade80' : '#f87171' }}>
            {delta > 0 ? '+' : ''}{delta.toFixed(2)}
        </span>
    );
}

export function DnaGeneRow({ label, tooltip, value, delta }: {
    label:   string;
    tooltip: string;
    value:   number;
    delta:   number;
}) {
    return (
        <div style={ovStyles.geneRow}>
            <div style={ovStyles.geneHeader}>
                <CompiTooltip text={tooltip}>
                    <span style={ovStyles.geneName}>{label}</span>
                </CompiTooltip>
                <span style={{ display: 'flex', alignItems: 'baseline' }}>
                    <span style={ovStyles.geneValue}>{value.toFixed(2)}</span>
                    <DnaDeltaBadge delta={delta} />
                </span>
            </div>
            <div style={ovStyles.geneBarTrack}>
                <div style={{ ...ovStyles.geneBarFill, width: `${value * 100}%` }} />
            </div>
        </div>
    );
}
