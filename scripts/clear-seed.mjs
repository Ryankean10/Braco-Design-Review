import { createClient } from '@supabase/supabase-js'
const sb = createClient('https://ofsvphmnutdwtawhdzge.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const SITE = '00000000-0000-0000-0000-000000000001'

let r = await sb.from('cable_activities').delete().eq('site_id', SITE)
console.log('cable_activities:', r.error?.message ?? 'cleared')
r = await sb.from('cable_items').delete().eq('site_id', SITE)
console.log('cable_items:', r.error?.message ?? 'cleared')
r = await sb.from('construction_packages').delete().eq('site_id', SITE)
console.log('packages:', r.error?.message ?? 'cleared')
r = await sb.from('construction_sites').delete().eq('id', SITE)
console.log('site:', r.error?.message ?? 'cleared')
console.log('Done.')


