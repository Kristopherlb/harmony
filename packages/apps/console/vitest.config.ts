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
    alias: [
      // Exact-match aliases to avoid prefix collisions (e.g. @golden/core vs @golden/core/workflow).
      { find: /^@golden\/core\/workflow$/, replacement: path.resolve(__dirname, "../../core/src/wcs/workflow.ts") },
      { find: /^@golden\/core$/, replacement: path.resolve(__dirname, "../../core/index.ts") },
      { find: /^@golden\/schema-registry$/, replacement: path.resolve(__dirname, "../../schema-registry/index.ts") },
      { find: /^@golden\/capabilities$/, replacement: path.resolve(__dirname, "../../capabilities/index.ts") },
      { find: /^@golden\/blueprints$/, replacement: path.resolve(__dirname, "../../blueprints/index.ts") },
      { find: /^@golden\/mcp-server$/, replacement: path.resolve(__dirname, "../../tools/mcp-server/index.ts") },
      { find: /^@shared$/, replacement: path.resolve(__dirname, "shared") },
      // Support subpath imports like "@shared/schema" and "@shared/db-schema".
      { find: /^@shared\/(.*)$/, replacement: `${path.resolve(__dirname, "shared")}/$1` },
    ],
  },
});
