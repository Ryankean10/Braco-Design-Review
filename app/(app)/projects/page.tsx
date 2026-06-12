import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, FolderOpen } from 'lucide-react'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Projects</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {projects?.length ?? 0} project{projects?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/projects/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={15} />
          New project
        </Link>
      </div>

      <div className="rounded-xl border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        {!projects?.length ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FolderOpen size={36} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No projects yet</p>
            <Link
              href="/projects/new"
              className="text-sm px-4 py-2 rounded-lg text-white"
              style={{ background: 'var(--accent)' }}
            >
              Create your first project
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div
              className="grid grid-cols-12 px-6 py-2.5 text-xs font-medium border-b"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
            >
              <span className="col-span-4">Project</span>
              <span className="col-span-3">Client</span>
              <span className="col-span-2">Location</span>
              <span className="col-span-1 text-right">MW</span>
              <span className="col-span-2 text-right">Stage</span>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {projects.map(p => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="grid grid-cols-12 px-6 py-3.5 items-center hover:opacity-80 transition-opacity"
                >
                  <span className="col-span-4 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {p.name}
                  </span>
                  <span className="col-span-3 text-sm" style={{ color: 'var(--text-muted)' }}>{p.client}</span>
                  <span className="col-span-2 text-sm" style={{ color: 'var(--text-muted)' }}>{p.location}</span>
                  <span className="col-span-1 text-sm text-right" style={{ color: 'var(--text-muted)' }}>
                    {p.capacity_mw ?? '—'}
                  </span>
                  <span className="col-span-2 flex justify-end">
                    <span className="chip-stage px-2.5 py-0.5 rounded-full text-xs font-medium">{p.stage}</span>
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
