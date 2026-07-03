import type { ReactNode } from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Text (or nodes) rendered next to the track. */
  label?: ReactNode;
  /** Tooltip on the whole control. */
  title?: string;
  disabled?: boolean;
}

/**
 * On/off toggle switch. A real (visually hidden) checkbox drives it, so
 * keyboard and screen-reader behaviour match a native checkbox. Styling
 * lives in styles/primitives/switch.css (loaded globally).
 */
export function Switch({ checked, onChange, label, title, disabled }: SwitchProps) {
  return (
    <label className="switch" title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch__track" aria-hidden="true" />
      {label && <span className="switch__label">{label}</span>}
    </label>
  );
}
