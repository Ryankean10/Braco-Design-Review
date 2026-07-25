import Link from 'next/link'
import VesselForm from '@/components/VesselForm'

export default function NewVesselPage() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <Link href="/vessels" style={{ color: 'var(--accent)' }}>Vessels</Link>
        <span>/</span>
        <span>New Vessel</span>
      </div>
      <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Add Vessel</h1>
      <VesselForm />
    </div>
  )
}
