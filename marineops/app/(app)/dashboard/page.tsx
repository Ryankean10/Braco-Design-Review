import { createClient } from '@/lib/supabase/server'
import KPICard from '@/components/KPICard'
import StatusBadge from '@/components/StatusBadge'
import { Ship, Wrench, Award, DollarSign, Package, AlertTriangle, Clock } from 'lucide-react'
import Link from 'next/link'
import type { TrafficLight } from '@/lib/types'
import { KPI_THRESHOLDS } from '@/lib/constants'

function kpiStatus(value: number, thresholds: { amber: number; red: number }, invert = false): TrafficLight {
  if (invert) {
    if (value < thresholds.amber) return 'green'
    if (value < thresholds.red) return 'amber'
    return 'red'
  }
  if (value >= thresholds.amber) return 'green'
  if (value >= thresholds.red) return 'amber'
  return 'red'
}

function countStatus(count: number, amber: number, red: number): TrafficLight {
  if (count === 0) return 'green'
  if (count <= amber) return 'amber'
  return 'red'
}

function woStatusColor(status: string): string {
  const map: Record<string, string> = {
    open: 'var(--accent)',
    in_progress: 'var(--minor)',
    completed: 'var(--success)',
    draft: 'var(--text-muted)',
    cancelled: 'var(--text-muted)',
  }
  return map[status] ?? 'var(--text-muted)'
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  const [
    { data: vessels },
    { data: overdueJobs },
    { data: openWOs },
    { data: expiringCerts },
    { data: allStock },
    { data: openNcrs },
    { data: recentWOs },
  ] = await Promise.all([
    supabase.from('vessels').select('id,name,vessel_type,status,flag,class_society').eq('status', 'active'),
    supabase.from('maintenance_jobs').select('id').lt('next_due_date', today).eq('status', 'active'),
    supabase.from('work_orders').select('id,title,status,vessel_id,wo_number,planned_date').in('status', ['open','in_progress']),
    supabase.from('certificates').select('id').lt('expiry_date', in90).gte('expiry_date', today),
    supabase.from('inventory').select('quantity,min_quantity'),
    supabase.from('defects').select('id').in('severity', ['critical','major']).eq('status', 'open'),
    supabase.from('work_orders').select('id,title,status,wo_number,planned_date,vessel_id').order('created_at', { ascending: false }).limit(8),
  ])

  const criticalStockCount = (allStock ?? []).filter(s => s.quantity <= s.min_quantity).length

  const vesselCount = vessels?.length ?? 0
  const overdueCount = overdueJobs?.length ?? 0
  const certCount = expiringCerts?.length ?? 0
  const ncrCount = openNcrs?.length ?? 0

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Fleet Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {vesselCount} active vessel{vesselCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          title="Overdue Jobs"
          value={overdueCount}
          subtitle="past due date"
          icon={Wrench}
          status={countStatus(overdueCount, KPI_THRESHOLDS.overdueJobs.amber, KPI_THRESHOLDS.overdueJobs.red)}
        />
        <KPICard
          title="Open Work Orders"
          value={openWOs?.length ?? 0}
          subtitle="fleet-wide"
          icon={Clock}
          status={countStatus(openWOs?.length ?? 0, 5, 15)}
        />
        <KPICard
          title="Cert Expiries"
          value={certCount}
          subtitle="within 90 days"
          icon={Award}
          status={countStatus(certCount, KPI_THRESHOLDS.expiringCerts.amber, KPI_THRESHOLDS.expiringCerts.red)}
        />
        <KPICard
          title="Critical Stock"
          value={criticalStockCount}
          subtitle="below minimum"
          icon={Package}
          status={countStatus(criticalStockCount, KPI_THRESHOLDS.criticalStock.amber, KPI_THRESHOLDS.criticalStock.red)}
        />
        <KPICard
          title="Open NCRs"
          value={ncrCount}
          subtitle="critical & major"
          icon={AlertTriangle}
          status={countStatus(ncrCount, KPI_THRESHOLDS.openNcrs.amber, KPI_THRESHOLDS.openNcrs.red)}
        />
        <KPICard
          title="Active Vessels"
          value={vesselCount}
          subtitle="in fleet"
          icon={Ship}
          status="neutral"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vessel Fleet */}
        <div className="lg:col-span-2 rounded-xl p-5"
             style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Vessels</h2>
            <Link href="/vessels/new" className="text-xs px-3 py-1.5 rounded-lg font-medium text-white"
                  style={{ background: 'var(--accent)' }}>+ Add Vessel</Link>
          </div>
          <div className="space-y-2">
            {(vessels ?? []).map(v => (
              <Link key={v.id} href={`/vessels/${v.id}`}
                    className="flex items-center justify-between p-3 rounded-lg transition-colors"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                       style={{ background: 'var(--accent)18' }}>
                    <Ship size={14} style={{ color: 'var(--accent)' }} />
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{v.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {v.vessel_type} · {v.flag} {v.class_society && v.class_society !== 'None' ? `· ${v.class_society}` : ''}
                    </p>
                  </div>
                </div>
                <StatusBadge status={v.status === 'active' ? 'green' : 'amber'} label={v.status} />
              </Link>
            ))}
            {(!vessels || vessels.length === 0) && (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No vessels yet</p>
                <Link href="/vessels/new" className="text-sm mt-2 inline-block" style={{ color: 'var(--accent)' }}>
                  Add your first vessel
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Work Orders */}
        <div className="rounded-xl p-5"
             style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Work Orders</h2>
            <Link href="/work-orders" className="text-xs" style={{ color: 'var(--accent)' }}>View all</Link>
          </div>
          <div className="space-y-2">
            {(recentWOs ?? []).map(wo => (
              <Link key={wo.id} href={`/work-orders/${wo.id}`}
                    className="block p-2.5 rounded-lg"
                    style={{ background: 'var(--bg-elevated)' }}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{wo.title}</p>
                  <span className="text-xs shrink-0 font-medium" style={{ color: woStatusColor(wo.status) }}>
                    {wo.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{wo.wo_number}</p>
              </Link>
            ))}
            {(!recentWOs || recentWOs.length === 0) && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>No work orders</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
