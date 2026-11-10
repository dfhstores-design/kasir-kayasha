import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist", "node_modules", "public/sw.js", "artifacts", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // react-hooks 7 menyediakan konfigurasi flat di `.configs.flat`.
  reactHooks.configs.flat["recommended-latest"],
  reactRefresh.configs.vite,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: {
      // Jangan biarkan console dipakai untuk data pelanggan / transaksi.
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["vite.config.ts", "vitest.config.ts", "eslint.config.js", "docs/design/tools/**/*.mjs", "docs/design/*.mjs", "scripts/**/*.mjs", "scripts/**/*.js"],
    languageOptions: { globals: globals.node },
  },
];
