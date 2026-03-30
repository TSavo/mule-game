import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 660_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    globalSetup: "./tests/global-setup.ts",
  },
});
