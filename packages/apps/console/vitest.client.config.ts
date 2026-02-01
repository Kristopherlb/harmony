import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    include: ["client/**/*.test.{ts,tsx}"],
    exclude: [
      "node_modules/**",
      ".cache/**",
      "server/**",
    ],
    setupFiles: ["./client/src/test-setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["client/src/components/activity-heatmap.tsx"],
      exclude: [
        "node_modules/**",
        ".cache/**",
        "**/*.test.{ts,tsx}",
        "**/__tests__/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
