
import { useState } from "react";
import type { ScreenData } from "./types";
import ScreenView from "./ScreenView";

type Props = {
    screens: ScreenData[];
    onFinish?: (selections: Record<string, string[]>) => void;
};

export default function Wizard({ screens, onFinish }: Props) {
    const [index, setIndex] = useState(0);
    const [selections, setSelections] = useState<Record<string, Set<string>>>(
        () =>
            screens.reduce((acc, s) => {
                acc[s.id] = new Set<string>();
                return acc;
            }, {} as Record<string, Set<string>>)
    );

    const toggleOption = (screenId: string, optionId: string) => {
        setSelections((prev) => {
            const next = { ...prev, [screenId]: new Set(prev[screenId]) };
            if (next[screenId].has(optionId)) next[screenId].delete(optionId);
            else next[screenId].add(optionId);
            return next;
        });
    };

    const goNext = () => {
        if (index < screens.length - 1) setIndex((i) => i + 1);
    };
    const goBack = () => {
        if (index > 0) setIndex((i) => i - 1);
    };
    const handleFinish = () => {
        const plain: Record<string, string[]> = {};
        for (const k of Object.keys(selections)) plain[k] = Array.from(selections[k]);
        onFinish?.(plain);
    };

    const current = screens[index];
    const currentSelection = selections[current.id] ?? new Set<string>();

    const containerStyle: React.CSSProperties = {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "transparent",
    };

    // Höhe der Tab-Leiste (falls angepasst, paddingTop hier anpassen)
    const tabBarHeight = 56;

    return (
        <div style={containerStyle}>
            {/* Top Tabs - transparent und über dem Hintergrund */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: tabBarHeight,
                    display: "flex",
                    gap: 8,
                    padding: 12,
                    alignItems: "center",
                    background: "transparent",
                    zIndex: 2,
                    pointerEvents: "auto",
                }}
            >
                {screens.map((s, i) => (
                    <button
                        key={s.id}
                        onClick={() => setIndex(i)}
                        style={{
                            padding: "8px 12px",
                            borderRadius: 4,
                            border: i === index ? "2px solid rgba(255,255,255,0.9)" : "1px solid rgba(255,255,255,0.5)",
                            background: i === index ? "rgba(255,255,255,0.12)" : "transparent",
                            color: "#fff",
                            textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                            cursor: "pointer",
                        }}
                    >
                        {s.title}
                    </button>
                ))}

                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 12, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                        {index + 1} / {screens.length}
                    </div>
                </div>
            </div>

            {/* Background area (Fullscreen by default) */}
            <div
                style={{
                    backgroundImage: current.bg ? `url(${current.bg})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    // Platz schaffen, damit Inhalte nicht von der absoluten Tab-Leiste verdeckt werden
                    paddingTop: tabBarHeight + 8,
                }}
            >
                {/* Inhalt direkt über dem Hintergrund (kein weißes Panel) */}
                <div style={{ padding: 16, flex: 1, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                    <div style={{ marginBottom: 12 }}>
                        <strong>{current.title}</strong>
                        <span style={{ float: "right" }} />
                    </div>

                    <ScreenView
                        screen={current}
                        selectedOptionIds={currentSelection}
                        onToggle={(optionId) => toggleOption(current.id, optionId)}
                    />

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
                        <button onClick={goBack} disabled={index === 0}>
                            Zurück
                        </button>

                        <div>
                            {index < screens.length - 1 ? (
                                <button onClick={goNext} style={{ marginLeft: 8 }}>
                                    Weiter
                                </button>
                            ) : (
                                <button onClick={handleFinish} style={{ marginLeft: 8 }}>
                                    Fertig
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}