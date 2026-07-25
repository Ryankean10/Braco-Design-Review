import type { LucideIcon } from 'lucide-react'
import type { TrafficLight } from '@/lib/types'

interface Props {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  status: TrafficLight
}

const ICON_COLORS: Record<TrafficLight, string> = {
  green: 'var(--success)',
  amber: 'var(--minor)',
  red: 'var(--critical)',
  neutral: 'var(--text-muted)',
}

export default function KPICard({ title, value, subtitle, icon: Icon, status }: Props) {
  const iconColor = ICON_COLORS[status]
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3"
         style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{title}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
             style={{ background: `${iconColor}18` }}>
          <Icon size={18} style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>}
      </div>
    </div>
  )
}
