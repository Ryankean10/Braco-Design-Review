import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DollarSign } from 'lucide-react'

export default async function BudgetPage() {
  const supabase = await createClient()
  const year = new Date().getFullYear()

  const { data: codes } = await supabase
    .from('budget_utilization')
    .select('*, vessels(name)')
    .eq('year', year)
    .order('code')

  const byVessel = (codes ?? []).reduce<Record<string, typeof codes>>((acc, c) => {
    const name = (c.vessels as any)?.name ?? 'Unknown'
    if (!acc[name]) acc[name] = []
    acc[name]!.push(c)
    return acc
  }, {})

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Budget & Costs {year}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Fleet-wide budget utilization</p>
      </div>

      {Object.entries(byVessel).map(([vesselName, items]) => {
        const totalAlloc = (items ?? []).reduce((s, c) => s + Number(c.allocated_amount), 0)
        const totalSpent = (items ?? []).reduce((s, c) => s + Number(c.spent), 0)
        const pct = totalAlloc > 0 ? (totalSpent / totalAlloc * 100) : 0

        return (
          <div key={vesselName} className="rounded-xl p-5"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{vesselName}</h2>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                ${totalSpent.toLocaleString()} / ${totalAlloc.toLocaleString()} ({pct.toFixed(1)}%)
              </span>
            </div>
            <div className="space-y-3">
              {(items ?? []).map(code => {
                const p = Math.min(Number(code.utilization_pct), 100)
                const over = Number(code.utilization_pct) > 100
                const barColor = over ? 'var(--critical)' : p >= 80 ? 'var(--minor)' : 'var(--success)'
                return (
                  <div key={code.id}>
                    <div className="flex items-center justify-between mb-1 text-xs">
                      <span style={{ color: 'var(--text-primary)' }}>{code.code} — {code.name}</span>
                      <span style={{ color: barColor }}>{Number(code.utilization_pct).toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                      <div className="h-full rounded-full" style={{ width: `${p}%`, background: barColor }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {Object.keys(byVessel).length === 0 && (
        <div className="text-center py-16">
          <DollarSign size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No budget codes for {year}</p>
        </div>
      )}
    </div>
  )
}
