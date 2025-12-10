import ImageButtonGroup from "./ImageButtonGroup";
import "../styles/Generic.css";
import type {ImageButtonProps} from "./ImageButton";

export type SidePanelProps = {
    width?: number | string;
    headline: string;
    buttons: ImageButtonProps[];
    defaultSelected?: number;
    onSelectionChange?: () => void;
    gap?: number | string;
    backgroundColor?: string; // neue Prop
    opacity?: number; // neue Prop (0..1)
};

function hexToRgba(hex: string, alpha: number) {
    const h = hex.replace("#", "");
    let r = 0, g = 0, b = 0;
    if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
    } else if (h.length === 6) {
        r = parseInt(h.substring(0, 2), 16);
        g = parseInt(h.substring(2, 4), 16);
        b = parseInt(h.substring(4, 6), 16);
    } else {
        return null;
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function tryBuildBackground(color: string | undefined, opacity: number | undefined) {
    if (!color) return undefined;
    const alpha = typeof opacity === "number" ? Math.max(0, Math.min(1, opacity)) : 1;
    // hex -> rgba
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color)) {
        return hexToRgba(color, alpha);
    }
    // rgb(...) or rgba(...) -> if rgb, inject alpha
    const rgbMatch = color.match(/^rgb\(\s*([^\)]+)\s*\)$/i);
    if (rgbMatch) {
        return color.replace(/^rgb\(/i, "rgba(").replace(/\)$/, `, ${alpha})`);
    }
    // rgba already contains alpha -> use as is (can't override reliably)
    if (/^rgba\(/i.test(color)) return color;
    // fallback: return raw color and let opacity be applied to container
    return null;
}

export default function SidePanel({
                                      width = 320,
                                      headline,
                                      buttons,
                                      onSelectionChange,
                                      gap = 8,
                                      backgroundColor,
                                      opacity = 1,
                                  }: SidePanelProps) {
    const bg = tryBuildBackground(backgroundColor, opacity);
    const useContainerOpacity = bg === null && typeof opacity === "number" && opacity < 1;


    return (
        <aside
            style={{
                height: "100vh",
                width,
                boxSizing: "border-box",
                padding: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                background: bg ?? backgroundColor ?? "transparent",
                opacity: useContainerOpacity ? opacity : undefined,
            }}
            role="complementary"
            aria-label="Side panel"
        >
            <div className={"headline-wrapper"}>
                <h2 className={"headline"}>{headline}</h2>
            </div>

            <div
                style={{
                    flex: 1,
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <ImageButtonGroup
                    buttons={buttons}
                    onSelectionChange={onSelectionChange}
                    gap={gap}
                />
            </div>
        </aside>
    );
}