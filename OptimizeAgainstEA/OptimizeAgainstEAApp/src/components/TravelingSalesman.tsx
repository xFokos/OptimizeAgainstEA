import { useState, useRef, useEffect } from "react";
import type { Node, Edge } from "../types";

const NODE_RADIUS = 20;
const NODE_COUNT = 10;

export default function GraphSimulation() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    // Generate random nodes on mount
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const width = canvas.width;
        const height = canvas.height;

        const generatedNodes: Node[] = [];
        for (let i = 0; i < NODE_COUNT; i++) {
            generatedNodes.push({
                id: i,
                x: Math.random() * (width - NODE_RADIUS * 2) + NODE_RADIUS,
                y: Math.random() * (height - NODE_RADIUS * 2) + NODE_RADIUS,
                radius: NODE_RADIUS,
            });
        }
        setNodes(generatedNodes);
    }, []);

    // Draw nodes and edges
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw edges
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        edges.forEach((edge) => {
            const from = nodes.find((n) => n.id === edge.from);
            const to = nodes.find((n) => n.id === edge.to);
            if (!from || !to) return;

            ctx.beginPath();
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
            ctx.stroke();
        });

        // Draw nodes
        nodes.forEach((node) => {
            ctx.fillStyle = selectedNode?.id === node.id ? "orange" : "skyblue";
            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.stroke();
        });
    }, [nodes, edges, selectedNode]);

    // Handle canvas clicks
    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if a node was clicked
        const clickedNode = nodes.find(
            (node) => Math.hypot(node.x - x, node.y - y) <= NODE_RADIUS
        );

        if (!clickedNode) return;

        if (!selectedNode) {
            setSelectedNode(clickedNode);
        } else if (selectedNode.id !== clickedNode.id) {
            // Create edge
            setEdges([...edges, { from: selectedNode.id, to: clickedNode.id }]);
            setSelectedNode(null);
        } else {
            // Clicked the same node again
            setSelectedNode(null);
        }
    };

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            style={{ border: "1px solid black" }}
            onClick={handleClick}
        />
    );
}
