import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type AnalyticsPanelProps = {
    history: number[];
    eaHistory?: number[];
    maxDisplayValue?: number;
    onHover?: (index: number | null) => void;  // neu
};

export default function AnalyticsPanel({ history, eaHistory, onHover }: AnalyticsPanelProps) {
    if (!history.length) return <div style={{ fontSize: 12, opacity: 0.6 }}>Noch keine bestätigten Punkte</div>;


    const eps = 1e-6;

    const formatValue = (v: number) => {
        if (v >= 1) return v.toFixed(2);
        if (v >= 0.01) return v.toFixed(3);
        if (v >= 0.001) return v.toFixed(4);
        return v.toExponential(2);
    };

    // Chart-Daten vorbereiten
    const chartData = history.map((v, i) => ({
        iteration: i + 1,
        user: Math.max(v, eps),
        userRaw: v,
        ea: eaHistory ? Math.max(eaHistory[i] ?? eps, eps) : undefined,
        eaRaw: eaHistory ? eaHistory[i] : undefined,
    }));

    const getColorForValue = (v: number) => {
        if (v < 0.1) return "#00ff88";      // sehr gut
        if (v < 1) return "#88ff00";       // gut
        if (v < 10) return "#ffff00";         // mittel
        if (v < 100) return "#ff8800";        // schlecht
        return "#ff0000";                   // sehr schlecht
    };



    return (
        <div style={{ width: "100%", height: 300, padding: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="iteration" />
                    <YAxis
                        scale="log"
                        domain={[1e-1, "auto"]}
                        tickFormatter={(v) => {
                            //if (v >= 1000) return (v / 1000).toFixed(1) + "k";
                            if (v >= 1) return v.toFixed(1);
                            if (v >= 0.01) return v.toFixed(2);
                            if (v < 0.01) return v.toFixed(3);
                            if (v < 0.001) return v.toFixed(4);
                            if (v < 0.0001) return v.toFixed(5);
                            return v.toExponential(1); // nur für extrem kleine Werte
                        }}
                    />
                    <Tooltip
                        formatter={(val, name, props) => {
                            if (name === "User") return [formatValue(props.payload.userRaw), "User"];
                            if (name === "Evolutionary Algorithm") return [formatValue(props.payload.eaRaw), "EA"];
                            return [val, name];
                        }}
                        contentStyle={{ backgroundColor: "#222", border: "1px solid #555" }}
                        itemStyle={{ color: "#fff" }}
                    />
                    <Line
                        dataKey="user"
                        name="User"
                        isAnimationActive={false}
                        stroke="#ffffff"
                        dot={(props) => {
                            const { cx, cy, payload } = props;
                            const index = payload.iteration - 1; // 0-basierter Index

                            return (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={getColorForValue(payload.userRaw)}
                                    stroke="#000"
                                    strokeWidth={1}
                                    onMouseEnter={() => onHover?.(index)}
                                    onMouseLeave={() => onHover?.(null)}
                                />
                            );
                        }}
                    />
                    {eaHistory && (
                        <Line
                            dataKey="ea"
                            stroke="#a078ff"
                            name="Evolutionary Algorithm"
                            strokeDasharray="5 5"
                            dot={false}
                            isAnimationActive={false}
                        />
                    )}
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
