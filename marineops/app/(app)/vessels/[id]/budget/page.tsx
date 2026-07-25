import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { DollarSign } from 'lucide-react'

export default async function VesselBudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const year = new Date().getFullYear()

  const { data: codes } = await supabase
    .from('budget_utilization')
    .select('*')
    .eq('vessel_id', id)
    .eq('year', year)
    .order('code')

  const totalAllocated = (codes ?? []).reduce((sum, c) => sum + Number(c.allocated_amount), 0)
  const totalSpent = (codes ?? []).reduce((sum, c) => sum + Number(c.spent), 0)
  const overBudget = (codes ?? []).filter(c => Number(c.utilization_pct) > 100)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Budget {year}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            ${totalSpent.toLocaleString()} spent of ${totalAllocated.toLocaleString()} allocated
          </p>
        </div>
        <Link href={`/vessels/${id}/budget/new`}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white"
              style={{ background: 'var(--accent)' }}>
          + Budget Code
        </Link>
      </div>

      {overBudget.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#3f121220', border: '1px solid var(--critical)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--critical)' }}>
            {overBudget.length} budget code{overBudget.length !== 1 ? 's' : ''} over budget:
            {' '}{overBudget.map(c => c.code).join(', ')}
          </p>
        </div>
      )}

      {(!codes || codes.length === 0) && (
        <div className="text-center py-16">
          <DollarSign size={36} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No budget codes for {year}</p>
        </div>
      )}

      <div className="space-y-3">
        {(codes ?? []).map(code => {
          const pct = Math.min(Number(code.utilization_pct), 100)
          const over = Number(code.utilization_pct) > 100
          const barColor = over ? 'var(--critical)' : pct >= 80 ? 'var(--minor)' : 'var(--success)'
          return (
            <div key={code.id} className="rounded-xl p-4"
                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {code.code} — {code.name}
                  </span>
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded badge-neutral">{code.category}</span>
                </div>
                <span className="text-sm font-semibold" style={{ color: barColor }}>
                  {Number(code.utilization_pct).toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                <div className="h-full rounded-full transition-all"
                     style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="flex justify-between text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                <span>Spent: ${Number(code.spent).toLocaleString()}</span>
                <span>Budget: ${Number(code.allocated_amount).toLocaleString()}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
