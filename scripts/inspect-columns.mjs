// Throwaway helper: prints the real column names of the pilot tables so seed
// scripts write to fields that actually exist.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

for (const table of ['dishes', 'categories', 'restaurants']) {
  const { data, error } = await db.from(table).select('*').limit(1);
  if (error) { console.log(`${table}: ERROR ${error.message}`); continue; }
  console.log(`\n${table.toUpperCase()}:`);
  console.log(data?.length ? Object.keys(data[0]).join(', ') : '(empty table)');
}
