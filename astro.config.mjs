// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://david-chousal.github.io',
  // GitHub Pages serves this repo at /davidchousal, but for local dev we want /
  base: process.env.GITHUB_ACTIONS ? '/davidchousal' : '/',
  output: 'static',
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()]
  }
});