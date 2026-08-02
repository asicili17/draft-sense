import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const baseDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });

const config = [
  ...compat.extends("next/core-web-vitals"),
  {
    ignores: ["**/.next/**", "**/node_modules/**", "**/coverage/**"],
    // Vercel runs Next from apps/web; local repository commands run from the root.
    settings: { next: { rootDir: ["apps/web/", "./"] } },
  },
];

export default config;
