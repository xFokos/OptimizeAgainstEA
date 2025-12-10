import BG1 from "../assets/TestBG1.jpg";
import TSBG from "../assets/TravelingSalesmanBG.png";

import ImageButton from "../components/ImageButton";
import NavigatePageButton from "../components/NavigatePageButton";

import type { ButtonConfig } from "../types";

const widthValue: number | string = "60%";
const heightValue: number | string = "10%";

export const ButtonData: ButtonConfig[][] = [
    // ======= PAGE 1 (ImageButtons) =======
    [
        {
            component: ImageButton,
            props: {
                text: "Jumping Cube",
                hoverImage: BG1,
                width: widthValue,
                height: heightValue,
                targetPage: "/JumpGame",
            },
        },
        {
            component: ImageButton,
            props: {
                text: "Traveling Salesman",
                hoverImage: TSBG,
                width: widthValue,
                height: heightValue,
                targetPage: "/TravelingSalesman",
            },
        }
    ],

    // ======= PAGE 2 =======
    [
        {
            component: ImageButton,
            props: {
                text: "Genetic Algorithm",
                width: widthValue,
                height: heightValue,
            },
        },
        {
            component: ImageButton,
            props: {
                text: "Steady-State GA",
                width: widthValue,
                height: heightValue,
            },
        },
        {
            component: ImageButton,
            props: {
                text: "Binary Genetic Algorithm",
                width: widthValue,
                height: heightValue,
            },
        }
    ],

    // ======= PAGE 3 =======
    [
        {
            component: ImageButton,
            props: {
                text: "Mating Function A",
                width: widthValue,
                height: heightValue,
            },
        },
        {
            component: ImageButton,
            props: {
                text: "Mating Function B",
                width: widthValue,
                height: heightValue,
            },
        }
    ],

    // ======= PAGE 4 =======
    [
        {
            component: NavigatePageButton,
            props: {
                key: "start",
                text: "Start",
                to: "/game", // <— or your route
                width: widthValue,
                height: heightValue,
            },
        }
    ]
];
