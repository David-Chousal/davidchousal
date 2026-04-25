import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "hero-embeds");

/** [source dist path relative to repo root, URL slug under /hero-embeds/] */
const EMBEDS = [
  ["interactive-svg-animation-trick-or-treat_/dist", "trick-or-treat"],
  ["animated-interactive-svg-puzzle/dist", "svg-puzzle"],
  ["pure-css-pinocchio/dist", "pinocchio"],
];

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true });
}
mkdirSync(outDir, { recursive: true });

for (const [rel, slug] of EMBEDS) {
  const src = join(root, rel);
  if (!existsSync(src)) {
    console.warn(`sync-hero-embeds: skip missing ${rel}`);
    continue;
  }
  const dest = join(outDir, slug);
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

console.log("Hero embed demos synced to public/hero-embeds/");
