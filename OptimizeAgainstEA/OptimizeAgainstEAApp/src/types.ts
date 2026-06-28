

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
