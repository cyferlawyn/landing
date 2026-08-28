// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Astro 7 changed the compressHTML default from `true` to `'jsx'` (strips
  // whitespace between inline elements). Pin `true` to preserve prior output
  // exactly; migrate to `'jsx'` later, deliberately.
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()]
  }
});