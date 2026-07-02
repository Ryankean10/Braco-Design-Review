import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const supabase = createClient(
  'https://ofsvphmnutdwtawhdzge.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const sql = readFileSync('supabase/migrations/022b_dyce_seed.sql', 'utf8')

// Split into site+packages, cables, activities
const parts = sql.split(/(?=-- ── (Cable items|Cable activities))/i)

for (let i = 0; i < parts.length; i++) {
  const part = parts[i].trim()
  if (!part) continue
  console.log(`Running part ${i+1}/${parts.length} (${part.length} chars)...`)
  const { error } = await supabase.rpc('exec_sql', { sql: part })
  if (error) {
    console.error('Error on part', i+1, ':', error.message)
    process.exit(1)
  }
  console.log(`Part ${i+1} OK`)
}
