'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, AlertTriangle, CheckCircle, Clock, Wrench, FileText, BarChart2, Shield, BookOpen } from 'lucide-react'
import type { PlantItem, PlantFinancial, PlantCertificate, PlantManual, PlantMaintenanceTask, PlantMaintenanceLog } from '@/lib/types'
import PlantOverviewTab from './tabs/PlantOverviewTab'
import PlantFinancialsTab from './tabs/PlantFinancialsTab'
import PlantCertificatesTab from './tabs/PlantCertificatesTab'
import PlantManualsTab from './tabs/PlantManualsTab'
import PlantMaintenanceTab from './tabs/PlantMaintenanceTab'

const CATEGORY_IMAGE: Record<string, string> = {
  excavator:   '/Plant/Excavator .png',
  dumper:      '/Plant/Dumper.png',
  telehandler: '/Plant/telehandler.png',
  crane:       '/Plant/crane.png',
  roller:      '/Plant/Roller.png',
  generator:   '/Plant/Generator.png',
  lorry:       '/Plant/Lorry.png',
  scaffold:    '/Plant/Scaffold.png',
  pump:        '/Plant/Pump.png',
}

const STATUS_COLOURS: Record<string, { bg: string; text: string; border: string }> = {
  available: { bg: 'rgba(34,197,94,0.1)',  text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  on_hire:   { bg: 'rgba(59,130,246,0.1)', text: '#3b82f6', border: 'rgba(59,130,246,0.3)' },
  breakdown: { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  returned:  { bg: 'rgba(100,116,139,0.1)',text: '#64748b', border: 'rgba(100,116,139,0.3)' },
  sold:      { bg: 'rgba(100,116,139,0.1)',text: '#64748b', border: 'rgba(100,116,139,0.3)' },
}

interface Props {
  item: PlantItem & { project?: { name: string; location: string } | null; site?: { name: string } | null; operator?: { name: string } | null }
  financials: (PlantFinancial & { project?: { name: string } | null })[]
  certificates: PlantCertificate[]
  manuals: PlantManual[]
  tasks: PlantMaintenanceTask[]
  logs: PlantMaintenanceLog[]
  projects: { id: string; name: string }[]
  people: { id: string; name: string; role: string }[]
  canEdit: boolean
}

const TABS = [
  { id: 'overview',     label: 'Overview',     icon: BarChart2 },
  { id: 'financials',   label: 'Financials',   icon: FileText },
  { id: 'certificates', label: 'Certificates', icon: Shield },
  { id: 'manuals',      label: 'Manuals',      icon: BookOpen },
  { id: 'maintenance',  label: 'Maintenance',  icon: Wrench },
]

export default function PlantDetail({ item, financials, certificates, manuals, tasks, logs, projects, people, canEdit }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('overview')

  const img = CATEGORY_IMAGE[item.category.toLowerCase()] ?? '/Plant/Default.png'
  const sc = STATUS_COLOURS[item.status] ?? STATUS_COLOURS.available

  // Alert: certs expiring within 30 days
  const today = new Date()
  const soonExpiry = certificates.filter(c => {
    const days = (new Date(c.expiry_date).getTime() - today.getTime()) / 86400000
    return days <= 30
  })

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back */}
      <button onClick={() => router.push('/plant')} className="flex items-center gap-1.5 text-sm mb-6 hover:opacity-70" style={{ color: 'var(--text-muted)' }}>
        <ArrowLeft size={14} /> Back to Plant Register
      </button>

      {/* Header card */}
      <div className="rounded-2xl border p-6 mb-6 flex items-start gap-5" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <img src={img} alt={item.category} className="w-20 h-20 object-contain rounded-xl flex-shrink-0" style={{ background: 'var(--bg-elevated)', padding: 8 }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>{item.name}</h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {[item.make, item.model].filter(Boolean).join(' ')}
                {item.year ? ` · ${item.year}` : ''}
                {item.plant_ref ? ` · ${item.plant_ref}` : ''}
              </p>
            </div>
            <span className="text-xs px-3 py-1 rounded-full font-medium capitalize flex-shrink-0"
              style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
              {item.status.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-3 flex-wrap">
            {item.project && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium" style={{ color: 'var(--accent)' }}>Project:</span>
                {(item as any).project.name}
              </div>
            )}
            {item.operator && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium">Operator:</span>
                {(item as any).operator.name}
              </div>
            )}
            {item.supplier && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium">Supplier:</span>
                {item.supplier}
              </div>
            )}
            {(item.hire_rate_daily || item.hire_rate_weekly) && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="font-medium">Rate:</span>
                {item.hire_rate_daily ? `£${item.hire_rate_daily}/day` : ''}
                {item.hire_rate_daily && item.hire_rate_weekly ? ' · ' : ''}
                {item.hire_rate_weekly ? `£${item.hire_rate_weekly}/wk` : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expiry alert */}
      {soonExpiry.length > 0 && (
        <div className="rounded-xl border p-3 mb-4 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }}>
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
          <p className="text-xs" style={{ color: '#fbbf24' }}>
            <span className="font-semibold">{soonExpiry.length} certificate{soonExpiry.length > 1 ? 's' : ''} expiring within 30 days:</span>{' '}
            {soonExpiry.map(c => `${c.type} (${new Date(c.expiry_date).toLocaleDateString('en-GB')})`).join(', ')}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: activeTab === id ? 'var(--accent)' : 'transparent',
              color: activeTab === id ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            <Icon size={13} />
            {label}
            {id === 'certificates' && soonExpiry.length > 0 && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <PlantOverviewTab item={item} projects={projects} people={people} canEdit={canEdit} />
      )}
      {activeTab === 'financials' && (
        <PlantFinancialsTab financials={financials} plantId={item.id} projects={projects} canEdit={canEdit} />
      )}
      {activeTab === 'certificates' && (
        <PlantCertificatesTab certificates={certificates} plantId={item.id} companyId={item.company_id} canEdit={canEdit} />
      )}
      {activeTab === 'manuals' && (
        <PlantManualsTab manuals={manuals} plantId={item.id} companyId={item.company_id} canEdit={canEdit} />
      )}
      {activeTab === 'maintenance' && (
        <PlantMaintenanceTab tasks={tasks} logs={logs} plantId={item.id} companyId={item.company_id} canEdit={canEdit} />
      )}
    </div>
  )
}
