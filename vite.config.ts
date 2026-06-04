import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'ES2022',
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          engine: [
            './src/engine/analyze.ts',
            './src/engine/generate.ts',
            './src/engine/score.ts',
            './src/engine/genetic.ts',
            './src/engine/montecarlo.ts',
            './src/engine/mcts.ts',
            './src/engine/ml.ts',
          ],
          ui: ['./src/ui/index.ts'],
        },
      },
    },
    worker: {
      format: 'es',
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
});
