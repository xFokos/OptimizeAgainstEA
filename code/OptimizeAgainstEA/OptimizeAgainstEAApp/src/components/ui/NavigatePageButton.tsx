import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

type NavigatePageButtonProps = {
    to: string;
    text: string;

    width?: number | string;
    height?: number | string;
    /** Sekundäre Aktion neben einem Primary-Button. Default 'primary'. */
    variant?: "primary" | "ghost";
};

export default function NavigatePageButton({
                                           to,
                                           text,
                                             width,
                                             height,
                                             variant = "primary",
                                       }: NavigatePageButtonProps) {
    const navigate = useNavigate();

    const handleClick = useCallback(() => {
        navigate(to);
    }, [navigate, to]);

    const style: React.CSSProperties = {
        width,
        height,
        justifyContent: "center",
    };

    return (
        <button className={`btn btn--${variant}`} style={style} onClick={handleClick}>
            {text}
        </button>
    );
}