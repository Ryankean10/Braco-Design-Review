'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  vesselId: string
}

const TABS = [
  { label: 'Overview', suffix: '' },
  { label: 'Equipment', suffix: '/equipment' },
  { label: 'Maintenance', suffix: '/maintenance' },
  { label: 'Inventory', suffix: '/inventory' },
  { label: 'Documents', suffix: '/documents' },
  { label: 'Crew', suffix: '/crew' },
  { label: 'Certificates', suffix: '/certificates' },
  { label: 'Budget', suffix: '/budget' },
  { label: 'Defects', suffix: '/defects' },
]

export default function VesselTabNav({ vesselId }: Props) {
  const pathname = usePathname()
  const base = `/vessels/${vesselId}`

  return (
    <div className="flex gap-1 overflow-x-auto"
         style={{ borderBottom: '1px solid var(--border)' }}>
      {TABS.map(tab => {
        const href = base + tab.suffix
        const active = tab.suffix === ''
          ? pathname === base || pathname === base + '/'
          : pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={tab.suffix}
            href={href}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px"
            style={{
              color: active ? 'var(--accent)' : 'var(--text-muted)',
              borderBottomColor: active ? 'var(--accent)' : 'transparent',
            }}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
