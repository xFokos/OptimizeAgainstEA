import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";

type NavigatePageButtonProps = {
    to: string;
    text: string;

    width?: number | string;
    height?: number | string;
};

export default function NavigatePageButton({
                                           to,
                                           text,
                                             width,
                                             height,
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
        <button className="btn btn--primary" style={style} onClick={handleClick}>
            {text}
        </button>
    );
}