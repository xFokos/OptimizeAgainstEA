import type {SidePanelProps} from "./SidePanel";
import {ImageButtonData} from "./ImageButtonData.ts";



export const SidePanelData: SidePanelProps[] = [
    {
        headline: "Optimization Problem",
        buttons: ImageButtonData[0],
        width: "100%",
        gap: 12,
        backgroundColor: "#666666",
        opacity: 0.3,
    },
    {
        headline: "Evolutionary Algorithm",
        buttons: ImageButtonData[1],
        width: "100%",
        gap: 12,
        backgroundColor: "#666666",
        opacity: 0.3,
    },
    {
        headline: "Configure EA",
        buttons: ImageButtonData[2],
        width: "100%",
        gap: 12,
        backgroundColor: "#666666",
        opacity: 0.3,
    },
    {
        headline: "General",
        buttons: ImageButtonData[3],
        width: "100%",
        gap: 12,
        backgroundColor: "#666666",
        opacity: 0.3,
    }
    ]