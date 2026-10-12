'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  X, AlertTriangle, CheckCircle2, Loader2, ChevronDown, ChevronUp,
  ExternalLink, Clock, BookOpen,
} from 'lucide-react'

interface DiscrepancyEntry {
  id: string
  date: string
  agency_hours: number
  diary_hours: number
  diff: number
  signed_off_by: string | null
  signed_off_at: string | null
  signed_off_name: string | null
}

interface PersonRow {
  person_id: string | null
  person_name: string
  person: { id: string; name: string; role: string | null; company: string | null } | null
  entries: DiscrepancyEntry[]
}

interface Props {
  siteId: string
  weekStart: string
  weekEnd: string
  onClose: () => void
}

export default function DiscrepancyReviewModal({ siteId, weekStart, weekEnd, onClose }: Props) {
  const [rows, setRows] = useState<PersonRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [signingOff, setSigningOff] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/construction/${siteId}/timesheets/discrepancies?weekStart=${weekStart}&weekEnd=${weekEnd}`)
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false) })
  }, [siteId, weekStart, weekEnd])

  function toggle(key: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function signOffAll(personKey: string, entryIds: string[]) {
    setSigningOff(personKey)
    await Promise.all(entryIds.map(id =>
      fetch(`/api/team/timesheet-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signoff' }),
      })
    ))
    // Refresh
    const res = await fetch(`/api/construction/${siteId}/timesheets/discrepancies?weekStart=${weekStart}&weekEnd=${weekEnd}`)
    setRows(await res.json())
    setSigningOff(null)
  }

  const allSignedOff = rows.every(r => r.entries.every(e => e.signed_off_by))
  const signedOffCount = rows.reduce((n, r) => n + r.entries.filter(e => e.signed_off_by).length, 0)
  const totalCount = rows.reduce((n, r) => n + r.entries.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: 'var(--border)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Hour Discrepancies
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Week ending {new Date(weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              {!loading && ` · ${signedOffCount}/${totalCount} signed off`}
            </p>
          </div>
          <button onClick={onClose} className="hover:opacity-70 p-1" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Progress bar */}
        {!loading && totalCount > 0 && (
          <div className="px-5 pt-3 pb-1 shrink-0">
            <div className="flex items-center justify-between text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
              <span>Sign-off progress</span>
              <span>{Math.round((signedOffCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${(signedOffCount / totalCount) * 100}%`, background: '#4ade80' }} />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="animate-spin" /> Loading discrepancies…
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <CheckCircle2 size={24} style={{ color: '#4ade80' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No discrepancies</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>All hours match diary records</p>
            </div>
          )}

          {rows.map(row => {
            const key = row.person_id ?? row.person_name
            const isOpen = expanded.has(key)
            const totalAgency = row.entries.reduce((s, e) => s + e.agency_hours, 0)
            const totalDiary = row.entries.reduce((s, e) => s + e.diary_hours, 0)
            const totalDiff = Math.round((totalAgency - totalDiary) * 10) / 10
            const allRowSignedOff = row.entries.every(e => e.signed_off_by)
            const isSigning = signingOff === key
            const unsignedIds = row.entries.filter(e => !e.signed_off_by).map(e => e.id)

            return (
              <div key={key} className="rounded-xl border overflow-hidden"
                style={{ borderColor: allRowSignedOff ? '#4ade8033' : '#fb923c44', background: 'var(--bg-elevated)' }}>

                {/* Person header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: allRowSignedOff ? '#4ade8066' : '#fb923c66' }}>
                    {(row.person?.name ?? row.person_name)[0].toUpperCase()}
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {row.person?.name ?? row.person_name}
                      </p>
                      {row.person_id && (
                        <Link href={`/team?person=${row.person_id}`} target="_blank"
                          className="shrink-0 hover:opacity-70" style={{ color: 'var(--text-muted)' }}
                          title="Open staff card">
                          <ExternalLink size={11} />
                        </Link>
                      )}
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      {row.person?.role ?? 'Unknown role'}{row.person?.company ? ` · ${row.person.company}` : ''}
                    </p>
                  </div>

                  {/* Hour totals */}
                  <div className="text-right shrink-0 mr-2">
                    <div className="flex items-center gap-3 text-xs">
                      <div className="text-center">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{totalAgency}h</p>
                        <p style={{ color: 'var(--text-muted)' }}>agency</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{totalDiary}h</p>
                        <p style={{ color: 'var(--text-muted)' }}>diary</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold" style={{ color: totalDiff > 0 ? '#fb923c' : '#f87171' }}>
                          {totalDiff > 0 ? '+' : ''}{totalDiff}h
                        </p>
                        <p style={{ color: 'var(--text-muted)' }}>diff</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {allRowSignedOff ? (
                      <div className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg"
                        style={{ background: '#4ade8022', color: '#4ade80' }}>
                        <CheckCircle2 size={11} /> Signed off
                      </div>
                    ) : (
                      <button
                        disabled={isSigning}
                        onClick={() => signOffAll(key, unsignedIds)}
                        className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: '#fff' }}>
                        {isSigning ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                        Sign off
                      </button>
                    )}
                    <button onClick={() => toggle(key)} className="hover:opacity-70"
                      style={{ color: 'var(--text-muted)' }}>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded per-day breakdown */}
                {isOpen && (
                  <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="px-4 py-2 grid grid-cols-5 text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--text-muted)' }}>
                      <span className="col-span-2">Date</span>
                      <span className="text-right">Agency</span>
                      <span className="text-right">Diary</span>
                      <span className="text-right">Diff</span>
                    </div>
                    {row.entries.map(e => (
                      <div key={e.id} className="px-4 py-2 grid grid-cols-5 text-xs border-t items-center"
                        style={{ borderColor: 'var(--border)' }}>
                        <span className="col-span-2" style={{ color: 'var(--text-muted)' }}>
                          {new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </span>
                        <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                          <Clock size={9} className="inline mr-0.5 mb-0.5" style={{ color: 'var(--accent)' }} />
                          {e.agency_hours}h
                        </span>
                        <span className="text-right font-medium" style={{ color: 'var(--text-primary)' }}>
                          <BookOpen size={9} className="inline mr-0.5 mb-0.5" style={{ color: 'var(--text-muted)' }} />
                          {e.diary_hours}h
                        </span>
                        <span className="text-right font-semibold"
                          style={{ color: e.diff > 0 ? '#fb923c' : '#f87171' }}>
                          {e.diff > 0 ? '+' : ''}{e.diff}h
                        </span>
                      </div>
                    ))}
                    {/* Signed-off note */}
                    {row.entries.some(e => e.signed_off_by) && (
                      <div className="px-4 py-2 border-t text-[10px]"
                        style={{ borderColor: 'var(--border)', color: '#4ade80' }}>
                        {row.entries.find(e => e.signed_off_by)?.signed_off_name ?? 'Manager'} signed off
                        {row.entries.find(e => e.signed_off_at)?.signed_off_at
                          ? ` · ${new Date(row.entries.find(e => e.signed_off_at)!.signed_off_at!).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {!loading && rows.length > 0 && (
          <div className="px-5 py-3 border-t shrink-0 flex items-center justify-between"
            style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {allSignedOff ? 'All discrepancies signed off' : `${rows.length - rows.filter(r => r.entries.every(e => e.signed_off_by)).length} people awaiting sign-off`}
            </p>
            <button onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
