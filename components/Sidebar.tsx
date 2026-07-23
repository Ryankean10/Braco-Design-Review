'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, BookOpen, LogOut, ChevronRight, ChevronDown,
  Users, HardHat, ClipboardList, UsersRound, Bug, Building2, Truck,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Company, Module } from '@/lib/types'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'

const BugPanel = dynamic(() => import('@/components/admin/BugPanel'), { ssr: false })

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  roles?: string[]
  module?: Module
}

const NAV: NavItem[] = [
  { href: '/dashboard',         label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/projects',          label: 'Projects',          icon: FolderOpen,     module: 'projects' },
  { href: '/construction',      label: 'Construction',      icon: HardHat,        module: 'construction', roles: ['superadmin', 'admin', 'engineer', 'project_manager', 'operative'] },
  { href: '/reference-library', label: 'Reference Library', icon: BookOpen,       module: 'reference_library' },
  { href: '/planning',          label: 'Work Planner',      icon: ClipboardList,  module: 'planning',    roles: ['superadmin', 'admin', 'engineer', 'project_manager'] },
  { href: '/team',              label: 'Team',              icon: UsersRound,     module: 'team',        roles: ['superadmin', 'admin', 'engineer', 'project_manager'] },
  { href: '/plant',             label: 'Plant',             icon: Truck,          module: 'plant',       roles: ['superadmin', 'admin', 'engineer', 'project_manager'] },
  { href: '/users',             label: 'Users',             icon: Users,          roles: ['superadmin', 'admin'] },
]

const SUPERADMIN_NAV: NavItem[] = [
  { href: '/admin/companies', label: 'Companies', icon: Building2 },
]

export default function Sidebar({ profile, company }: { profile: Profile | null; company: Company | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const role = profile?.role ?? 'engineer'
  const isSuperadmin = role === 'superadmin'
  const enabledModules = company?.modules ?? []
  const [bugPanelOpen, setBugPanelOpen] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(() =>
    typeof window !== 'undefined' && window.location.pathname.startsWith('/projects')
  )
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('projects')
      .select('id, name')
      .order('name')
      .then(({ data }) => setProjects(data ?? []))
  }, [])

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isVisible(item: NavItem) {
    if (item.roles && !item.roles.includes(role)) return false
    if (item.module && !isSuperadmin && !enabledModules.includes(item.module)) return false
    return true
  }

  const companyInitial = (company?.name ?? 'G')[0].toUpperCase()
  const companyName = company?.name ?? 'MRRK'

  return (
    <aside
      className="w-56 flex flex-col shrink-0 border-r"
      style={{ background: 'var(--bg-sidebar, var(--bg-surface))', borderColor: 'var(--border)', color: 'var(--sidebar-text, inherit)' }}
    >
      {/* Company logo / name */}
      <div className="px-4 py-5 border-b flex items-center gap-2.5" style={{ borderColor: 'var(--border)' }}>
        {company?.logo_url ? (
          <img src={company.logo_url} alt={companyName} className="w-7 h-7 rounded-md object-contain" />
        ) : (
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center text-white font-bold text-xs shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            {companyInitial}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {companyName}
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{company?.tagline ?? 'BESS Project Platform'}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.filter(isVisible).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const isProjects = href === '/projects'

          if (isProjects) {
            return (
              <div key={href}>
                <button
                  onClick={() => { setProjectsOpen(v => !v) }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors w-full text-left"
                  style={{
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    background: active ? 'rgba(108,114,245,0.12)' : 'transparent',
                  }}
                >
                  <Icon size={15} />
                  <Link href="/projects" onClick={e => e.stopPropagation()} className="flex-1">
                    {label}
                  </Link>
                  {projectsOpen
                    ? <ChevronDown size={12} className="ml-auto shrink-0" />
                    : <ChevronRight size={12} className="ml-auto shrink-0" />}
                </button>

                {projectsOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2.5" style={{ borderColor: 'var(--border)' }}>
                    {projects.length === 0 && (
                      <p className="px-2 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>No projects</p>
                    )}
                    {projects.map(p => {
                      const pActive = pathname === `/projects/${p.id}` || pathname.startsWith(`/projects/${p.id}/`)
                      return (
                        <Link
                          key={p.id}
                          href={`/projects/${p.id}`}
                          className="flex items-center px-2 py-1.5 rounded-md text-xs transition-colors truncate"
                          style={{
                            color: pActive ? 'var(--accent)' : 'var(--text-muted)',
                            background: pActive ? 'rgba(108,114,245,0.10)' : 'transparent',
                          }}
                        >
                          {p.name}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

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

        {/* Superadmin section */}
        {isSuperadmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Super Admin
              </p>
            </div>
            {SUPERADMIN_NAV.map(({ href, label, icon: Icon }) => {
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
          </>
        )}
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
        {(role === 'admin' || isSuperadmin) && (
          <button
            onClick={() => setBugPanelOpen(true)}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors hover:opacity-80"
            style={{ color: '#64748b' }}
            title="Bug reports"
          >
            <Bug size={13} />
            Bug reports
          </button>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>
      {bugPanelOpen && <BugPanel onClose={() => setBugPanelOpen(false)} />}
    </aside>
  )
}
