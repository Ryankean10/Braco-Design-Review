'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  companyId: string
  initial: { warn_days_1: number; warn_days_2: number; alert_email: string | null }
}

export default function ComplianceSettingsClient({ companyId, initial }: Props) {
  const [warnDays1, setWarnDays1] = useState(initial.warn_days_1 ?? 60)
  const [warnDays2, setWarnDays2] = useState(initial.warn_days_2 ?? 30)
  const [alertEmail, setAlertEmail] = useState(initial.alert_email ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)

    const supabase = createClient()
    const { error: err } = await supabase
      .from('company_compliance_settings')
      .upsert({
        company_id: companyId,
        warn_days_1: warnDays1,
        warn_days_2: warnDays2,
        alert_email: alertEmail || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'company_id' })

    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const fieldStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <form onSubmit={save} className="rounded-xl border p-6 space-y-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          First warning (days before expiry)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={warnDays1}
          onChange={e => setWarnDays1(Number(e.target.value))}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={fieldStyle}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Amber warning this many days before expiry. Default: 60 days.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Final warning (days before expiry)
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={warnDays2}
          onChange={e => setWarnDays2(Number(e.target.value))}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={fieldStyle}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Red warning this many days before expiry. Default: 30 days.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Alert email address
        </label>
        <input
          type="email"
          value={alertEmail}
          onChange={e => setAlertEmail(e.target.value)}
          placeholder="e.g. compliance@yourcompany.co.uk"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={fieldStyle}
        />
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          Leave blank to send to the first admin user on this account.
        </p>
      </div>

      {error && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: '#3f1212', color: '#f87171' }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="px-5 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60"
        style={{ background: saved ? '#16a34a' : 'var(--accent)' }}
      >
        {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save settings'}
      </button>
    </form>
  )
}
