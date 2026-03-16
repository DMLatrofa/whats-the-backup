import { createRequire } from "node:module";
import { defineConfig } from "vitest/config";

const require = createRequire(import.meta.url);
const coverageProviderModule = require.resolve("@vitest/coverage-v8");

export default defineConfig({
  test: {
    pool: "threads",
    coverage: {
      provider: "custom",
      customProviderModule: coverageProviderModule,
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
