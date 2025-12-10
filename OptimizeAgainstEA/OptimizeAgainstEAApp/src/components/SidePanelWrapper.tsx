import {useEffect, useState} from "react";
import SidePanel from "./SidePanel.tsx";
import {SidePanelData} from "./SidePanelData.ts";
import BG2 from "../assets/TestBG2.jpg";
import NavigatePageButton from "./NavigatePageButton.tsx";

/*
Wrapper for the SidePanels
Contains Logic for showing/hiding SidePanels based on selections
 */
export default function SidePanelWrapper() {

    const [selectedStartPage, setSelectedStartPage] = useState<string | null>(null);

    useEffect(() => {
        console.log("Selected page changed:", selectedStartPage);
    }, [selectedStartPage]);


    const totalPanels = SidePanelData.length;
    const [visiblePanels, setVisiblePanels] = useState<boolean[]>(
        new Array(totalPanels).fill(false).map((_, i) => i === 0)
    );

    const handleSelectionChange = (panelIndex: number) => (selectedIndex?: number) => {
        // 1. show next panel
        setVisiblePanels((prev) => {
            const next = [...prev];
            if (panelIndex + 1 < next.length) next[panelIndex + 1] = true;
            return next;
        });

        // 2. IF this panel is the one with options → store selected page
        if (panelIndex === 0 && typeof selectedIndex === "number") {
            // Example: SidePanelData[0].buttons[selectedIndex].targetPage
            const chosen = SidePanelData[0].buttons[selectedIndex].props.targetPage;
            if (chosen != undefined) {
                setSelectedStartPage(chosen);
            }
        }
    };


    const wrapperWidthPercent = `${100 / totalPanels}%`;

    return (
        <div style={{
            backgroundImage: `url(${BG2})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            width: "100%",
            height: "100%"
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
                                buttons={SidePanelData[i].buttons.map((b) => {
                                    // If this button is a NavigatePageButton → overwrite its "to"
                                    if (b.component === NavigatePageButton) {
                                        return {
                                            ...b,
                                            props: {
                                                ...b.props,
                                                to: selectedStartPage ?? b.props.to, // dynamic override
                                            }
                                        };
                                    }

                                    return b;
                                })}
                            />

                        </div>
                    );
                })}
            </div>
        </div>
    );
}