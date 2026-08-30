import type { MDXComponents } from "mdx/types";
import ArchDiagram from "@/components/ArchDiagram";

const components: MDXComponents = {
  h2: ({ children }) => (
    <h2 className="font-display mt-14 mb-4 text-xl font-semibold tracking-tight text-ink first:mt-0 sm:text-2xl">
      {children}
    </h2>
  ),
  p: ({ children }) => (
    <p className="mb-5 max-w-[68ch] leading-relaxed text-ink">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="mb-5 ml-5 list-disc space-y-2 text-ink">{children}</ul>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="text-plum underline underline-offset-2">
      {children}
    </a>
  ),
  ArchDiagram,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
