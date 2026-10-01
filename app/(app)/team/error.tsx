'use client'

export default function TeamError({ error }: { error: Error & { digest?: string } }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="max-w-lg w-full mx-4 rounded-xl border p-6" style={{ background: 'var(--surface-raised)', borderColor: 'var(--border)' }}>
        <h2 className="text-base font-semibold mb-2" style={{ color: '#f87171' }}>Team page error</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {error.message || 'An unexpected error occurred loading the team page.'}
        </p>
        {error.digest && (
          <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            Digest: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
