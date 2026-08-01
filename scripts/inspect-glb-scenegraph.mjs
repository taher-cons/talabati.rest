import { readFileSync } from 'node:fs';

const file = process.argv[2];
const buf = readFileSync(file);
const jsonLength = buf.readUInt32LE(12);
const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'));

console.log('scene index:', json.scene);
console.log('scenes:', JSON.stringify(json.scenes, null, 2));
console.log('\nnodes:');
json.nodes.forEach((n, i) => {
  console.log(`  [${i}] name="${n.name}" children=${JSON.stringify(n.children || [])} mesh=${n.mesh}`);
});
