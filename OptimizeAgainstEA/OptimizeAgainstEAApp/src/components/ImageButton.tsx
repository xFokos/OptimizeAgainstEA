import React from "react";

type Props = {
    background?: string;
    text: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
    width?: number | string;
    height?: number | string;
};

export default function ImageButton({ background, text, onClick, width = 200, height = 48 }: Props) {
    const style: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width,
        height,
        padding: "8px 16px",
        borderRadius: 12,
        border: "2px solid #000",
        color: "#000",
        backgroundColor: background ? "transparent" : "#fff",
        backgroundImage: background ? `url(${background})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        cursor: "pointer",
        fontSize: 16,
        fontWeight: 600,
        textAlign: "center",
        boxSizing: "border-box",
    };

    return (
        <button type="button" aria-label={text} style={style} onClick={onClick}>
            {text}
        </button>
    );
}