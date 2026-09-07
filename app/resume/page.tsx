import type { Metadata } from "next";
import {
  site,
  tech,
  resumeExperience,
  resumeEducation,
  resumeProjects,
} from "@/content";
import { HomeLink } from "../home-link";

export const metadata: Metadata = {
  title: "Resume | Peter Wang",
  description: site.role,
};

export default function Resume() {
  return (
    <div className="px-6 pt-8 pb-20 md:px-16 md:pt-10 md:pb-24">
      <div className="max-w-[66ch]">
        <HomeLink />

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1
              className="font-display lowercase"
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
              }}
            >
              {site.name}
            </h1>
            <p className="text-[0.875rem] text-ink-muted mt-1">{site.role}</p>
          </div>
          <a
            href="/Peter_Wang_Resume.pdf"
            download
            className="text-[0.875rem] text-mask link-underline"
          >
            Download PDF
          </a>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[0.875rem]">
          <a
            href={`mailto:${site.email}`}
            className="text-mask link-underline"
          >
            {site.email}
          </a>
          <a
            href={site.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mask link-underline"
          >
            GitHub
          </a>
          <a
            href={site.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="text-mask link-underline"
          >
            LinkedIn
          </a>
        </div>

        <section className="mt-10 md:mt-14">
          <h2 className="text-[1.0625rem] font-medium">Experience</h2>

          <div className="mt-3 space-y-8">
            {resumeExperience.map((job) => (
              <div key={job.title + job.org}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-[0.9375rem] font-medium">{job.title}</p>
                  <p className="text-[0.8125rem] text-ink-muted">
                    {job.start} - {job.end}
                  </p>
                </div>
                <p className="text-[0.8125rem] text-ink-muted mt-1">
                  {job.org}
                </p>
                <p className="text-[0.8125rem] text-ink-faint">
                  {job.location}
                </p>

                <ul className="mt-3 space-y-2 list-disc pl-5">
                  {job.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="text-[0.875rem] text-ink-muted leading-[1.55]"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 md:mt-14">
          <h2 className="text-[1.0625rem] font-medium">Education</h2>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4">
            <p className="text-[0.9375rem] font-medium">
              {resumeEducation.school}
            </p>
            <p className="text-[0.8125rem] text-ink-muted">
              {resumeEducation.start} - {resumeEducation.end}
            </p>
          </div>
          <p className="text-[0.8125rem] text-ink-muted mt-1">
            {resumeEducation.degree}, GPA {resumeEducation.gpa}
          </p>
          <p className="text-[0.8125rem] text-ink-faint">
            {resumeEducation.location}
          </p>
        </section>

        <section className="mt-10 md:mt-14">
          <h2 className="text-[1.0625rem] font-medium">Skills</h2>
          <p className="mt-3 text-[0.9375rem] text-ink-muted">
            {tech.map((t) => t.label).join(", ")}.
          </p>
        </section>

        <section className="mt-10 md:mt-14">
          <h2 className="text-[1.0625rem] font-medium">Projects</h2>

          <div className="mt-3 space-y-8">
            {resumeProjects.map((project) => (
              <div key={project.title}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="text-[0.9375rem] font-medium">
                    {project.title}
                  </p>
                  <p className="text-[0.8125rem] text-ink-muted">
                    {project.start} - {project.end}
                  </p>
                </div>
                <p className="text-[0.8125rem] text-ink-faint">
                  {project.stack}
                </p>
                {project.link ? (
                  <a
                    href={project.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[0.8125rem] text-mask link-underline mt-1 inline-block"
                  >
                    {project.link.label}
                  </a>
                ) : null}

                <ul className="mt-3 space-y-2 list-disc pl-5">
                  {project.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="text-[0.875rem] text-ink-muted leading-[1.55]"
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
