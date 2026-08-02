import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/coverage/**"],
    settings: { next: { rootDir: "apps/web/" } }
  }
];

export default config;
