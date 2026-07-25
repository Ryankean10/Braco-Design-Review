import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar } from 'lucide-react'

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-info', in_progress: 'badge-minor', completed: 'badge-success',
  overdue: 'badge-critical', waived: 'badge-neutral',
}

export default async function SurveysPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: surveys } = await supabase
    .from('surveys')
    .select('*, vessels(name)')
    .order('due_date', { ascending: true })

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Surveys</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Class society survey schedule</p>
      </div>

      {(!surveys || surveys.length === 0) && (
        <div className="text-center py-16">
          <Calendar size={40} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No surveys scheduled</p>
        </div>
      )}

      {surveys && surveys.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--bg-elevated)' }}>
                {['Vessel', 'Type', 'Class Society', 'Due Date', 'Window', 'Days', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {surveys.map((s, i) => {
                const days = s.due_date
                  ? Math.ceil((new Date(s.due_date).getTime() - new Date(today).getTime()) / 86400000)
                  : null
                const daysColor = days === null ? 'var(--text-muted)'
                  : days < 0 ? 'var(--critical)'
                  : days < 30 ? 'var(--minor)'
                  : 'var(--success)'
                return (
                  <tr key={s.id}
                      style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {(s.vessels as any)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                      {s.type.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.class_society ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{s.due_date}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {s.window_start && s.window_end ? `${s.window_start} → ${s.window_end}` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: daysColor }}>
                      {days === null ? '—' : days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_BADGE[s.status] ?? 'badge-neutral'}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
