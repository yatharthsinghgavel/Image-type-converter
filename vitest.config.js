import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    globals: true,
    // Expose vitest's `vi` as `jest` so jest-canvas-mock can use jest.fn() etc.
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
  },
});
