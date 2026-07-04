'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, FolderOpen, BookOpen, LogOut, ChevronRight, Users, HardHat, ClipboardList, UsersRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const NAV = [
  { href: '/dashboard',         label: 'Dashboard',        icon: LayoutDashboard, roles: null },
  { href: '/projects',          label: 'Projects',         icon: FolderOpen,      roles: null },
  { href: '/construction',       label: 'Construction',     icon: HardHat,         roles: ['admin', 'engineer', 'project_manager', 'operative'] },
  { href: '/reference-library', label: 'Reference Library',icon: BookOpen,        roles: null },
  { href: '/planning',           label: 'Work Planner',     icon: ClipboardList,   roles: ['admin', 'engineer', 'project_manager'] },
  { href: '/team',              label: 'Team',             icon: UsersRound,      roles: ['admin', 'engineer', 'project_manager'] },
  { href: '/users',             label: 'Users',            icon: Users,           roles: ['admin'] },
]

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const role = profile?.role ?? 'engineer'

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside
      className="w-56 flex flex-col shrink-0 border-r"
      style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--border)' }}>
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          B
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            Safe T Projects
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>BESS Project Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV.filter(({ roles }) => !roles || roles.includes(role)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                background: active ? 'rgba(108,114,245,0.12)' : 'transparent',
              }}
            >
              <Icon size={15} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 px-2 mb-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {profile?.full_name?.[0]?.toUpperCase() ?? profile?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {profile?.full_name ?? profile?.email}
            </p>
            <p className="text-[10px] capitalize" style={{ color: 'var(--text-muted)' }}>
              {profile?.role ?? 'engineer'}
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
