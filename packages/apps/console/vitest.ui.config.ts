import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./client/src/test-setup.ts"],
    include: ["client/src/components/__tests__/page-layout.test.tsx"],
    exclude: ["node_modules/**", ".cache/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
      "@golden/workflows": path.resolve(
        __dirname,
        "../../../packages/domains/workflows/src/index.ts"
      ),
    },
  },
});

