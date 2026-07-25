import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import VesselTabNav from '@/components/VesselTabNav'
import StatusBadge from '@/components/StatusBadge'
import type { TrafficLight } from '@/lib/types'

function vesselStatusLight(status: string): TrafficLight {
  if (status === 'active') return 'green'
  if (status === 'refit') return 'amber'
  return 'neutral'
}

export default async function VesselLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: vessel } = await supabase
    .from('vessels')
    .select('id,name,status,vessel_type,flag,class_society')
    .eq('id', id)
    .single()

  if (!vessel) notFound()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-5 pb-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          <Link href="/vessels" style={{ color: 'var(--accent)' }}>Vessels</Link>
          <span>/</span>
          <span style={{ color: 'var(--text-primary)' }}>{vessel.name}</span>
        </div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{vessel.name}</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {vessel.vessel_type} · {vessel.flag}
              {vessel.class_society && vessel.class_society !== 'None' ? ` · ${vessel.class_society}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={vesselStatusLight(vessel.status)} label={vessel.status} />
            <Link href={`/vessels/${id}/edit`}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Edit
            </Link>
          </div>
        </div>
        <VesselTabNav vesselId={id} />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}
