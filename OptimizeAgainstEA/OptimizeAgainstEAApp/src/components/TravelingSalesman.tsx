import { useState, useRef, useEffect } from "react";
import type { Node, Edge } from "../types";
import NavigatePageButton from "./NavigatePageButton.tsx";

const NODE_RADIUS = 20;
const NODE_COUNT = 10;

export default function TravelingSalesman() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);
    const [showButton, setShowButton] = useState(false);

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
            const connections = edges.filter(
                (e) => e.from === node.id || e.to === node.id
            ).length;

            ctx.fillStyle =
                selectedNode?.id === node.id
                    ? "orange"
                    : connections === 2
                        ? "green"
                        : "skyblue";

            ctx.beginPath();
            ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "black";
            ctx.stroke();
        });
    }, [nodes, edges, selectedNode]);

    // Helper: check if adding an edge would form a cycle
    function wouldFormCycle(edges: Edge[], from: number, to: number): boolean {
        // Build adjacency list
        const adj: Record<number, number[]> = {};
        edges.forEach(e => {
            if (!adj[e.from]) adj[e.from] = [];
            if (!adj[e.to]) adj[e.to] = [];
            adj[e.from].push(e.to);
            adj[e.to].push(e.from);
        });

        // DFS to see if there is already a path from `from` to `to`
        const visited = new Set<number>();
        function dfs(node: number): boolean {
            if (node === to) return true;
            visited.add(node);
            const neighbors = adj[node] || [];
            for (const n of neighbors) {
                if (!visited.has(n)) {
                    if (dfs(n)) return true;
                }
            }
            return false;
        }

        return dfs(from);
    }


    // Handle canvas clicks
    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find clicked node
        const clickedNode = nodes.find(
            (node) => Math.hypot(node.x - x, node.y - y) <= NODE_RADIUS
        );
        if (!clickedNode) return;

        // Count connections of clicked node
        const clickedConnections = edges.filter(
            (e) => e.from === clickedNode.id || e.to === clickedNode.id
        ).length;
        if (clickedConnections >= 2) return; // max 2 connections

        // If no node is selected yet
        if (!selectedNode) {
            setSelectedNode(clickedNode);
            return;
        }

        // Count connections of selected node
        const selectedConnections = edges.filter(
            (e) => e.from === selectedNode.id || e.to === selectedNode.id
        ).length;
        if (selectedConnections >= 2) {
            setSelectedNode(clickedNode);
            return;
        }

        // Prevent connecting node to itself
        if (selectedNode.id === clickedNode.id) return;

        // Prevent duplicate edges
        const exists = edges.some(
            (e) =>
                (e.from === selectedNode.id && e.to === clickedNode.id) ||
                (e.from === clickedNode.id && e.to === selectedNode.id)
        );
        if (exists) return;

        // Prevent forming a cycle too early
        const nodesRemaining = nodes.filter(
            node => edges.filter(e => e.from === node.id || e.to === node.id).length < 2
        ).length;

        if (nodesRemaining > 2 && wouldFormCycle(edges, selectedNode.id, clickedNode.id)) {
            // Connecting would form a small cycle before completing the circle
            return;
        }

        // Add edge
        setEdges((prev) => [...prev, { from: selectedNode.id, to: clickedNode.id }]);

        // Keep last clicked node selected
        setSelectedNode(clickedNode);

        // Keep last clicked node selected
        setSelectedNode(clickedNode);
    };

    // Show button when all nodes have 2 connections
    useEffect(() => {
        const allHaveTwo = nodes.every(
            (node) =>
                edges.filter((e) => e.from === node.id || e.to === node.id).length === 2
        );
        setShowButton(allHaveTwo && nodes.length > 0);
    }, [edges, nodes]);

    return (
        <div style={{ position: "relative", width: 800, height: 600 }}>
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                style={{ border: "1px solid black" }}
                onClick={handleClick}
            />

            {showButton && (
                <NavigatePageButton to={"/Analytics"} text={"View Analytics"}/>
            )}
        </div>
    );
}