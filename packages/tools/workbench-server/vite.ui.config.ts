import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uiRoot = resolve(__dirname, 'src/ui');
const outDir = resolve(__dirname, 'dist-ui');

export default defineConfig({
  root: uiRoot,
  plugins: [react()],
  build: {
    outDir,
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        graphiql: resolve(uiRoot, 'graphiql/index.html'),
        swagger: resolve(uiRoot, 'swagger/index.html'),
      },
    },
  },
});

