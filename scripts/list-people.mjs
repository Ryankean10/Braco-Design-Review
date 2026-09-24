import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([^#=]+)=(.*)$/)
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
const { data } = await sb.from('people').select('id,name,company,person_group,is_active').order('name')
for (const p of data) console.log(`${p.is_active ? '✓' : '✗'} ${p.name.padEnd(30)} | ${(p.company||'').padEnd(20)} | ${p.person_group||''}`)
