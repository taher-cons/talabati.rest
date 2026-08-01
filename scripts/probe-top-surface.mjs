/**
 * THE decisive measurement: what colour is the texture on the mesh's TOP faces?
 *
 * Everything structural checks out (valid sRGB JPEG, UVs spanning 0..1, correct
 * material wiring) yet the customer sees a white disc on the table. Two very
 * different causes remain, and they need opposite fixes:
 *
 *   a) the renderer is not applying the texture   -> fix the viewer/material
 *   b) the model's upward-facing surface really IS white in the texture (we are
 *      looking at a plate / bare dough, i.e. a bad scan) -> replace the model
 *
 * So: walk the triangles, keep the ones whose normal points up, sample the
 * baseColor texture at their UVs, and report the average colour actually
 * visible from above. Also reports the sideways and downward faces for contrast,
 * and validates the normal map (a real one averages ~(128,128,255)).
 *
 * Run: node scripts/probe-top-surface.mjs [glb-url]
 */
import sharp from 'sharp';

const target = process.argv[2] || 'https://talabati.rest/firasse_resto/piza3d.glb';

const buf = Buffer.from(await (await fetch(target)).arrayBuffer());
const jsonLength = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));

let offset = 20 + jsonLength;
let bin = null;
while (offset < buf.length) {
  const len = buf.readUInt32LE(offset);
  if (buf.readUInt32LE(offset + 4) === 0x004e4942) bin = buf.subarray(offset + 8, offset + 8 + len);
  offset += 8 + len;
}

const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const READERS = {
  5126: [4, (b, o) => b.readFloatLE(o)],
  5125: [4, (b, o) => b.readUInt32LE(o)],
  5123: [2, (b, o) => b.readUInt16LE(o)],
  5121: [1, (b, o) => b.readUInt8(o)]
};

function accessor(index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const [size, read] = READERS[acc.componentType];
  const comps = COMPS[acc.type];
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = view.byteStride || comps * size;
  const rows = [];
  for (let e = 0; e < acc.count; e += 1) {
    const row = [];
    for (let c = 0; c < comps; c += 1) row.push(read(bin, base + e * stride + c * size));
    rows.push(comps === 1 ? row[0] : row);
  }
  return rows;
}

const prim = json.meshes[0].primitives[0];
const positions = accessor(prim.attributes.POSITION);
const normals = accessor(prim.attributes.NORMAL);
const uvs = accessor(prim.attributes.TEXCOORD_0);
const indices = prim.indices !== undefined ? accessor(prim.indices) : positions.map((_, i) => i);

// Decode the baseColor image to raw RGB so we can sample any pixel.
const baseImageIndex = json.textures[json.materials[0].pbrMetallicRoughness.baseColorTexture.index].source;
const baseView = json.bufferViews[json.images[baseImageIndex].bufferView];
const baseBytes = bin.subarray(baseView.byteOffset || 0, (baseView.byteOffset || 0) + baseView.byteLength);
const { data, info } = await sharp(baseBytes).raw().toBuffer({ resolveWithObject: true });

const sample = (u, v) => {
  // glTF UV origin is top-left, same as image rows.
  const x = Math.min(info.width - 1, Math.max(0, Math.round(u * (info.width - 1))));
  const y = Math.min(info.height - 1, Math.max(0, Math.round(v * (info.height - 1))));
  const o = (y * info.width + x) * info.channels;
  return [data[o], data[o + 1], data[o + 2]];
};

const buckets = {
  up: { count: 0, r: 0, g: 0, b: 0 },
  side: { count: 0, r: 0, g: 0, b: 0 },
  down: { count: 0, r: 0, g: 0, b: 0 }
};

let area = { up: 0, side: 0, down: 0 };

for (let t = 0; t < indices.length; t += 3) {
  const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
  const ny = (normals[a][1] + normals[b][1] + normals[c][1]) / 3;

  const bucket = ny > 0.6 ? 'up' : ny < -0.6 ? 'down' : 'side';
  const centroidU = (uvs[a][0] + uvs[b][0] + uvs[c][0]) / 3;
  const centroidV = (uvs[a][1] + uvs[b][1] + uvs[c][1]) / 3;
  const [r, g, bl] = sample(centroidU, centroidV);

  buckets[bucket].count += 1;
  buckets[bucket].r += r;
  buckets[bucket].g += g;
  buckets[bucket].b += bl;
  area[bucket] += 1;
}

const describe = (label, bucket) => {
  if (!bucket.count) { console.log(`  ${label}: no faces`); return; }
  const r = Math.round(bucket.r / bucket.count);
  const g = Math.round(bucket.g / bucket.count);
  const b = Math.round(bucket.b / bucket.count);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max ? ((max - min) / max) * 100 : 0;
  const bright = ((r + g + b) / 3 / 255) * 100;
  console.log(`  ${label}: ${bucket.count} triangles  RGB(${r}, ${g}, ${b})  brightness ${bright.toFixed(0)}%  saturation ${sat.toFixed(0)}%`);
  if (bright > 70 && sat < 12) console.log(`     >>> ${label} surface is WHITE/GREY in the texture`);
  if (sat > 25) console.log(`     >>> ${label} surface carries real food colour`);
};

console.log(`\nfile: ${target}`);
console.log(`triangles: ${indices.length / 3}, texture ${info.width}x${info.height}\n`);
console.log('colour of the texture as seen per face orientation:');
describe('UPWARD  ', buckets.up);
describe('SIDEWAYS', buckets.side);
describe('DOWNWARD', buckets.down);

// A normal map must be predominantly light blue-violet: (~128, ~128, 255).
const normalSlot = json.materials[0].normalTexture;
if (normalSlot) {
  const idx = json.textures[normalSlot.index].source;
  const view = json.bufferViews[json.images[idx].bufferView];
  const bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const stats = await sharp(bytes).stats();
  const [r, g, b] = stats.channels.map((c) => Math.round(c.mean));
  console.log(`\nnormal map image[${idx}] average RGB(${r}, ${g}, ${b})`);
  const looksLikeNormalMap = b > 150 && Math.abs(r - 128) < 45 && Math.abs(g - 128) < 45;
  console.log(
    looksLikeNormalMap
      ? '  PASS looks like a real tangent-space normal map'
      : '  >>> FAIL this is NOT a normal map (a real one averages ~128,128,255).\n' +
        '      Feeding a colour photo into normalTexture scrambles every surface normal,\n' +
        '      which destroys the lighting and washes the dish out.'
  );
  const hasTangent = prim.attributes.TANGENT !== undefined;
  console.log(`  mesh TANGENT attribute: ${hasTangent ? 'present' : 'MISSING (normal map needs it, or gets derived badly)'}`);
}
console.log('');
