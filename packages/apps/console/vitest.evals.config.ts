import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Eval-only config to run fixture-driven agent regression tests
 * without pulling in the full server test suite (which is heavier and
 * may require additional environment/mocks).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/services/openai-agent-service.evals.test.ts"],
    exclude: ["node_modules/**", ".cache/**"],
  },
  resolve: {
    alias: [
      { find: /^@golden\/core\/workflow$/, replacement: path.resolve(__dirname, "../../core/src/wcs/workflow.ts") },
      { find: /^@golden\/core$/, replacement: path.resolve(__dirname, "../../core/index.ts") },
      { find: /^@golden\/schema-registry$/, replacement: path.resolve(__dirname, "../../schema-registry/index.ts") },
      { find: /^@golden\/capabilities$/, replacement: path.resolve(__dirname, "../../capabilities/index.ts") },
      { find: /^@golden\/blueprints$/, replacement: path.resolve(__dirname, "../../blueprints/index.ts") },
      { find: /^@golden\/mcp-server$/, replacement: path.resolve(__dirname, "../../tools/mcp-server/index.ts") },
      { find: /^@shared$/, replacement: path.resolve(__dirname, "shared") },
      { find: /^@shared\/(.*)$/, replacement: `${path.resolve(__dirname, "shared")}/$1` },
    ],
  },
});

