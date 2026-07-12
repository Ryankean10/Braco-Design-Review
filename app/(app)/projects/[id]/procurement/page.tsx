import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ProcurementClient from '@/components/ProcurementClient'

export default async function ProcurementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role === 'client') redirect(`/projects/${id}`)

  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single()
  if (!project) notFound()

  const [{ data: items }, { data: suppliers }] = await Promise.all([
    supabase
      .from('procurement_items')
      .select('*, procurement_quotes(*)')
      .eq('project_id', id)
      .order('category')
      .order('created_at'),
    supabase
      .from('procurement_suppliers')
      .select('*')
      .order('company_name'),
  ])

  const canEdit = ['admin', 'engineer'].includes(profile?.role ?? '')

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/projects/${id}`} className="hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Procurement Register</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{project.name}</p>
        </div>
      </div>

      <ProcurementClient
        projectId={id}
        hasER={!!project.er_storage_path}
        initialItems={items ?? []}
        suppliers={suppliers ?? []}
        canEdit={canEdit}
      />
    </div>
  )
}
