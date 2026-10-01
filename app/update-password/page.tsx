'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function UpdatePasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [ready, setReady]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  useEffect(() => {
    const supabase = createClient()
    // Supabase puts access_token + type=recovery in the URL hash after redirect
    const hash = window.location.hash
    const params = new URLSearchParams(hash.replace('#', ''))
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type')

    if (accessToken && (type === 'recovery' || type === 'invite')) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' })
        .then(() => setReady(true))
        .catch(() => setError('Invalid or expired link. Please request a new one.'))
    } else {
      // No hash — check if we already have a session (user landed here directly)
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setReady(true)
        else setError('No valid session. Please use the link from your invitation email.')
      })
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { error: updateErr } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateErr) { setError(updateErr.message); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="w-full max-w-sm rounded-2xl p-8" style={{ background: '#1e293b', border: '1px solid #334155' }}>
        <h1 className="text-xl font-semibold text-white mb-2">Set your password</h1>
        <p className="text-sm mb-6" style={{ color: '#94a3b8' }}>Choose a password to secure your account.</p>

        {done ? (
          <p className="text-sm" style={{ color: '#4ade80' }}>Password set — redirecting you to the dashboard…</p>
        ) : !ready && !error ? (
          <p className="text-sm" style={{ color: '#94a3b8' }}>Verifying link…</p>
        ) : error && !ready ? (
          <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#94a3b8' }}>New password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2"
                style={{ background: '#0f172a', border: '1px solid #334155' }}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: '#94a3b8' }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
                className="w-full rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2"
                style={{ background: '#0f172a', border: '1px solid #334155' }}
              />
            </div>
            {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
            <button
              type="submit"
              disabled={saving || !password || !confirm}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
              style={{ background: '#3b82f6' }}>
              {saving ? 'Saving…' : 'Set password & log in'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
