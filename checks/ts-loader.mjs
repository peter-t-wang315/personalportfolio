import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// Resolves `@/lib/x` to `<repo>/lib/x.ts` and `./x` to `./x.ts`, the way
// tsconfig's `paths` does for the app. See ts-register.mjs.
const ROOT = process.cwd();
const EXTENSIONS = [".ts", ".tsx", "/index.ts"];

export async function resolve(specifier, context, next) {
  let file;
  if (specifier.startsWith("@/")) {
    file = path.join(ROOT, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    file = fileURLToPath(new URL(specifier, context.parentURL));
  } else {
    return next(specifier, context);
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    for (const ext of EXTENSIONS) {
      if (fs.existsSync(file + ext)) {
        file += ext;
        break;
      }
    }
  }
  return { url: pathToFileURL(file).href, shortCircuit: true };
}
