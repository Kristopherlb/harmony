import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/**/*.test.ts"],
    exclude: [
      "node_modules/**",
      ".cache/**",
      "client/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "server/storage.ts",
        "server/adapters.ts",
        "server/routes.ts",
        "server/clients.ts",
        "server/webhook-verification.ts",
      ],
      exclude: [
        "node_modules/**",
        ".cache/**",
        "client/**",
        "**/*.config.*",
        "**/types/**",
        "**/*.test.ts",
        "server/index.ts",
        "server/static.ts",
        "server/vite.ts",
      ],
      thresholds: {
        lines: 75,
        functions: 80,
        branches: 65,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
