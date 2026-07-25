import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import VesselForm from '@/components/VesselForm'
import Link from 'next/link'

export default async function EditVesselPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: vessel } = await supabase.from('vessels').select('*').eq('id', id).single()

  if (!vessel) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Link href={`/vessels/${id}`} style={{ color: 'var(--accent)' }}>Overview</Link>
        <span>/</span>
        <span>Edit</span>
      </div>
      <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Edit Vessel</h2>
      <VesselForm vessel={vessel} />
    </div>
  )
}
