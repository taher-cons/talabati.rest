import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('c:/web-ar-menu/.env', 'utf8').split(/\r?\n/).reduce((a, l) => {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) a[m[1]] = m[2].replace(/^["']|["']$/g, '');
  return a;
}, {});

const db = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await db
  .from('dishes')
  .select('id,name,name_ar,model3d,menu_id,is_available')
  .order('name');

if (error) {
  console.error(error);
  process.exit(1);
}

data.forEach((d) => {
  console.log(
    d.id,
    '|',
    d.name_ar || d.name,
    '| model:',
    d.model3d ? d.model3d.url : null,
    '| available:',
    d.is_available
  );
});
