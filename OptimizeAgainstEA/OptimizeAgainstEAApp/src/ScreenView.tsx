
import type { ScreenData } from "./types";

type Props = {
    screen: ScreenData;
    selectedOptionIds: Set<string>;
    onToggle: (optionId: string) => void;
};

export default function ScreenView({ screen, selectedOptionIds, onToggle }: Props) {
    return (
        <div>
            <p style={{ marginTop: 0 }}>Wähle eine oder mehrere Optionen:</p>
            <ul style={{ listStyle: "none", paddingLeft: 0 }}>
                {screen.options.map((opt) => {
                    const checked = selectedOptionIds.has(opt.id);
                    return (
                        <li key={opt.id} style={{ marginBottom: 8 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input type="checkbox" checked={checked} onChange={() => onToggle(opt.id)} />
                                <span>{opt.label}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}