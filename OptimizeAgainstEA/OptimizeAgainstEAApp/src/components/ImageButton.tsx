import React from "react";
import "../styles/Button.css";

export type ImageButtonProps = {
    hoverImage?: string;
    text: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
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

    const wrapperStyle: React.CSSProperties = {
        width,
        height,
    };

    const wrapperClass = isSelected
        ? "button-wrapper selected"
        : "button-wrapper";

    const hoverImageStyle: string = hoverImage === undefined ? "none" : "hover-image";

    return (
        <div className={wrapperClass} style={wrapperStyle}>
            <button
                type="button"
                className="button"
                aria-label={text}
                onClick={onClick}
            >
                {text}
                <img className={hoverImageStyle} src={hoverImage} alt="" />
            </button>
        </div>
    );
}
