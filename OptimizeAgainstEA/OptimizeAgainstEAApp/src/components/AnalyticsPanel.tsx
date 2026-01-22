import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type AnalyticsPanelProps = {
    history: number[];
    eaHistory?: number[];
    maxDisplayValue?: number;
};

export default function AnalyticsPanel({ history, eaHistory, maxDisplayValue = 50 }: AnalyticsPanelProps) {
    if (!history.length) return <div style={{ fontSize: 12, opacity: 0.6 }}>Noch keine bestätigten Punkte</div>;

    // Chart-Daten vorbereiten
    const chartData = history.map((v, i) => ({
        iteration: i + 1,
        user: Math.min(v, maxDisplayValue),
        userRaw: v,
        ea: eaHistory ? Math.min(eaHistory[i] ?? 0, maxDisplayValue) : undefined,
        eaRaw: eaHistory ? eaHistory[i] : undefined,
    }));

    return (
        <div style={{ width: "100%", height: 300, padding: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="iteration" />
                    <YAxis />
                    <Tooltip
                        formatter={(val, name, props) => {
                            if (name === "User") return [`${props.payload.userRaw.toFixed(2)}`, "User"];
                            if (name === "Evolutionary Algorithm") return [`${props.payload.eaRaw?.toFixed(2)}`, "EA"];
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
                            const overCap = payload.userRaw > maxDisplayValue;
                            return (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={4}
                                    fill={overCap ? "red" : "#ffffff"}
                                    stroke={overCap ? "none" : "#000000"}
                                    strokeWidth={1}
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
