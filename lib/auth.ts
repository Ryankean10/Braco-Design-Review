import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'engineer' | 'project_manager' | 'operative' | 'client'

const INTERNAL_ROLES: Role[] = ['admin', 'engineer', 'project_manager', 'operative']
const MANAGER_ROLES: Role[] = ['admin', 'engineer', 'project_manager']

/**
 * Verify the request user is authenticated and has one of the allowed roles.
 * Returns { user, profile, role } on success, or a NextResponse 401/403 on failure.
 */
export async function requireRole(allowed: Role[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorised' }, { status: 401 }) }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'client') as Role

  if (!allowed.includes(role)) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { user, profile, role }
}

export { INTERNAL_ROLES, MANAGER_ROLES }
