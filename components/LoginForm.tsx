'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'

interface Props {
  companyName: string
  companySlug: string
  logoUrl: string | null
  accentColor: string
}

export default function LoginForm({ companyName, companySlug, logoUrl, accentColor }: Props) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const initial = companyName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm">
        {/* Company branding */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-3">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName}
                className="h-14 w-auto object-contain"
              />
            ) : (
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
                style={{ background: accentColor }}
              >
                {initial}
              </div>
            )}
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{companyName}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6 border" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
              style={{ background: accentColor }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          Invite-only access. Contact your administrator.
        </p>
      </div>
    </div>
  )
}
