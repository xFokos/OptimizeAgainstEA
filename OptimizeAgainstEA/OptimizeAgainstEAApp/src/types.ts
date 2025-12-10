import React, { type MouseEvent } from "react";

export type Node = {
    id: number;
    x: number;
    y: number;
    radius?: number;
};

export type Edge = {
    from: number; // node id
    to: number;   // node id
};

// Common props all buttons in the group should support
export interface SelectableButtonProps {
    isSelected?: boolean;
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
}

export interface ButtonConfig<P = any> {
    key?: string | number;
    component: React.ComponentType<P>; // the button component itself
    props: P;                          // props for that component
    targetPage?: string;              // optional target page for navigation
}

