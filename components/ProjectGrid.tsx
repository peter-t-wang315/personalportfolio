import { projects } from "@/lib/projects";
import ProjectTile from "./ProjectTile";

export default function ProjectGrid() {
  return (
    <section id="storage" className="mx-auto w-full max-w-[1440px] px-6 py-20 sm:px-10 md:px-16">
      <p className="font-utility text-xs tracking-[0.2em] text-plum uppercase">Storage</p>
      <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Seven projects, one flat grid
      </h2>
      <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {projects.map((project) => (
          <ProjectTile key={project.slug} project={project} />
        ))}
      </ul>
    </section>
  );
}
