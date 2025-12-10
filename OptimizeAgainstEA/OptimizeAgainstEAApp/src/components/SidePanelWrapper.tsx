import BG2 from "../assets/TestBG2.jpg";
import {useState} from "react";
import SidePanel from "./SidePanel.tsx";
import {SidePanelData} from "./SidePanelData.ts";

/*
Wrapper for the SidePanels
Contains Logic for showing/hiding SidePanels based on selections
 */
export default function SidePanelWrapper() {

    const totalPanels = SidePanelData.length;
    const [visiblePanels, setVisiblePanels] = useState<boolean[]>(
        new Array(totalPanels).fill(false).map((_, i) => i === 0)
    );

    const handleSelectionChange = (panelIndex: number) => () => {
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
                                {...SidePanelData[i]}
                                onSelectionChange={handleSelectionChange(i)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}