/**
 * Deep audit of WHY a GLB renders white even though it declares a texture.
 *
 * The shallow check (materials/textures/images exist) passed on the pilot pizza,
 * yet the dish is pure white in both 3D and AR. So verify the whole chain that
 * WebGL actually needs:
 *
 *   material -> texture -> image -> real JPEG bytes
 *   mesh     -> TEXCOORD_0 accessor -> real UV values inside the BIN chunk
 *
 * Any broken link renders an untextured (white) surface. The most common trimesh
 * failure is UVs that are all zero: the whole mesh then samples ONE pixel of the
 * texture, which is why a pizza can look like a plain polystyrene disc.
 *
 * Run: node scripts/audit-glb-texture.mjs <glb-url|path> [--dump]
 */
import { writeFileSync } from 'node:fs';

const target = process.argv[2] || 'https://talabati.rest/firasse_resto/piza3d.glb';
const dump = process.argv.includes('--dump');

async function load(src) {
  if (/^https?:/.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${src}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const { readFileSync } = await import('node:fs');
  return readFileSync(src);
}

/** Reads real pixel dimensions out of a JPEG's SOF marker. */
function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // not SOI
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    const length = buf.readUInt16BE(i + 2);
    // SOF0..SOF3 / SOF5..SOF7 / SOF9..SOF11 carry the frame size
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + length;
  }
  return null;
}

const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const READERS = {
  5126: { size: 4, read: (b, o) => b.readFloatLE(o) },        // FLOAT
  5123: { size: 2, read: (b, o) => b.readUInt16LE(o) },        // UNSIGNED_SHORT
  5121: { size: 1, read: (b, o) => b.readUInt8(o) }            // UNSIGNED_BYTE
};

function readAccessor(json, bin, index) {
  const acc = json.accessors[index];
  const view = json.bufferViews[acc.bufferView];
  const reader = READERS[acc.componentType];
  if (!reader) return null;

  const comps = COMPONENTS[acc.type] || 1;
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = view.byteStride || comps * reader.size;
  const out = [];
  for (let e = 0; e < acc.count; e += 1) {
    const row = [];
    for (let c = 0; c < comps; c += 1) {
      row.push(reader.read(bin, base + e * stride + c * reader.size));
    }
    out.push(row);
  }
  return out;
}

const buf = await load(target);
console.log(`\nfile: ${target}`);
console.log(`size: ${(buf.length / 1024).toFixed(0)} KB`);

// --- GLB container integrity -------------------------------------------------
const totalLength = buf.readUInt32LE(8);
if (totalLength !== buf.length) {
  console.log(`FAIL container: header says ${totalLength} bytes but file is ${buf.length} — truncated upload`);
} else {
  console.log('PASS container length matches header');
}

const jsonLength = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));

// The BIN chunk follows the JSON chunk (both padded to 4 bytes).
let offset = 20 + jsonLength;
let bin = null;
while (offset < buf.length) {
  const chunkLength = buf.readUInt32LE(offset);
  const chunkType = buf.readUInt32LE(offset + 4);
  if (chunkType === 0x004e4942) bin = buf.subarray(offset + 8, offset + 8 + chunkLength); // "BIN"
  offset += 8 + chunkLength;
}

if (!bin) {
  console.log('FAIL no BIN chunk — geometry and embedded images are missing');
  process.exit(1);
}
const declared = json.buffers?.[0]?.byteLength ?? 0;
bin.length >= declared
  ? console.log(`PASS BIN chunk holds ${bin.length} bytes (declared ${declared})`)
  : console.log(`FAIL BIN chunk is ${bin.length} bytes but glTF declares ${declared} — file is cut short`);

// --- material -> texture -> image chain --------------------------------------
console.log('\n--- texture chain ---');
(json.materials || []).forEach((mat, m) => {
  const pbr = mat.pbrMetallicRoughness || {};
  const slot = pbr.baseColorTexture;
  if (!slot) {
    console.log(`material[${m}]: no baseColorTexture -> renders flat colour`);
    return;
  }
  const tex = json.textures?.[slot.index];
  console.log(`material[${m}] -> texture[${slot.index}] texCoord=${slot.texCoord ?? 0}`);
  if (!tex) { console.log('  FAIL texture index does not exist'); return; }
  if (tex.source === undefined) { console.log('  FAIL texture has no image source'); return; }

  const img = json.images[tex.source];
  const view = json.bufferViews[img.bufferView];
  const bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  const dims = jpegSize(bytes);
  console.log(`  image[${tex.source}] ${img.mimeType} ${(bytes.length / 1024).toFixed(0)} KB`);
  dims
    ? console.log(`  PASS decodable JPEG ${dims.width}x${dims.height}`)
    : console.log('  FAIL bytes are not a readable JPEG — GPU gets nothing, surface stays white');

  if (dump && dims) {
    const out = `texture-${tex.source}.jpg`;
    writeFileSync(out, bytes);
    console.log(`  wrote ${out} for visual inspection`);
  }

  // Is the image mostly a single pale colour? A white/blank bake also explains
  // a white render even when everything is technically valid.
  const midpoint = bytes.subarray(Math.floor(bytes.length / 2), Math.floor(bytes.length / 2) + 32);
  console.log(`  entropy probe (mid-file bytes): ${[...midpoint.subarray(0, 8)].join(',')}`);
});

// --- UV coordinates ----------------------------------------------------------
console.log('\n--- UV coordinates (the usual culprit) ---');
for (const [meshIndex, mesh] of (json.meshes || []).entries()) {
  for (const [primIndex, prim] of (mesh.primitives || []).entries()) {
    const uvIndex = prim.attributes?.TEXCOORD_0;
    if (uvIndex === undefined) {
      console.log(`mesh[${meshIndex}].primitive[${primIndex}]: FAIL no TEXCOORD_0`);
      continue;
    }
    const uvs = readAccessor(json, bin, uvIndex);
    if (!uvs) { console.log('  unsupported UV component type'); continue; }

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity, zeros = 0;
    for (const [u, v] of uvs) {
      minU = Math.min(minU, u); maxU = Math.max(maxU, u);
      minV = Math.min(minV, v); maxV = Math.max(maxV, v);
      if (u === 0 && v === 0) zeros += 1;
    }
    console.log(`mesh[${meshIndex}].primitive[${primIndex}]: ${uvs.length} UVs`);
    console.log(`  U range ${minU.toFixed(4)} .. ${maxU.toFixed(4)}`);
    console.log(`  V range ${minV.toFixed(4)} .. ${maxV.toFixed(4)}`);
    console.log(`  exactly (0,0): ${zeros} of ${uvs.length} (${((zeros / uvs.length) * 100).toFixed(1)}%)`);
    console.log(`  first 5: ${uvs.slice(0, 5).map(([u, v]) => `(${u.toFixed(3)},${v.toFixed(3)})`).join(' ')}`);

    const spread = Math.max(maxU - minU, maxV - minV);
    if (spread < 0.01) {
      console.log('  >>> FAIL UVs are degenerate: the whole mesh samples one pixel -> uniform flat colour');
    } else if (zeros / uvs.length > 0.5) {
      console.log('  >>> WARN more than half the UVs sit at (0,0) — large areas take a single pixel');
    } else {
      console.log('  PASS UVs span the texture properly');
    }
  }
}
console.log('');
