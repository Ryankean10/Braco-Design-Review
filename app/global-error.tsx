'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#f1f5f9', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '3rem 2rem', maxWidth: 520 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#94a3b8', lineHeight: 1.6, marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={reset}
            style={{ background: '#6c72f5', color: '#fff', border: 'none', borderRadius: '0.5rem', padding: '0.6rem 1.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '1rem', fontFamily: 'monospace' }}>
              {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
