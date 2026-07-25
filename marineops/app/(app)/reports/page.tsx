import Link from 'next/link'
import { BarChart2, ClipboardList, Wrench, DollarSign, Award, Package, FolderOpen } from 'lucide-react'

const REPORTS = [
  { title: 'Audit Log', desc: 'Complete tamper-evident change history', href: '/reports/audit', icon: ClipboardList },
  { title: 'Maintenance History', desc: 'Work completed per vessel and period', href: '/reports/maintenance', icon: Wrench },
  { title: 'Cost Analysis', desc: 'Budget vs actual spend breakdown', href: '/reports/costs', icon: DollarSign },
  { title: 'Certificate Status', desc: 'Full fleet certificate report', href: '/reports/certificates', icon: Award },
  { title: 'Inventory Valuation', desc: 'Stock levels and valuation by vessel', href: '/reports/inventory', icon: Package },
  { title: 'Document Register', desc: 'Complete document library export', href: '/reports/documents', icon: FolderOpen },
]

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Reports</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Fleet management reports and audit tools
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {REPORTS.map(r => {
          const Icon = r.icon
          return (
            <Link key={r.href} href={r.href}
                  className="rounded-xl p-5 flex items-start gap-4 hover:ring-1 transition-all"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                   style={{ background: 'var(--accent)18' }}>
                <Icon size={18} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{r.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
