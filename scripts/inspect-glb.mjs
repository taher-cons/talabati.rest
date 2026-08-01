/**
 * Opens the actual GLB the customer downloads and reports what is inside it:
 * materials, textures, image sources, and the real-world size of the mesh.
 *
 * Why: on the pilot phone the pizza rendered pure white. That is either
 *   (a) the model has no textures/materials baked in, or
 *   (b) it references external image files that fail to load.
 * These are opposite fixes, so we read the file instead of guessing.
 *
 * Run: node scripts/inspect-glb.mjs [https://talabati.rest] [slug]
 */
const BASE = process.argv[2] || 'https://talabati.rest';
const SLUG = process.argv[3] || 'firasse_food';

async function inspect(url, label) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  console.log(`\n=== ${label} ===`);
  console.log(`url   : ${url}`);
  console.log(`size  : ${(buf.length / 1024).toFixed(0)} KB`);

  if (buf.subarray(0, 4).toString('ascii') !== 'glTF') {
    console.log('NOT a GLB file — aborting');
    return;
  }

  // GLB layout: 12-byte header, then chunks (length, type, data).
  // The first chunk is always the JSON scene description.
  const jsonLength = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));

  console.log(`generator: ${json.asset?.generator || 'unknown'}`);
  console.log(`meshes   : ${json.meshes?.length || 0}`);
  console.log(`materials: ${json.materials?.length || 0}`);
  console.log(`textures : ${json.textures?.length || 0}`);
  console.log(`images   : ${json.images?.length || 0}`);
  console.log(`extensions used: ${(json.extensionsUsed || []).join(', ') || 'none'}`);

  (json.materials || []).forEach((m, i) => {
    const pbr = m.pbrMetallicRoughness || {};
    const colour = pbr.baseColorFactor
      ? pbr.baseColorFactor.map((n) => n.toFixed(2)).join(', ')
      : 'default (1,1,1,1) = WHITE';
    console.log(
      `  material[${i}] "${m.name || '-'}" baseColorTexture=${pbr.baseColorTexture ? 'yes' : 'NO'} baseColorFactor=[${colour}]`
    );
  });

  (json.images || []).forEach((img, i) => {
    // An embedded image has bufferView; an external one has a uri that must be
    // fetched separately (and would 404 next to a .glb served alone).
    const where = img.uri ? `EXTERNAL uri="${img.uri}"` : `embedded (bufferView ${img.bufferView})`;
    console.log(`  image[${i}] ${where} ${img.mimeType || ''}`);
  });

  // A material can point at a texture and STILL render white when the mesh has
  // no TEXCOORD_0 (UV) attribute — a classic trimesh export result.
  for (const mesh of json.meshes || []) {
    for (const [p, prim] of (mesh.primitives || []).entries()) {
      const attrs = Object.keys(prim.attributes || {});
      console.log(`  primitive[${p}] attributes: ${attrs.join(', ')}`);
      if (!attrs.includes('TEXCOORD_0')) {
        console.log('    >>> NO TEXCOORD_0: the texture can never be mapped — renders WHITE');
      }
      if (!attrs.includes('NORMAL')) {
        console.log('    >>> NO NORMAL: lighting will look flat/washed out');
      }
    }
  }

  // How the scene orients the mesh (trimesh is Z-up, glTF expects Y-up).
  (json.nodes || []).forEach((n, i) => {
    const parts = [];
    if (n.matrix) parts.push('matrix');
    if (n.rotation) parts.push(`rotation=[${n.rotation.map((v) => v.toFixed(2)).join(', ')}]`);
    if (n.scale) parts.push(`scale=[${n.scale.map((v) => v.toFixed(3)).join(', ')}]`);
    console.log(`  node[${i}] "${n.name || '-'}" ${parts.join(' ') || 'identity transform'}`);
  });

  // Real-world size: POSITION accessors carry min/max in metres.
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
    const widest = Math.max(...dims.map(Number));
    if (widest > 1.5 || widest < 0.05) {
      console.log(
        `  WARNING: widest side is ${widest} units. A real pizza is ~0.30 m — in AR this dish would look ${widest > 1.5 ? 'gigantic' : 'like a crumb'}.`
      );
    }
  }
}

async function main() {
  const restaurant = await (await fetch(`${BASE}/api/menu/restaurant/slug/${SLUG}`)).json();
  const menu = await (await fetch(`${BASE}/api/menu/restaurant/${restaurant._id || restaurant.id}`)).json();

  const withModel = (menu.dishes || []).filter((d) => d.model3D?.url);
  if (!withModel.length) {
    console.log('No dish has a 3D model.');
    return;
  }
  for (const dish of withModel) {
    const url = dish.model3D.url.startsWith('http') ? dish.model3D.url : `${BASE}${dish.model3D.url}`;
    await inspect(url, dish.nameAr || dish.name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
