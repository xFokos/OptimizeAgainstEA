import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

type NavigateButtonProps = {
    to: string;
    text: string;

    width?: number | string;
    height?: number | string;
};

export default function NavigateButton({
                                           to,
                                           text,
                                           width = "200px",
                                           height = "48px",
                                       }: NavigateButtonProps) {
    const navigate = useNavigate();

    const handleClick = useCallback(() => {
        navigate(to);
    }, [navigate, to]);

    const style: React.CSSProperties = {
        width,
        height,
    };

    return (
        <button className="button" style={style} onClick={handleClick}>
            {text}
        </button>
    );
}