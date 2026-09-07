import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // react-hooks' React Compiler rules assume hook-returned values are never
  // mutated after render. R3F's whole performance model is the opposite:
  // useFrame mutating mesh/material properties directly, every frame,
  // instead of triggering React re-renders. That's the correct pattern here,
  // not a bug, so it's scoped off for files that drive the 3D scene.
  {
    files: ["app/nebula-*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  // A leading underscore marks a binding that is deliberately unused, which
  // this codebase relies on for signatures that are shaped now for work that
  // lands later — shellMaterial's `_tier` exists so 2.5's transmission branch
  // extends the render path rather than retrofitting it (see
  // nebula-constellation.tsx). Without this, the only way to silence that is
  // to delete the parameter and add it back, which loses the intent.
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
