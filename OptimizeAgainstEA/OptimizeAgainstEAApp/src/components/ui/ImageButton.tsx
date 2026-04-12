import React from "react";
import "../../styles/general/Button.css";

export type ImageButtonProps = {
    hoverImage?: string;
    text: string;

    // single OR multiple click handlers
    onClick?:
        | React.MouseEventHandler<HTMLButtonElement>
        | React.MouseEventHandler<HTMLButtonElement>[];

    width?: number | string;
    height?: number | string;
    id?: string | number;
    isSelected?: boolean;
};

export default function ImageButton({
                                        hoverImage,
                                        text,
                                        onClick,
                                        width = "80%",
                                        height = "30%",
                                        isSelected = false,
                                    }: ImageButtonProps) {
    const wrapperStyle: React.CSSProperties = { width, height };

    const wrapperClass = isSelected
        ? "button-wrapper selected"
        : "button-wrapper";

    const hoverImageClass = hoverImage ? "hover-image" : "none";

    // unified click handler
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (Array.isArray(onClick)) {
            onClick.forEach(fn => fn(e));
        } else if (onClick) {
            onClick(e);
        }
    };

    return (
        <div className={wrapperClass} style={wrapperStyle}>
            <button
                type="button"
                className="button"
                aria-label={text}
                onClick={handleClick}
            >
                {text}
                <img className={hoverImageClass} src={hoverImage} alt="" />
            </button>
        </div>
    );
}
