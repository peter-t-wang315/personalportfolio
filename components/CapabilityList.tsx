const ROWS: [string, string][] = [
  ["Languages", "C# · TypeScript · JavaScript · SQL · C/C++ (coursework)"],
  ["Messaging", "RabbitMQ · TCP sockets · REST · IPC-CFX · SMEMA"],
  ["Infrastructure", "Docker · Kubernetes · Helm · Jenkins · Azure · Vercel"],
  ["Frontend", "React · Next.js · Redux · Jotai · Tailwind · MUI · Blazor"],
  ["Observability", "Splunk · Azure Monitor"],
  ["Testing", "xUnit"],
];

export default function CapabilityList() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-6 py-16 sm:px-10 md:px-16">
      <p className="font-utility text-xs tracking-[0.2em] text-plum uppercase">Capabilities</p>
      <dl className="font-utility mt-8 border-t border-shell-deep text-sm">
        {ROWS.map(([label, value]) => (
          <div
            key={label}
            className="flex flex-col gap-1 border-b border-shell-deep py-4 sm:flex-row sm:gap-8"
          >
            <dt className="w-full shrink-0 tracking-wider text-ink uppercase sm:w-44">
              {label}
            </dt>
            <dd className="text-graphite">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
