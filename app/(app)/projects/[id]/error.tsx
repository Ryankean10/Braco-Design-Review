'use client'

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-8 max-w-xl mx-auto mt-16">
      <div className="rounded-xl border p-6" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#f87171' }}>Unable to load project</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {error.message || 'An unexpected error occurred. Please try reloading.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'var(--accent)' }}
        >
          Reload
        </button>
        {error.digest && (
          <p className="text-xs font-mono mt-3" style={{ color: 'var(--text-muted)' }}>
            Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
