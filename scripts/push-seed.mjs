import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))

const DB_PASSWORD = process.argv[2]
if (!DB_PASSWORD) {
  console.error('Usage: node scripts/push-seed.mjs <db-password>')
  console.error('Get your password from: Supabase Dashboard > Project Settings > Database > Database password')
  process.exit(1)
}

const client = new pg.Client({
  host: 'db.ofsvphmnutdwtawhdzge.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
})

console.log('Connecting...')
await client.connect()
console.log('Connected.')

const sql = readFileSync(join(__dir, '../supabase/migrations/022b_dyce_seed.sql'), 'utf8')
console.log(`Executing seed (${Math.round(sql.length/1024)}KB)...`)

try {
  await client.query(sql)
  console.log('Seed complete! 298 cables + 1714 activities inserted.')
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
} finally {
  await client.end()
}


