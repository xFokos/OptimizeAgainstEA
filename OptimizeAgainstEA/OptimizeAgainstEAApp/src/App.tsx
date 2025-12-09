import { useState } from "react";
import SidePanel from "./components/SidePanel";
import BG1 from "./assets/TestBG1.jpg";
import BG2 from "./assets/TestBG2.jpg";
import ("./components/Generic.css");

export default function App() {
    const buttons = [
        { id: "b1", background: BG1, text: "Button1", width: 220, height: 120 },
        { id: "b2", background: BG2, text: "Button2", width: 220, height: 120 },
    ];

    const totalPanels = 4;
    const [visiblePanels, setVisiblePanels] = useState<boolean[]>(
        new Array(totalPanels).fill(false).map((_, i) => i === 0)
    );

    const handleSelectionChange = (panelIndex: number) => (selectedIndex: number, cfg: any) => {
        console.log(`Panel ${panelIndex + 1} - Ausgewählt:`, selectedIndex, cfg);
        setVisiblePanels((prev) => {
            const next = [...prev];
            const nextIndex = panelIndex + 1;
            if (nextIndex < next.length && !next[nextIndex]) {
                next[nextIndex] = true;
            }
            return next;
        });
    };

    const wrapperWidthPercent = `${100 / totalPanels}%`;

    return (
        <div style={{
            backgroundImage: `url(${BG2})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            width: "100vw",
            height: "100vh"
        }}>
            <div
                style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    gap: 0,
                    margin: 0,
                    padding: 0,
                    boxSizing: "border-box",
                    alignItems: "stretch",
                    justifyContent: "flex-start",
                }}
            >

                    {new Array(totalPanels).fill(null).map((_, i) => {
                        const isVisible = visiblePanels[i];
                        return (
                            <div
                                className={"opacity-gradient"}
                                key={i}
                                style={{
                                    width: wrapperWidthPercent,
                                    height: "100%",
                                    boxSizing: "border-box",
                                    visibility: isVisible ? "visible" : "hidden",
                                    pointerEvents: isVisible ? "auto" : "none",
                                }}
                            >
                                <SidePanel
                                    width="100%"
                                    headline={`Panel ${i + 1}`}
                                    buttons={buttons}
                                    onSelectionChange={handleSelectionChange(i)}
                                    gap={12}
                                    backgroundColor={"#666666"}
                                    opacity={0.3}
                                />
                            </div>
                        );
                    })}
            </div>
        </div>
    );
}