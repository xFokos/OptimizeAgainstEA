import { useState } from "react";
import type { ButtonConfig } from "../../types.ts";

type ButtonGroupProps = {
    buttons: ButtonConfig[];
    defaultSelected?: number;
    gap?: number | string;
    onSelectionChange?: (selectedIndex: number) => void;
};

export default function ButtonGroup({ buttons, defaultSelected, gap = 50, onSelectionChange }: ButtonGroupProps) {
    const [selectedIndex, setSelectedIndex] = useState(defaultSelected ?? -1);

    const handleClick = (index: number) => () => {
        setSelectedIndex(index);
        onSelectionChange?.(index);
    };

    return (
        <div className={"button-group"} style={{gap}}>
            {buttons.map((cfg, i) => {
                const ButtonComp = cfg.component;
                return (
                    <ButtonComp
                        {...cfg.props}
                        isSelected={i === selectedIndex} // inject selection
                        onClick={handleClick(i)}         // inject click
                    />
                );
            })}
        </div>
    );
}
