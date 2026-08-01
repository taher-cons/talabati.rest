/**
 * Extracts every embedded image from a GLB and measures its ACTUAL colour.
 *
 * Why: the pizza's GLB passes every structural check (valid 1024x1024 JPEG,
 * UVs spanning 0..1) yet renders bone white on the phone. Two possibilities are
 * left, and both are about pixels, not structure:
 *
 *   a) the baked texture really is a pale/blank image, or
 *   b) the material points at the WRONG image (this file has two) — e.g. a
 *      roughness/mask map instead of the colour map.
 *
 * Average colour + saturation per image settles it. Also reports which glTF slot
 * each texture is wired into.
 *
 * Run: node scripts/probe-glb-images.mjs <glb-url|path>
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const target = process.argv[2] || 'https://talabati.rest/firasse_resto/piza3d.glb';

const res = await fetch(target);
const buf = Buffer.from(await res.arrayBuffer());

const jsonLength = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));

let offset = 20 + jsonLength;
let bin = null;
while (offset < buf.length) {
  const len = buf.readUInt32LE(offset);
  const type = buf.readUInt32LE(offset + 4);
  if (type === 0x004e4942) bin = buf.subarray(offset + 8, offset + 8 + len);
  offset += 8 + len;
}

// Which material slot uses which texture — a colour map wired into the wrong
// slot is invisible, and a mask map wired into baseColor looks white/grey.
console.log('\n--- how each texture is wired ---');
(json.materials || []).forEach((mat, m) => {
  const pbr = mat.pbrMetallicRoughness || {};
  const slots = {
    baseColorTexture: pbr.baseColorTexture,
    metallicRoughnessTexture: pbr.metallicRoughnessTexture,
    normalTexture: mat.normalTexture,
    occlusionTexture: mat.occlusionTexture,
    emissiveTexture: mat.emissiveTexture
  };
  for (const [slot, value] of Object.entries(slots)) {
    if (value) console.log(`  material[${m}].${slot} -> texture[${value.index}] -> image[${json.textures[value.index]?.source}]`);
  }
  console.log(`  material[${m}] doubleSided=${mat.doubleSided ?? false} metallic=${pbr.metallicFactor ?? 1} roughness=${pbr.roughnessFactor ?? 1}`);
});

const used = new Set(
  (json.materials || []).flatMap((mat) => {
    const pbr = mat.pbrMetallicRoughness || {};
    return [pbr.baseColorTexture, pbr.metallicRoughnessTexture, mat.normalTexture, mat.occlusionTexture, mat.emissiveTexture]
      .filter(Boolean)
      .map((slot) => json.textures[slot.index]?.source);
  })
);

console.log('\n--- what each image actually looks like ---');
for (const [i, img] of (json.images || []).entries()) {
  const view = json.bufferViews[img.bufferView];
  const bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const file = `glb-image-${i}.jpg`;
  writeFileSync(file, bytes);

  const image = sharp(bytes);
  const meta = await image.metadata();
  const stats = await image.stats();
  const [r, g, b] = stats.channels.map((c) => Math.round(c.mean));

  // Saturation of the average colour: ~0 means grey/white, i.e. no food colour.
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : ((max - min) / max) * 100;
  const brightness = ((r + g + b) / 3 / 255) * 100;

  console.log(`\nimage[${i}] ${meta.width}x${meta.height} ${(bytes.length / 1024).toFixed(0)} KB  (${used.has(i) ? 'USED by a material' : 'NOT referenced by any material'})`);
  // Browsers refuse CMYK JPEGs; WebGL then falls back to baseColorFactor, i.e.
  // pure white. Colour space and channel count decide whether the phone can
  // even decode this image, which sharp happily can.
  console.log(`  colour space: ${meta.space}  channels: ${meta.channels}  progressive: ${meta.isProgressive}  icc: ${meta.icc ? 'yes' : 'no'}`);
  if (meta.space === 'cmyk' || meta.channels === 4) {
    console.log('  >>> FAIL CMYK/4-channel JPEG — WebGL cannot use it, the mesh renders WHITE');
  }
  console.log(`  average RGB : ${r}, ${g}, ${b}`);
  console.log(`  brightness  : ${brightness.toFixed(0)}%`);
  console.log(`  saturation  : ${saturation.toFixed(0)}%`);
  console.log(`  per-channel stddev: ${stats.channels.map((c) => c.stdev.toFixed(0)).join(' / ')}`);
  console.log(`  saved as ${file}`);

  if (saturation < 8 && brightness > 70) {
    console.log('  >>> this image is essentially WHITE/GREY — a mesh textured with it looks like polystyrene');
  } else if (saturation > 15) {
    console.log('  >>> this image carries real colour (food-like)');
  }
}
console.log('');
