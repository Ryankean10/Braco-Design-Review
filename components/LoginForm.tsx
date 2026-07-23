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
  loginBg?: string
}

export default function LoginForm({ companyName, companySlug, logoUrl, accentColor, loginBg = 'dark' }: Props) {
  const isLight = loginBg === 'light'
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

  const pageBg    = isLight ? '#f0f4f8' : 'var(--bg-base)'
  const cardBg    = isLight ? '#ffffff' : 'var(--bg-surface)'
  const cardBorder = isLight ? '#e2e8f0' : 'var(--border)'
  const inputBg   = isLight ? '#f8fafc' : 'var(--bg-elevated)'
  const inputBorder = isLight ? '#cbd5e1' : 'var(--border)'
  const textPrimary = isLight ? '#1e3a6b' : 'var(--text-primary)'
  const textMuted   = isLight ? '#4a5e8a' : 'var(--text-muted)'

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: pageBg }}>
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
          <h1 className="text-xl font-semibold" style={{ color: textPrimary }}>{companyName}</h1>
          <p className="text-sm mt-1" style={{ color: textMuted }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6 border" style={{ background: cardBg, borderColor: cardBorder }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: textMuted }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: textMuted }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={{ background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary }}
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

        <p className="text-center text-xs mt-4" style={{ color: textMuted }}>
          Invite-only access. Contact your administrator.
        </p>
      </div>
    </div>
  )
}
