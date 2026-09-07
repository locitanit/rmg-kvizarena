import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const CDN = 'https://www.gstatic.com/firebasejs/11.10.0';
// A vitest csak abszolut utvonalu aliast fogad el.
const ALHAMIS = fileURLToPath(new URL('./tesztek/alhamis/firebase-cdn.js', import.meta.url));

export default defineConfig({
  resolve: {
    // A web/js modulok a Firebase SDK-t a CDN-rol importaljak (nincs build lepes).
    // Node alatt ez nem oldhato fel, ezert a tesztekben egy ures modul all a helyen.
    alias: [
      { find: `${CDN}/firebase-app.js`, replacement: ALHAMIS },
      { find: `${CDN}/firebase-auth.js`, replacement: ALHAMIS },
      { find: `${CDN}/firebase-firestore.js`, replacement: ALHAMIS },
    ],
  },
  test: {
    include: ['tesztek/**/*.test.js'],
    // Az emulator elso indulasa lassu lehet.
    testTimeout: 20000,
    hookTimeout: 30000,
    // A szabaly-tesztek kozos emulatort hasznalnak, ezert nem futhatnak parhuzamosan.
    fileParallelism: false,
  },
});
