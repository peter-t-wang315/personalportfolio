export default function MetricsStrip({
  eventsProcessed,
  queueDepth,
  activeConnections,
  reconnectAttempts,
}: {
  eventsProcessed: number;
  queueDepth: number;
  activeConnections: number;
  reconnectAttempts: number;
}) {
  const metrics: [string, string][] = [
    ["Events processed", eventsProcessed.toLocaleString()],
    ["Queue depth", String(queueDepth)],
    ["Active connections", `${activeConnections} / 3`],
    ["Reconnect attempts", String(reconnectAttempts)],
  ];

  return (
    <dl className="font-utility grid grid-cols-2 gap-6 sm:grid-cols-4">
      {metrics.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-[10px] tracking-wider text-graphite uppercase">{label}</dt>
          <dd className="text-2xl font-bold text-white tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
