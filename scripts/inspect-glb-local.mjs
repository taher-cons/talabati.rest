/**
 * Local variant of inspect-glb.mjs — reads a GLB file straight from disk
 * instead of fetching it over HTTP. Same report: materials, textures,
 * UV/normal presence, node transforms, and real-world bounding box.
 *
 * Run: node scripts/inspect-glb-local.mjs <path-to.glb>
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('usage: node scripts/inspect-glb-local.mjs <path-to.glb>');
  process.exit(1);
}

const buf = readFileSync(file);
console.log(`\n=== ${file} ===`);
console.log(`size  : ${(buf.length / 1024).toFixed(0)} KB`);

if (buf.subarray(0, 4).toString('ascii') !== 'glTF') {
  console.log('NOT a GLB file — aborting');
  process.exit(1);
}

const jsonLength = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));

console.log(`generator: ${json.asset?.generator || 'unknown'}`);
console.log(`meshes   : ${json.meshes?.length || 0}`);
console.log(`materials: ${json.materials?.length || 0}`);
console.log(`textures : ${json.textures?.length || 0}`);
console.log(`images   : ${json.images?.length || 0}`);

(json.materials || []).forEach((m, i) => {
  const pbr = m.pbrMetallicRoughness || {};
  const colour = pbr.baseColorFactor
    ? pbr.baseColorFactor.map((n) => n.toFixed(2)).join(', ')
    : 'default (1,1,1,1) = WHITE';
  console.log(
    `  material[${i}] "${m.name || '-'}" baseColorTexture=${pbr.baseColorTexture ? 'yes' : 'NO'} baseColorFactor=[${colour}]`
  );
});

for (const mesh of json.meshes || []) {
  for (const [p, prim] of (mesh.primitives || []).entries()) {
    const attrs = Object.keys(prim.attributes || {});
    console.log(`  primitive[${p}] attributes: ${attrs.join(', ')}`);
  }
}

(json.nodes || []).forEach((n, i) => {
  const parts = [];
  if (n.matrix) parts.push(`matrix=[${n.matrix.map((v) => v.toFixed(2)).join(', ')}]`);
  if (n.rotation) parts.push(`rotation=[${n.rotation.map((v) => v.toFixed(3)).join(', ')}]`);
  if (n.scale) parts.push(`scale=[${n.scale.map((v) => v.toFixed(3)).join(', ')}]`);
  if (n.translation) parts.push(`translation=[${n.translation.map((v) => v.toFixed(3)).join(', ')}]`);
  console.log(`  node[${i}] "${n.name || '-'}" ${parts.join(' ') || 'identity transform'}`);
});

let box = null;
for (const mesh of json.meshes || []) {
  for (const prim of mesh.primitives || []) {
    const accessor = json.accessors?.[prim.attributes?.POSITION];
    if (!accessor?.min || !accessor?.max) continue;
    box = box || { min: [...accessor.min], max: [...accessor.max] };
    for (let a = 0; a < 3; a += 1) {
      box.min[a] = Math.min(box.min[a], accessor.min[a]);
      box.max[a] = Math.max(box.max[a], accessor.max[a]);
    }
  }
}
if (box) {
  const dims = box.max.map((v, i) => (v - box.min[i]).toFixed(3));
  console.log(`bounding box (model units): X=${dims[0]} Y=${dims[1]} Z=${dims[2]}`);
  console.log(`  min: [${box.min.map((v) => v.toFixed(3)).join(', ')}]  max: [${box.max.map((v) => v.toFixed(3)).join(', ')}]`);
  const [x, y, z] = dims.map(Number);
  console.log(`  Y (height) vs footprint (max of X,Z): height=${y.toFixed(3)} footprint=${Math.max(x, z).toFixed(3)}`);
  if (y > Math.max(x, z)) {
    console.log('  >>> LIKELY STANDING UPRIGHT (height exceeds footprint) — needs rotation to lie flat');
  } else {
    console.log('  >>> Looks flat/lying down already (footprint exceeds height)');
  }
}
