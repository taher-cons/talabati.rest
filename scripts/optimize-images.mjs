#!/usr/bin/env node
/**
 * Shrink dish photos for mobile.
 *
 * A customer opens the menu on 4G while sitting at the table — a 4.7 MB PNG is
 * several seconds of blank card. This converts every image in a folder to WebP,
 * capped at 1200px on the long edge, which is plenty for a full-width phone
 * card at 3x DPR.
 *
 * Originals are never touched: output is written next to them as <name>.webp
 * (unless the source is already .webp and small enough).
 *
 * Usage:
 *   node scripts/optimize-images.mjs public/firasse_resto
 *   node scripts/optimize-images.mjs public/firasse_resto --max 1600 --quality 80
 */

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, basename } from 'node:path';

const dir = process.argv[2] || 'public/firasse_resto';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? Number(process.argv[i + 1]) : fallback;
};
const MAX = arg('max', 1200);
const QUALITY = arg('quality', 82);
const SOURCES = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const kb = n => `${(n / 1024).toFixed(0)} KB`;

const files = readdirSync(dir).filter(f => SOURCES.has(extname(f).toLowerCase()));
if (!files.length) {
  console.log(`No images found in ${dir}`);
  process.exit(0);
}

let savedTotal = 0;

for (const file of files) {
  const src = join(dir, file);
  const before = statSync(src).size;
  const out = join(dir, `${basename(file, extname(file))}.webp`);

  const meta = await sharp(src).metadata();
  const longEdge = Math.max(meta.width || 0, meta.height || 0);

  // Already a small webp — leave it alone.
  if (extname(file).toLowerCase() === '.webp' && before < 200 * 1024 && longEdge <= MAX) {
    console.log(`skip    ${file.padEnd(14)} ${kb(before).padStart(8)}  (already optimized)`);
    continue;
  }

  const pipeline = sharp(src).rotate(); // honour EXIF orientation
  if (longEdge > MAX) pipeline.resize({ width: MAX, height: MAX, fit: 'inside' });

  const buffer = await pipeline.webp({ quality: QUALITY }).toBuffer();

  // Never make a file bigger than it was.
  if (extname(file).toLowerCase() === '.webp' && buffer.length >= before) {
    console.log(`skip    ${file.padEnd(14)} ${kb(before).padStart(8)}  (no gain)`);
    continue;
  }

  await sharp(buffer).toFile(out);
  const after = statSync(out).size;
  savedTotal += before - after;
  const pct = Math.round((1 - after / before) * 100);
  console.log(
    `written ${basename(out).padEnd(14)} ${kb(before).padStart(8)} -> ${kb(after).padStart(8)}  (-${pct}%)  ${meta.width}x${meta.height}`
  );
}

console.log(`\nTotal saved: ${kb(savedTotal)}`);
