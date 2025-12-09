import React from "react";
import "./Button.css";

type Props = {
    hoverImage?: string;
    text: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    width?: number | string;
    height?: number | string;
};

export default function ImageButton({ hoverImage, text, onClick, width = 200, height = 48 }: Props) {
    const style: React.CSSProperties = {
        width,
        height,
    };

    return (
        <div className="button-wrapper">
            <img className="hover-image" src={hoverImage} alt="" />
            <button type="button" className={"button"} aria-label={text} style={style} onClick={onClick}>
                {text}
            </button>
        </div>

    );
}