import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AlertTriangle, Wrench, Award, Package } from 'lucide-react'

interface AlertPanelProps {
  title: string
  items: { id: string; label: string; sub?: string; href: string }[]
  icon: React.ElementType
  color: string
  emptyMsg: string
}

function AlertPanel({ title, items, icon: Icon, color, emptyMsg }: AlertPanelProps) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={15} style={{ color }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{emptyMsg}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map(item => (
            <li key={item.id}>
              <Link href={item.href} className="block text-xs hover:underline"
                    style={{ color: 'var(--text-primary)' }}>
                {item.label}
                {item.sub && <span style={{ color: 'var(--text-muted)' }}> — {item.sub}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default async function VesselOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

  const [
    { data: vessel },
    { data: equipment },
    { data: overdueJobs },
    { data: openWOs },
    { data: expiringCerts },
    { data: allStock },
    { data: openDefects },
  ] = await Promise.all([
    supabase.from('vessels').select('*').eq('id', id).single(),
    supabase.from('equipment').select('id').eq('vessel_id', id),
    supabase.from('maintenance_jobs').select('id,title').lt('next_due_date', today).eq('vessel_id', id).eq('status', 'active'),
    supabase.from('work_orders').select('id,title,wo_number').eq('vessel_id', id).in('status', ['open','in_progress']),
    supabase.from('certificates').select('id,name,expiry_date').eq('vessel_id', id).lt('expiry_date', in90).gte('expiry_date', today),
    supabase.from('inventory').select('id,name,quantity,min_quantity').eq('vessel_id', id),
    supabase.from('defects').select('id,title,severity').eq('vessel_id', id).in('severity', ['critical','major']).eq('status', 'open'),
  ])

  const lowStock = (allStock ?? []).filter(s => s.quantity <= s.min_quantity)

  if (!vessel) return <p style={{ color: 'var(--text-muted)' }}>Vessel not found</p>

  const rows = [
    ['IMO Number', vessel.imo_number],
    ['MMSI', vessel.mmsi],
    ['Call Sign', vessel.call_sign],
    ['Flag State', vessel.flag],
    ['Port of Registry', vessel.port_of_registry],
    ['Class Society', vessel.class_society],
    ['Class Notation', vessel.class_notation],
    ['GT / NT', vessel.gt ? `${vessel.gt} / ${vessel.nt ?? '—'}` : '—'],
    ['LOA', vessel.loa_m ? `${vessel.loa_m} m` : '—'],
    ['Beam', vessel.beam_m ? `${vessel.beam_m} m` : '—'],
    ['Year Built', vessel.year_built],
    ['Hull Material', vessel.hull_material],
    ['Main Engine', vessel.main_engine_maker ? `${vessel.main_engine_maker} ${vessel.main_engine_model ?? ''}` : '—'],
    ['Owner', vessel.owner],
    ['Operator', vessel.operator],
    ['Manager', vessel.manager],
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Vessel Info */}
        <div className="rounded-xl p-5"
             style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Vessel Details</h2>
          <dl className="space-y-2">
            {rows.map(([k, v]) => v ? (
              <div key={String(k)} className="flex text-sm">
                <dt className="w-40 shrink-0" style={{ color: 'var(--text-muted)' }}>{k}</dt>
                <dd style={{ color: 'var(--text-primary)' }}>{String(v)}</dd>
              </div>
            ) : null)}
          </dl>
        </div>

        {/* Quick stats */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Equipment Items', value: equipment?.length ?? 0, href: `/vessels/${id}/equipment` },
              { label: 'Overdue Jobs', value: overdueJobs?.length ?? 0, href: `/vessels/${id}/maintenance` },
              { label: 'Open Work Orders', value: openWOs?.length ?? 0, href: `/vessels/${id}/maintenance` },
              { label: 'Low Stock Items', value: lowStock.length, href: `/vessels/${id}/inventory` },
            ].map(stat => (
              <Link key={stat.label} href={stat.href}
                    className="rounded-xl p-4 text-center"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
              </Link>
            ))}
          </div>

          {vessel.notes && (
            <div className="rounded-xl p-4"
                 style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>NOTES</h3>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{vessel.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Alert Panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <AlertPanel
          title="Overdue Maintenance"
          items={(overdueJobs ?? []).map(j => ({ id: j.id, label: j.title, href: `/vessels/${id}/maintenance` }))}
          icon={Wrench}
          color="var(--critical)"
          emptyMsg="All jobs up to date"
        />
        <AlertPanel
          title="Open Work Orders"
          items={(openWOs ?? []).map(wo => ({ id: wo.id, label: wo.title, sub: wo.wo_number, href: `/work-orders/${wo.id}` }))}
          icon={Wrench}
          color="var(--minor)"
          emptyMsg="No open work orders"
        />
        <AlertPanel
          title="Expiring Certificates"
          items={(expiringCerts ?? []).map(c => ({ id: c.id, label: c.name, sub: c.expiry_date, href: `/vessels/${id}/certificates` }))}
          icon={Award}
          color="var(--major)"
          emptyMsg="No certificates expiring soon"
        />
        <AlertPanel
          title="Low Stock"
          items={lowStock.map(s => ({ id: s.id, label: s.name, sub: `qty: ${s.quantity}`, href: `/vessels/${id}/inventory` }))}
          icon={Package}
          color="var(--minor)"
          emptyMsg="All stock above minimum"
        />
      </div>

      {openDefects && openDefects.length > 0 && (
        <div className="rounded-xl p-4"
             style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} style={{ color: 'var(--critical)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Open Critical Defects ({openDefects.length})
            </h3>
          </div>
          <ul className="space-y-1">
            {openDefects.map(d => (
              <li key={d.id}>
                <Link href={`/vessels/${id}/defects`} className="text-xs hover:underline"
                      style={{ color: d.severity === 'critical' ? 'var(--critical)' : 'var(--major)' }}>
                  [{d.severity.toUpperCase()}] {d.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
