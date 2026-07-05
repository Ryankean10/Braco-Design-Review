'use client'

import { useState, useEffect } from 'react'
import { Users, CheckCircle2, XCircle, AlertTriangle, ChevronDown, Loader2, Link2 } from 'lucide-react'

interface Person { id: string; name: string; role: string | null; company: string | null }
interface NameRow {
  raw_name: string
  auto_person_id: string | null
  manual_person_id: string | null
  no_match: boolean
  person: Person | null
}

export default function PersonnelMatchPanel({ siteId, people }: { siteId: string; people: Person[] }) {
  const [rows, setRows] = useState<NameRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch(`/api/construction/${siteId}/personnel-matches`)
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false) })
  }, [siteId])

  async function save(rawName: string, personId: string | null, noMatch: boolean) {
    setSaving(rawName)
    const res = await fetch(`/api/construction/${siteId}/personnel-matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_name: rawName, person_id: personId, no_match: noMatch }),
    })
    if (res.ok) {
      setRows(prev => prev.map(r => {
        if (r.raw_name !== rawName) return r
        const p = personId ? people.find(p => p.id === personId) ?? null : null
        return { ...r, manual_person_id: personId, no_match: noMatch, person: p }
      }))
    }
    setSaving(null)
  }

  const unresolved = rows.filter(r => !r.no_match && !r.manual_person_id && !r.auto_person_id)
  const matched    = rows.filter(r => r.manual_person_id || r.auto_person_id)
  const flagged    = rows.filter(r => r.no_match)

  if (loading) return (
    <div className="flex items-center gap-2 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>
      <Loader2 size={13} className="animate-spin" /> Loading diary names…
    </div>
  )

  if (rows.length === 0) return (
    <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
      No diary personnel records found for this site yet.
    </p>
  )

  function RowItem({ row }: { row: NameRow }) {
    const isSaving = saving === row.raw_name
    const resolvedId = row.manual_person_id ?? row.auto_person_id
    const sel = selections[row.raw_name] ?? resolvedId ?? ''

    let statusIcon, statusColor
    if (row.no_match) {
      statusIcon = <XCircle size={13} />; statusColor = '#94a3b8'
    } else if (resolvedId) {
      statusIcon = <CheckCircle2 size={13} />; statusColor = '#4ade80'
    } else {
      statusIcon = <AlertTriangle size={13} />; statusColor = '#fb923c'
    }

    return (
      <div className="flex items-center gap-3 py-2.5 border-b last:border-0 flex-wrap"
        style={{ borderColor: 'var(--border)' }}>
        {/* Status icon */}
        <div style={{ color: statusColor, flexShrink: 0 }}>{statusIcon}</div>

        {/* Raw diary name */}
        <div className="min-w-0 w-40 shrink-0">
          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{row.raw_name}</p>
          {row.manual_person_id && (
            <p className="text-[10px]" style={{ color: '#4ade80' }}>manual match</p>
          )}
          {!row.manual_person_id && row.auto_person_id && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>auto-matched</p>
          )}
        </div>

        {/* Arrow */}
        <Link2 size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />

        {/* Person dropdown */}
        <div className="relative flex-1 min-w-[160px]">
          <select
            value={sel}
            disabled={row.no_match || isSaving}
            onChange={e => setSelections(prev => ({ ...prev, [row.raw_name]: e.target.value }))}
            className="w-full text-xs rounded-lg px-3 py-2 pr-7 appearance-none border"
            style={{
              background: 'var(--bg-elevated)', color: row.no_match ? 'var(--text-muted)' : 'var(--text-primary)',
              borderColor: 'var(--border)', opacity: row.no_match ? 0.5 : 1,
            }}>
            <option value="">— select person —</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.role ? ` · ${p.role}` : ''}{p.company ? ` (${p.company})` : ''}
              </option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--text-muted)' }} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!row.no_match && (
            <button
              disabled={!sel || isSaving}
              onClick={() => save(row.raw_name, sel || null, false)}
              className="text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isSaving ? <Loader2 size={11} className="animate-spin" /> : 'Match'}
            </button>
          )}
          <button
            disabled={isSaving}
            onClick={() => row.no_match
              ? save(row.raw_name, null, false)   // un-flag
              : save(row.raw_name, null, true)    // flag no match
            }
            className="text-xs px-2.5 py-1.5 rounded-lg font-medium border disabled:opacity-40"
            style={{
              borderColor: row.no_match ? 'var(--accent)' : 'var(--border)',
              color: row.no_match ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {row.no_match ? 'Un-flag' : 'No match'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: '#fb923c22', color: '#fb923c' }}>
          {unresolved.length} unresolved
        </span>
        <span className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ background: '#4ade8022', color: '#4ade80' }}>
          {matched.length} matched
        </span>
        {flagged.length > 0 && (
          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
            style={{ background: '#94a3b822', color: '#94a3b8' }}>
            {flagged.length} no match
          </span>
        )}
      </div>

      {/* Unresolved */}
      {unresolved.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#fb923c' }}>
            Unresolved
          </p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#fb923c44', background: 'var(--bg-surface)' }}>
            {unresolved.map(r => <RowItem key={r.raw_name} row={r} />)}
          </div>
        </div>
      )}

      {/* Matched */}
      {matched.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Matched
          </p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            {matched.map(r => <RowItem key={r.raw_name} row={r} />)}
          </div>
        </div>
      )}

      {/* Flagged no match */}
      {flagged.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
            Flagged — no match in library
          </p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}>
            {flagged.map(r => <RowItem key={r.raw_name} row={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
