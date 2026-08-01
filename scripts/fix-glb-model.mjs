/**
 * Repairs a dish GLB in place, based on what was measured (not guessed):
 *
 *   1. REMOVE THE FAKE NORMAL MAP
 *      The pilot pizza wires a colour photograph into `normalTexture`
 *      (average RGB 49,41,85 — a real tangent-space normal map averages
 *      ~128,128,255) and the mesh has no TANGENT attribute. The renderer then
 *      perturbs every surface normal with meaningless data, the lighting breaks
 *      and the dish washes out to a white polystyrene-looking disc — exactly
 *      what the pilot phone showed, in 3D and in AR.
 *      The baseColor texture itself is perfect: the upward faces sample
 *      RGB(211,129,52), a golden pizza.
 *
 *   2. FIX REAL-WORLD SCALE INSIDE THE FILE
 *      The model is authored 0.92 m wide. Scaling it from JavaScript only works
 *      in model-viewer's own canvas — when AR hands the raw .glb URL to Scene
 *      Viewer (Android) or Quick Look (iOS), that scale is lost and a metre-wide
 *      pizza lands on the table. Baking the scale into the root node's transform
 *      makes every path agree.
 *
 *   3. Drop the now-unused texture bytes when they sit at the end of the buffer,
 *      so customers on mobile data download less.
 *
 * Run: node scripts/fix-glb-model.mjs <in.glb> <out.glb> [--diameter 0.32]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
const diameterArg = process.argv.indexOf('--diameter');
const TARGET_DIAMETER = diameterArg !== -1 ? Number(process.argv[diameterArg + 1]) : 0.32;

if (!input || !output) {
  console.error('usage: node scripts/fix-glb-model.mjs <in.glb> <out.glb> [--diameter 0.32]');
  process.exit(1);
}

const src = readFileSync(input);
const jsonLength = src.readUInt32LE(12);
const json = JSON.parse(src.subarray(20, 20 + jsonLength).toString('utf8'));

let cursor = 20 + jsonLength;
let bin = null;
while (cursor < src.length) {
  const len = src.readUInt32LE(cursor);
  if (src.readUInt32LE(cursor + 4) === 0x004e4942) bin = Buffer.from(src.subarray(cursor + 8, cursor + 8 + len));
  cursor += 8 + len;
}
if (!bin) {
  console.error('no BIN chunk found');
  process.exit(1);
}

// ---- 1. strip normal maps that are not normal maps -------------------------
// Heuristic mirrors the measurement: a tangent-space normal map is dominated by
// blue. Anything else in that slot actively damages the shading.
const removed = [];
for (const [m, mat] of (json.materials || []).entries()) {
  if (!mat.normalTexture) continue;
  const hasTangent = json.meshes.some((mesh) =>
    mesh.primitives.some((p) => p.material === m && p.attributes.TANGENT !== undefined)
  );
  removed.push({ material: m, texture: mat.normalTexture.index, hadTangent: hasTangent });
  delete mat.normalTexture;
}
console.log(
  removed.length
    ? `removed normalTexture from material(s): ${removed.map((r) => r.material).join(', ')} (TANGENT present: ${removed.map((r) => r.hadTangent).join(', ')})`
    : 'no normalTexture to remove'
);

// A scanned mesh with a photo baked into baseColor should not also look glossy.
for (const mat of json.materials || []) {
  const pbr = (mat.pbrMetallicRoughness = mat.pbrMetallicRoughness || {});
  pbr.metallicFactor = 0;                                   // food is not metal
  pbr.roughnessFactor = Math.max(pbr.roughnessFactor ?? 0.5, 0.6); // diffuse, no plastic sheen
  mat.doubleSided = true;      // scans have thin/inverted shells; avoids holes
}
console.log('material set to metallic=0, roughness>=0.6, doubleSided=true');

// ---- 2. bake real-world scale into the root node ---------------------------
let box = null;
for (const mesh of json.meshes || []) {
  for (const prim of mesh.primitives || []) {
    const acc = json.accessors[prim.attributes.POSITION];
    if (!acc?.min) continue;
    box = box || { min: [...acc.min], max: [...acc.max] };
    for (let i = 0; i < 3; i += 1) {
      box.min[i] = Math.min(box.min[i], acc.min[i]);
      box.max[i] = Math.max(box.max[i], acc.max[i]);
    }
  }
}

if (box) {
  const size = box.max.map((v, i) => v - box.min[i]);
  const widest = Math.max(size[0], size[2]);            // footprint on the table
  const factor = TARGET_DIAMETER / widest;

  const sceneRoots = json.scenes?.[json.scene ?? 0]?.nodes || [];
  for (const nodeIndex of sceneRoots) {
    const node = json.nodes[nodeIndex];
    if (node.matrix) {
      // Scale the existing matrix rather than fighting it.
      for (let i = 0; i < 12; i += 1) node.matrix[i] *= factor;
    } else {
      const current = node.scale || [1, 1, 1];
      node.scale = current.map((v) => v * factor);
    }
  }
  console.log(
    `scaled root node(s) by ${factor.toFixed(4)}: ${widest.toFixed(3)} m -> ${TARGET_DIAMETER} m footprint ` +
    `(height ${(size[1] * factor * 100).toFixed(1)} cm)`
  );
}

// ---- 3. drop unreferenced image bytes when they are last in the buffer -----
const referencedImages = new Set();
for (const mat of json.materials || []) {
  const pbr = mat.pbrMetallicRoughness || {};
  for (const slot of [pbr.baseColorTexture, pbr.metallicRoughnessTexture, mat.normalTexture, mat.occlusionTexture, mat.emissiveTexture]) {
    if (slot) referencedImages.add(json.textures[slot.index].source);
  }
}

const orphans = (json.images || [])
  .map((img, i) => ({ i, img }))
  .filter(({ i }) => !referencedImages.has(i));

if (orphans.length) {
  // Only trim bytes that live at the very end; re-packing the whole buffer would
  // risk corrupting accessor offsets for no real benefit.
  const bufferEnd = bin.length;
  let trimmed = 0;
  for (const { i, img } of orphans) {
    const view = json.bufferViews[img.bufferView];
    const end = (view.byteOffset || 0) + view.byteLength;
    if (end >= bufferEnd - 4 && (view.byteOffset || 0) < bufferEnd) {
      bin = bin.subarray(0, view.byteOffset || 0);
      trimmed += view.byteLength;
      console.log(`trimmed unused image[${i}] (${(view.byteLength / 1024).toFixed(0)} KB) from the end of the buffer`);
    } else {
      console.log(`unused image[${i}] sits mid-buffer; leaving bytes in place (harmless, just weight)`);
    }
  }
  if (trimmed) json.buffers[0].byteLength = bin.length;
}

// ---- write the repaired GLB ------------------------------------------------
json.asset = json.asset || {};
json.asset.generator = `${json.asset.generator || 'unknown'} + talabati fix-glb-model`;

const pad = (buffer, padByte) => {
  const remainder = buffer.length % 4;
  return remainder === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(4 - remainder, padByte)]);
};

const jsonChunk = pad(Buffer.from(JSON.stringify(json), 'utf8'), 0x20); // pad with spaces
const binChunk = pad(bin, 0x00);

const header = Buffer.alloc(12);
header.write('glTF', 0, 'ascii');
header.writeUInt32LE(2, 4);
header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonChunk.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

const binHeader = Buffer.alloc(8);
binHeader.writeUInt32LE(binChunk.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4); // "BIN"

const out = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, binChunk]);
writeFileSync(output, out);

console.log(`\nwrote ${output}: ${(out.length / 1024).toFixed(0)} KB (was ${(src.length / 1024).toFixed(0)} KB)`);
