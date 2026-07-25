'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Anchor, LayoutDashboard, Ship, Wrench, AlertTriangle,
  Package, ShoppingCart, DollarSign, Award, Calendar,
  Users, FolderOpen, BarChart2, ClipboardList, ChevronRight
} from 'lucide-react'
import type { Profile } from '@/lib/types'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  exact?: boolean
}

interface NavGroup {
  title?: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Fleet Overview', href: '/dashboard', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: 'VESSELS',
    items: [
      { label: 'All Vessels', href: '/vessels', icon: Ship },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { label: 'Work Orders', href: '/work-orders', icon: Wrench },
      { label: 'Defects / NCRs', href: '/defects', icon: AlertTriangle },
    ],
  },
  {
    title: 'SUPPLY CHAIN',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Package },
      { label: 'Purchasing', href: '/purchasing', icon: ShoppingCart },
    ],
  },
  {
    title: 'FINANCE',
    items: [
      { label: 'Budget & Costs', href: '/budget', icon: DollarSign },
    ],
  },
  {
    title: 'COMPLIANCE',
    items: [
      { label: 'Certificates', href: '/certificates', icon: Award },
      { label: 'Surveys', href: '/surveys', icon: Calendar },
      { label: 'Crew', href: '/crew', icon: Users },
    ],
  },
  {
    title: 'DOCUMENTS',
    items: [
      { label: 'Documents', href: '/documents', icon: FolderOpen },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { label: 'Reports', href: '/reports', icon: BarChart2 },
      { label: 'Audit Log', href: '/reports/audit', icon: ClipboardList },
    ],
  },
]

interface Props {
  profile: Profile | null
}

export default function Sidebar({ profile }: Props) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-full overflow-y-auto"
           style={{ background: 'var(--bg-sidebar)', borderRight: '1px solid var(--sidebar-border)' }}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4"
           style={{ borderBottom: '1px solid var(--sidebar-border)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'var(--accent)' }}>
          <Anchor size={16} color="white" />
        </div>
        <span className="font-bold text-sm" style={{ color: 'var(--sidebar-text)' }}>MarineOps</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="px-2 pb-1 text-xs font-semibold tracking-widest"
                 style={{ color: 'var(--sidebar-muted)' }}>
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(item => {
                const active = isActive(item.href, item.exact)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors"
                      style={{
                        background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
                      }}
                    >
                      <Icon size={15} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight size={12} style={{ color: 'var(--sidebar-active-text)' }} />}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User */}
      {profile && (
        <div className="px-3 py-3" style={{ borderTop: '1px solid var(--sidebar-border)' }}>
          <p className="text-xs font-medium truncate" style={{ color: 'var(--sidebar-text)' }}>
            {profile.full_name ?? profile.email}
          </p>
          <p className="text-xs capitalize" style={{ color: 'var(--sidebar-muted)' }}>{profile.role}</p>
        </div>
      )}
    </aside>
  )
}
