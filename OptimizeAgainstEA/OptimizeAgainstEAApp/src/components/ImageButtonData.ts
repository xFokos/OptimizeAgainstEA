import type { ImageButtonProps } from "./ImageButton";
import BG1 from "../assets/TestBG1.jpg";
import BG2 from "../assets/TestBG2.jpg";

var widthValue: number | string = "80%";
var heightValue: number | string = "30%";

export const ImageButtonData: ImageButtonProps[][] = [
    [
        {
            text: "Knapsack",
            hoverImage: BG1,
            width: widthValue,
            height: heightValue,
        },
        {
            text: "Traveling Salesman",
            hoverImage: BG2,
            width: widthValue,
            height: heightValue,
        }
    ],
    [
        {
            text: "Genetic Algorithm",
            width: widthValue,
            height: heightValue,
        },
        {
            text: "Steady-State GA",
            width: widthValue,
            height: heightValue,
        },
        {
            text: "Binary Genetic Algorithm",
            width: widthValue,
            height: heightValue,
        }
    ],
    [
        {
            text: "Mating Function A",
            width: widthValue,
            height: heightValue,
        },
        {
            text: "Mating Function B",
            width: widthValue,
            height: heightValue,
        }
    ],
    [
        {
            text: "Start",
            width: widthValue,
            height: heightValue,
        },
        {
            text: "Game",
            width: widthValue,
            height: heightValue,
        }
    ]
];