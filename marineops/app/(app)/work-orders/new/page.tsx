import { createClient } from '@/lib/supabase/server'
import WorkOrderForm from '@/components/WorkOrderForm'
import Link from 'next/link'

export default async function NewWorkOrderPage() {
  const supabase = await createClient()
  const { data: vessels } = await supabase.from('vessels').select('*').eq('status', 'active').order('name')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/work-orders" style={{ color: 'var(--accent)' }}>Work Orders</Link>
        <span>/</span>
        <span>New</span>
      </div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>New Work Order</h1>
      <WorkOrderForm vessels={(vessels ?? []) as any} />
    </div>
  )
}
