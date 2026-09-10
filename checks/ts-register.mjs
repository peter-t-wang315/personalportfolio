// Lets a check import the app's own TypeScript — the layout, the node
// geometry, the world scale — without a build step, so a search over the
// layout runs against exactly what ships rather than a copy of it.
//
//   node --experimental-strip-types --no-warnings --import ./checks/ts-register.mjs checks/interiorheading.mjs
//
// Node strips the types; this resolves the `@/` alias and extensionless
// relative imports the app uses. Nothing in the app depends on it.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register(new URL("./ts-loader.mjs", import.meta.url), pathToFileURL("./"));
