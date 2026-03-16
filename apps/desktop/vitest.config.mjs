import { createRequire } from "node:module";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const coverageProviderModule = require.resolve("@vitest/coverage-v8");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@wtb/parser": path.resolve(__dirname, "../../packages/parser/src/index.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    pool: "threads",
    coverage: {
      provider: "custom",
      customProviderModule: coverageProviderModule,
      reporter: ["text", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/test/**",
        "src/main.tsx",
        "src/lib/types.ts",
      ],
    },
  },
});
