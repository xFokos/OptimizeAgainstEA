import React, { useState } from "react";
import ImageButton from "./ImageButton";

type ButtonConfig = {
    background?: string;
    text: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    width?: number | string;
    height?: number | string;
    id?: string | number;
};

type Props = {
    buttons: ButtonConfig[];
    defaultSelected?: number | null; // optional: wenn nicht gesetzt => keine Auswahl
    onSelectionChange?: (selectedIndex: number, cfg: ButtonConfig) => void;
    gap?: number | string;
};

export default function ImageButtonGroup({
                                             buttons,
                                             defaultSelected,
                                             onSelectionChange,
                                             gap = 8,
                                         }: Props) {
    const initialSelected = typeof defaultSelected === "number" && !isNaN(defaultSelected)
        ? Math.max(0, Math.min(defaultSelected, buttons.length - 1))
        : -1; // -1 bedeutet: keine Auswahl

    const [selectedIndex, setSelectedIndex] = useState<number>(initialSelected);

    const handleClick = (index: number, cfg: ButtonConfig) => (
        e: React.MouseEvent<HTMLButtonElement>
    ) => {
        setSelectedIndex(index);
        if (cfg.onClick) cfg.onClick(e);
        if (onSelectionChange) onSelectionChange(index, cfg);
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap,
                alignItems: "center",
            }}
            role="group"
            aria-label="Image button group"
        >
            {buttons.map((cfg, i) => {
                const isSelected = i === selectedIndex;
                const wrapperStyle: React.CSSProperties = {
                    borderRadius: 16,
                    padding: 2,
                    display: "inline-flex",
                    boxSizing: "border-box",
                    boxShadow: isSelected ? "0 0 0 3px rgba(0,0,0,0.6)" : undefined,
                };

                return (
                    <div key={cfg.id ?? i} style={wrapperStyle}>
                        <ImageButton
                            background={cfg.background}
                            text={cfg.text}
                            onClick={handleClick(i, cfg)}
                            width={cfg.width}
                            height={cfg.height}
                        />
                    </div>
                );
            })}
        </div>
    );
}