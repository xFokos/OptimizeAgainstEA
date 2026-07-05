/**
 * Shared EA-settings control atoms. Pair with the drawer classes in
 * src/styles/specific/EASettingsPanel.css (loaded globally): each game builds
 * its own panel (its EAConfig fields and strategy options differ) out of these
 * rows so every EA settings UI looks and behaves the same.
 */

export function SliderRow({
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
        className="slider"
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

export function SelectRow<T extends string>({
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

/** A select alternative for 2–4 short, mutually exclusive options: one button
 * per option, rendered as a single segmented bar. `title` holds the longer
 * explanation a select would put in the option label. */
export function SegmentedRow<T extends string>({
  label, value, options, onChange,
}: {
  label: string; value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="ea-setting">
      <div className="ea-setting__header">
        <span className="ea-setting__label">{label}</span>
      </div>
      <div className="ea-segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            className={`ea-segmented__btn${o.value === value ? ' ea-segmented__btn--active' : ''}`}
            title={o.title}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return <div className="ea-divider">{label}</div>;
}
