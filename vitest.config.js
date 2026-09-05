import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tesztek/**/*.test.js'],
    // Az emulator elso indulasa lassu lehet.
    testTimeout: 20000,
    hookTimeout: 30000,
    // A szabaly-tesztek kozos emulatort hasznalnak, ezert nem futhatnak parhuzamosan.
    fileParallelism: false,
  },
});
