import React, { useState } from "react";
import ImageButton from "./ImageButton";
import type { ImageButtonProps } from "./ImageButton";


type ImageButtonGroupProps = {
    buttons: ImageButtonProps[];
    defaultSelected?: number | null; // optional: wenn nicht gesetzt => keine Auswahl
    onSelectionChange?: (selectedIndex: number, cfg: ImageButtonProps) => void;
    gap?: number | string;
};

export default function ImageButtonGroup({
                                             buttons,
                                             defaultSelected,
                                             onSelectionChange,
                                             gap = 8,
                                         }: ImageButtonGroupProps) {
    const initialSelected = typeof defaultSelected === "number" && !isNaN(defaultSelected)
        ? Math.max(0, Math.min(defaultSelected, buttons.length - 1))
        : -1; // -1 bedeutet: keine Auswahl

    const [selectedIndex, setSelectedIndex] = useState<number>(initialSelected);

    const handleClick = (index: number, cfg: ImageButtonProps) => (
        e: React.MouseEvent<HTMLButtonElement>
    ) => {
        setSelectedIndex(index);
        if (cfg.onClick) cfg.onClick(e);
        if (onSelectionChange) onSelectionChange(index, cfg);
    };

    return (
        <div
            style={{
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap,
                alignItems: "center",
            }}
            role="group"
            aria-label="Image button group"
        >
            {buttons.map((cfg, i) => {

                return (
                    <ImageButton
                        hoverImage={cfg.hoverImage}
                        text={cfg.text}
                        onClick={handleClick(i, cfg)}
                        width={cfg.width}
                        height={cfg.height}
                        id={i}
                        isSelected={i === selectedIndex}
                    />
                );
            })}
        </div>
    );
}