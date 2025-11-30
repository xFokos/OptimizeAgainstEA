import Wizard from "./Wizard";
import type { ScreenData } from "./types";
import BG1 from "./assets/TestBG1.jpg";
import BG2 from "./assets/TestBG2.jpg";

const SCREENS: ScreenData[] = [
    {
        id: "s1",
        title: "Screen 1",
        bg: BG1,
        options: [
            { id: "o1", label: "Option A" },
            { id: "o2", label: "Option B" },
            { id: "o3", label: "Option C" },
        ],
    },
    {
        id: "s2",
        title: "Screen 2",
        bg: BG2,
        options: [
            { id: "o4", label: "Option D" },
            { id: "o5", label: "Option E" },
        ],
    },
    {
        id: "s3",
        title: "Screen 3",
        bg: BG1,
        options: [
            { id: "o6", label: "Option F" },
            { id: "o7", label: "Option G" },
            { id: "o8", label: "Option H" },
        ],
    },
];

export default function App() {
    const handleFinish = (selections: Record<string, string[]>) => {
        console.log("Fertig, Selektionen:", selections);
    };

    return (
        <div style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "Arial, sans-serif" }}>
            <h1>Mehrseitiger Wizard</h1>
            <Wizard screens={SCREENS} onFinish={handleFinish} />
        </div>
    );
}


