import type { TrafficLight } from '@/lib/types'

interface Props {
  status: TrafficLight
  label: string
  size?: 'sm' | 'md'
}

const CLASS_MAP: Record<TrafficLight, string> = {
  green: 'badge-success',
  amber: 'badge-minor',
  red: 'badge-critical',
  neutral: 'badge-neutral',
}

export default function StatusBadge({ status, label, size = 'sm' }: Props) {
  const cls = CLASS_MAP[status]
  const sz = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${cls} ${sz}`}>
      <span className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'currentColor', opacity: 0.8 }} />
      {label}
    </span>
  )
}
