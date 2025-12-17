import type {SidePanelProps} from "./SidePanel";
import {ButtonData} from "./ButtonData.ts";



export const SidePanelData: SidePanelProps[] = [
    {
        headline: "Optimization Problem",
        buttons: ButtonData[0],
        width: "100%",
        backgroundColor: "#666666",
        opacity: 0.3,
    },
    {
        headline: "General",
        buttons: ButtonData[1],
        width: "100%",
        backgroundColor: "#666666",
        opacity: 0.3,
    },
    {
        headline: "Evolutionary Algorithm",
        buttons: ButtonData[2],
        defaultSelected: 0,
        width: "100%",
        backgroundColor: "#666666",
        opacity: 0.3,
    },
    {
        headline: "Configure EA",
        buttons: ButtonData[3],
        defaultSelected: 1,
        width: "100%",
        backgroundColor: "#666666",
        opacity: 0.3,
    }
    ]