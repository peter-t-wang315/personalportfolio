import type { ProjectMeta } from "@/lib/projects";

export default function FactsStrip({ project }: { project: ProjectMeta }) {
  const facts: [string, string][] = [
    ["Role", project.role],
    ["Timeline", "[NEEDS PETER: timeline]"],
    ["Stack", project.stack.join(" · ")],
    ["Scale", project.scale],
  ];

  return (
    <dl className="font-utility grid grid-cols-1 gap-x-8 gap-y-4 border-y border-shell-deep py-6 text-sm sm:grid-cols-4">
      {facts.map(([label, value]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="text-xs tracking-wider text-graphite uppercase">{label}</dt>
          <dd className={value.startsWith("[NEEDS PETER") ? "text-plum" : "text-ink"}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
