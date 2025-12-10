

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

export interface ButtonConfig<P = any> {
    key?: string | number;
    component: React.ComponentType<P>; // the button component itself
    props: P;                          // props for that component
    targetPage?: string;              // optional target page for navigation
}

