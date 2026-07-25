'use client'

import { useState, useMemo } from 'react'
import {
  DollarSign, Clock, Cpu, Package, FileText, Plus, Trash2, Edit2, Check, X,
  ChevronDown, TrendingUp, Building2,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Company  { id: string; name: string; slug: string }
interface Sub      { id: string; name: string; category: string; amount_gbp: number; billing_cycle: string; notes: string | null; active: boolean }
interface Alloc    { id: string; subscription_id: string; company_id: string; allocation_pct: number }
interface Hardware { id: string; company_id: string | null; name: string; description: string | null; amount_gbp: number; purchase_date: string | null; amortise_months: number | null; notes: string | null }
interface TimeEntry{ id: string; company_id: string | null; developer: string; hours: number; rate_gbp: number; entry_date: string; description: string | null }
interface Invoice  { id: string; company_id: string; invoice_number: string; period_start: string; period_end: string; status: string; notes: string | null; invoice_line_items: LineItem[] }
interface LineItem { id: string; invoice_id: string; description: string; quantity: number; unit_price_gbp: number; total_gbp: number; sort_order: number }
interface UsageLog { company_id: string | null; model: string; input_tokens: number; output_tokens: number; cost_usd: number; created_at: string }

interface Props {
  companies:    Company[]
  subscriptions: Sub[]
  allocations:  Alloc[]
  hardware:     Hardware[]
  timeEntries:  TimeEntry[]
  invoices:     Invoice[]
  usageLogs:    UsageLog[]
}

const GBP = (n: number) => `£${n.toFixed(2)}`
const USD = (n: number) => `$${n.toFixed(4)}`

const TABS = ['Overview', 'Subscriptions', 'API Usage', 'Hardware', 'Time', 'Invoices'] as const
type Tab = typeof TABS[number]

const CATEGORIES = ['api', 'hosting', 'domain', 'tool', 'other']
const DEVELOPERS = ['Ryan', 'Max']

// ── Blank forms ───────────────────────────────────────────────────────────────
const blankSub  = (bracoId?: string | null): Omit<Sub, 'id'> & { company_id: string | null } => ({ name: '', category: 'api', amount_gbp: 0, billing_cycle: 'monthly', notes: null, active: true, company_id: bracoId ?? null })
const blankHw   = (): Omit<Hardware,'id'> => ({ company_id: null, name: '', description: null, amount_gbp: 0, purchase_date: null, amortise_months: null, notes: null })
const blankTime = (): Omit<TimeEntry,'id'> => ({ company_id: null, developer: 'Ryan', hours: 0, rate_gbp: 0, entry_date: new Date().toISOString().slice(0,10), description: null })

export default function CostsDashboard({ companies, subscriptions: initSubs, allocations: initAllocs, hardware: initHw, timeEntries: initTime, invoices: initInvoices, usageLogs }: Props) {
  const [tab, setTab] = useState<Tab>('Overview')
  const [subs, setSubs]         = useState(initSubs)
  const [allocs, setAllocs]     = useState(initAllocs)
  const [hardware, setHardware] = useState(initHw)
  const [timeEntries, setTime]  = useState(initTime)
  const [invoices, setInvoices] = useState(initInvoices)

  // ── Summary stats ──────────────────────────────────────────────────────────
  const monthlySubCost = useMemo(() => subs.filter(s => s.active).reduce((acc, s) => acc + (s.billing_cycle === 'monthly' ? s.amount_gbp : s.amount_gbp / 12), 0), [subs])
  const totalApiCostUsd = useMemo(() => usageLogs.reduce((a, l) => a + l.cost_usd, 0), [usageLogs])
  const totalTimeValue  = useMemo(() => timeEntries.reduce((a, t) => a + t.hours * t.rate_gbp, 0), [timeEntries])
  const totalHwCost     = useMemo(() => hardware.reduce((a, h) => a + h.amount_gbp, 0), [hardware])

  // ── Per-company API usage ──────────────────────────────────────────────────
  const usageByCompany = useMemo(() => {
    const map: Record<string, { tokens: number; cost: number }> = {}
    for (const l of usageLogs) {
      const key = l.company_id ?? '__unknown'
      if (!map[key]) map[key] = { tokens: 0, cost: 0 }
      map[key].tokens += l.input_tokens + l.output_tokens
      map[key].cost   += l.cost_usd
    }
    return map
  }, [usageLogs])

  const bracoId = companies.find(c => c.slug === 'braco')?.id ?? null
  const companyName = (id: string | null) => {
    if (!id) return 'Braco'
    return companies.find(c => c.id === id)?.name ?? id.slice(0, 8)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Cost Tracker</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Internal billing, subscriptions, API usage &amp; invoicing</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
            }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview'       && <OverviewTab monthlySubCost={monthlySubCost} totalApiCostUsd={totalApiCostUsd} totalTimeValue={totalTimeValue} totalHwCost={totalHwCost} usageByCompany={usageByCompany} companyName={companyName} usageLogs={usageLogs} companies={companies} hardware={hardware} timeEntries={timeEntries} allocs={allocs} subs={subs} />}
      {tab === 'Subscriptions'  && <SubsTab subs={subs} setSubs={setSubs} allocs={allocs} setAllocs={setAllocs} companies={companies} bracoId={bracoId} />}
      {tab === 'API Usage'      && <ApiTab usageLogs={usageLogs} usageByCompany={usageByCompany} companyName={companyName} />}
      {tab === 'Hardware'       && <HardwareTab hardware={hardware} setHardware={setHardware} companies={companies} bracoId={bracoId} />}
      {tab === 'Time'           && <TimeTab timeEntries={timeEntries} setTime={setTime} companies={companies} bracoId={bracoId} />}
      {tab === 'Invoices'       && <InvoicesTab invoices={invoices} setInvoices={setInvoices} companies={companies} subs={subs} allocs={allocs} hardware={hardware} timeEntries={timeEntries} usageLogs={usageLogs} />}
    </div>
  )
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewTab({ monthlySubCost, totalApiCostUsd, totalTimeValue, totalHwCost, usageByCompany, companyName, usageLogs, companies, hardware, timeEntries, allocs, subs }: any) {
  const USD_TO_GBP = 0.79

  // Per-company cost rollup
  const perCompany = useMemo(() => {
    const map: Record<string, { api: number; time: number; hw: number; subs: number }> = {}
    const ensure = (id: string) => { if (!map[id]) map[id] = { api: 0, time: 0, hw: 0, subs: 0 } }

    // API
    for (const [id, u] of Object.entries(usageByCompany) as any) {
      const key = id === '__unknown' ? 'braco' : id
      ensure(key)
      map[key].api += u.cost * USD_TO_GBP
    }
    // Time
    for (const t of timeEntries) {
      const key = t.company_id ?? 'braco'
      ensure(key)
      map[key].time += t.hours * t.rate_gbp
    }
    // Hardware
    for (const h of hardware) {
      const key = h.company_id ?? 'braco'
      ensure(key)
      map[key].hw += h.amortise_months ? h.amount_gbp / h.amortise_months : h.amount_gbp
    }
    // Subscription allocations
    for (const a of allocs) {
      const sub = subs.find((s: any) => s.id === a.subscription_id)
      if (!sub?.active) continue
      const monthly = sub.billing_cycle === 'monthly' ? sub.amount_gbp : sub.amount_gbp / 12
      ensure(a.company_id)
      map[a.company_id].subs += monthly * (a.allocation_pct / 100)
    }

    return map
  }, [usageByCompany, timeEntries, hardware, allocs, subs])

  const cards = [
    { label: 'Monthly subscriptions', value: GBP(monthlySubCost), sub: 'recurring run rate', icon: Package, color: '#6366f1' },
    { label: 'API cost (all time)', value: USD(totalApiCostUsd), sub: `${usageLogs.length} calls logged`, icon: Cpu, color: '#10b981' },
    { label: 'Dev time value', value: GBP(totalTimeValue), sub: 'all time logged', icon: Clock, color: '#f59e0b' },
    { label: 'Hardware spend', value: GBP(totalHwCost), sub: 'all items', icon: Package, color: '#ef4444' },
  ]

  const maxTotal = Math.max(...Object.values(perCompany).map((v: any) => v.api + v.time + v.hw + v.subs), 1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <c.icon size={15} style={{ color: c.color }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{c.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{c.value}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-company breakdown */}
      <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Cost by company</h3>
        {Object.keys(perCompany).length === 0 && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No costs allocated yet.</p>
        )}
        <div className="space-y-3">
          {Object.entries(perCompany)
            .sort(([,a]: any, [,b]: any) => (b.api+b.time+b.hw+b.subs) - (a.api+a.time+a.hw+a.subs))
            .map(([id, v]: any) => {
              const name = id === 'braco' ? 'Braco' : companyName(id)
              const total = v.api + v.time + v.hw + v.subs
              return (
                <div key={id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{GBP(total)}</span>
                  </div>
                  <div className="flex gap-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div style={{ width: `${(v.api / maxTotal) * 100}%`, background: '#10b981' }} title={`API: ${GBP(v.api)}`} />
                    <div style={{ width: `${(v.time / maxTotal) * 100}%`, background: '#f59e0b' }} title={`Time: ${GBP(v.time)}`} />
                    <div style={{ width: `${(v.hw / maxTotal) * 100}%`, background: '#ef4444' }} title={`Hardware: ${GBP(v.hw)}`} />
                    <div style={{ width: `${(v.subs / maxTotal) * 100}%`, background: '#6366f1' }} title={`Subscriptions: ${GBP(v.subs)}`} />
                  </div>
                  <div className="flex gap-4 mt-1">
                    {[['API', v.api, '#10b981'], ['Time', v.time, '#f59e0b'], ['Hardware', v.hw, '#ef4444'], ['Subs', v.subs, '#6366f1']].map(([label, val, color]: any) =>
                      val > 0 ? <span key={label} className="text-xs" style={{ color }}>{label} {GBP(val)}</span> : null
                    )}
                  </div>
                </div>
              )
            })}
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          {[['API (£)', '#10b981'], ['Dev time', '#f59e0b'], ['Hardware', '#ef4444'], ['Subscriptions', '#6366f1']].map(([l, c]) => (
            <div key={l} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Subscriptions ─────────────────────────────────────────────────────────────
function SubsTab({ subs, setSubs, allocs, setAllocs, companies, bracoId }: any) {
  const [adding, setAdding]         = useState(false)
  const [expandedSub, setExpanded]  = useState<string | null>(null)
  const [form, setForm]             = useState(blankSub(bracoId))
  const [amountStr, setAmountStr]   = useState('')
  const [saving, setSaving]         = useState(false)
  const [allocForm, setAllocForm]   = useState<Record<string, string>>({}) // subId → pct string

  async function saveSub() {
    setSaving(true)
    const { company_id, ...subFields } = { ...form, amount_gbp: parseFloat(amountStr) || 0 }
    const res = await fetch('/api/admin/costs/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subFields) })
    const { data } = await res.json()
    if (data) {
      setSubs((s: any) => [...s, data])
      if (company_id) {
        const allocRes = await fetch('/api/admin/costs/allocations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: data.id, company_id, allocation_pct: 100 }) })
        const { data: allocData } = await allocRes.json()
        if (allocData) setAllocs((a: any) => [...a, allocData])
      }
      setAdding(false)
      setForm(blankSub(bracoId))
      setAmountStr('')
    }
    setSaving(false)
  }

  async function removeSub(id: string) {
    await fetch(`/api/admin/costs/subscriptions/${id}`, { method: 'DELETE' })
    setSubs((s: any) => s.filter((x: any) => x.id !== id))
    setAllocs((a: any) => a.filter((x: any) => x.subscription_id !== id))
  }

  async function saveAlloc(subId: string, companyId: string, pct: number) {
    const existing = allocs.find((a: Alloc) => a.subscription_id === subId && a.company_id === companyId)
    if (existing) {
      const res = await fetch(`/api/admin/costs/allocations/${existing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ allocation_pct: pct }) })
      if (res.ok) setAllocs((a: any) => a.map((x: any) => x.id === existing.id ? { ...x, allocation_pct: pct } : x))
    } else {
      const res = await fetch('/api/admin/costs/allocations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription_id: subId, company_id: companyId, allocation_pct: pct }) })
      const { data } = await res.json()
      if (data) setAllocs((a: any) => [...a, data])
    }
  }

  async function removeAlloc(id: string) {
    await fetch(`/api/admin/costs/allocations/${id}`, { method: 'DELETE' })
    setAllocs((a: any) => a.filter((x: any) => x.id !== id))
  }

  const total = subs.filter((s: Sub) => s.active).reduce((a: number, s: Sub) => a + (s.billing_cycle === 'monthly' ? s.amount_gbp : s.amount_gbp / 12), 0)

  // All companies including Braco
  const allCompanies = companies

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Monthly run rate: <strong style={{ color: 'var(--text-primary)' }}>{GBP(total)}</strong></p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
          <Plus size={13} /> Add subscription
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Resend" /></Field>
            <Field label="Category">
              <StyledSelect value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </StyledSelect>
            </Field>
            <Field label="Amount (£)">
              <input
                type="text" inputMode="decimal"
                value={amountStr}
                onChange={e => { const v = e.target.value; if (/^[\d.]*$/.test(v)) setAmountStr(v) }}
                placeholder="0.00"
              />
            </Field>
            <Field label="Billing cycle">
              <StyledSelect value={form.billing_cycle} onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </StyledSelect>
            </Field>
            <Field label="Allocate to company">
              <StyledSelect value={form.company_id ?? ''} onChange={e => setForm(f => ({ ...f, company_id: e.target.value || null }))}>
                <option value="">— Split later —</option>
                {companies.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </StyledSelect>
            </Field>
            <Field label="Notes"><input value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} /></Field>
          </div>
          <div className="flex gap-2">
            <button onClick={saveSub} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {subs.map((s: Sub) => {
          const monthly = s.billing_cycle === 'monthly' ? s.amount_gbp : s.amount_gbp / 12
          const subAllocs = allocs.filter((a: Alloc) => a.subscription_id === s.id)
          const allocTotal = subAllocs.reduce((a: number, x: Alloc) => a + x.allocation_pct, 0)
          const isOpen = expandedSub === s.id

          return (
            <div key={s.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                    <Tag>{s.category}</Tag>
                    <Tag color={s.active ? '#10b981' : '#94a3b8'}>{s.active ? 'Active' : 'Inactive'}</Tag>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {GBP(s.amount_gbp)} / {s.billing_cycle} · {GBP(monthly)}/mo
                    {subAllocs.length > 0 && ` · allocated ${allocTotal}%`}
                  </p>
                </div>
                <button onClick={() => setExpanded(isOpen ? null : s.id)} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                  {isOpen ? 'Close' : 'Allocate'}
                </button>
                <button onClick={() => removeSub(s.id)} className="opacity-40 hover:opacity-100 ml-1"><Trash2 size={13} style={{ color: 'var(--text-muted)' }} /></button>
              </div>

              {isOpen && (
                <div className="border-t px-4 pb-4 pt-3 space-y-2" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Split this subscription across companies (total allocated: {allocTotal}%)</p>
                  {allCompanies.map((c: Company) => {
                    const existing = subAllocs.find((a: Alloc) => a.company_id === c.id)
                    const key = `${s.id}-${c.id}`
                    const val = allocForm[key] ?? (existing ? String(existing.allocation_pct) : '')
                    return (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="text-sm w-32 truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                        <input
                          type="number" min="0" max="100" placeholder="0"
                          value={val}
                          onChange={e => setAllocForm(f => ({ ...f, [key]: e.target.value }))}
                          className="w-20 px-2 py-1 rounded-lg border text-sm text-right"
                          style={{ background: 'var(--bg-base)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                        />
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>%</span>
                        {val && (
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>= {GBP(monthly * (parseFloat(val) / 100))}/mo</span>
                        )}
                        <button
                          onClick={async () => {
                            const pct = parseFloat(val)
                            if (isNaN(pct) || pct < 0) return
                            if (pct === 0 && existing) { await removeAlloc(existing.id); setAllocForm(f => ({ ...f, [key]: '' })); return }
                            if (pct > 0) await saveAlloc(s.id, c.id, pct)
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-white"
                          style={{ background: 'var(--accent)' }}
                        >
                          Save
                        </button>
                        {existing && (
                          <button onClick={() => removeAlloc(existing.id)} className="opacity-40 hover:opacity-100">
                            <X size={12} style={{ color: 'var(--text-muted)' }} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
        {subs.length === 0 && (
          <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No subscriptions yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── API Usage ─────────────────────────────────────────────────────────────────
function ApiTab({ usageLogs, usageByCompany, companyName }: any) {
  const byModel = useMemo(() => {
    const map: Record<string, { calls: number; cost: number; tokens: number }> = {}
    for (const l of usageLogs) {
      if (!map[l.model]) map[l.model] = { calls: 0, cost: 0, tokens: 0 }
      map[l.model].calls++
      map[l.model].cost += l.cost_usd
      map[l.model].tokens += l.input_tokens + l.output_tokens
    }
    return map
  }, [usageLogs])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>By client</h3>
          <div className="space-y-2">
            {Object.entries(usageByCompany).sort(([,a]: any,[,b]: any) => b.cost - a.cost).map(([id, u]: any) => (
              <div key={id} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--text-primary)' }}>{companyName(id === '__unknown' ? null : id)}</span>
                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{(u.tokens / 1000).toFixed(0)}k tokens</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{USD(u.cost)}</span>
                </div>
              </div>
            ))}
            {Object.keys(usageByCompany).length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No usage logged yet.</p>}
          </div>
        </div>

        <div className="rounded-xl border p-4" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>By model</h3>
          <div className="space-y-2">
            {Object.entries(byModel).sort(([,a]: any,[,b]: any) => b.cost - a.cost).map(([model, m]: any) => (
              <div key={model} className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{model}</span>
                <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                  <span>{m.calls} calls</span>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{USD(m.cost)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Client', 'Endpoint', 'Model', 'Input', 'Output', 'Cost (USD)'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usageLogs.slice(0, 100).map((l: UsageLog, i: number) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(l.created_at).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-2 text-xs" style={{ color: 'var(--text-primary)' }}>{companyName(l.company_id)}</td>
                <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{(l as any).endpoint ?? '—'}</td>
                <td className="px-4 py-2 font-mono text-xs" style={{ color: 'var(--text-muted)' }}>{l.model.replace('claude-','')}</td>
                <td className="px-4 py-2 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{l.input_tokens.toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-right" style={{ color: 'var(--text-muted)' }}>{l.output_tokens.toLocaleString()}</td>
                <td className="px-4 py-2 text-xs text-right font-medium" style={{ color: 'var(--text-primary)' }}>{USD(l.cost_usd)}</td>
              </tr>
            ))}
            {usageLogs.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No usage logged yet — make some API calls first.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Hardware ──────────────────────────────────────────────────────────────────
function HardwareTab({ hardware, setHardware, companies, bracoId }: any) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(() => ({ ...blankHw(), company_id: bracoId }))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/costs/hardware', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const { data } = await res.json()
    if (data) { setHardware((h: any) => [data, ...h]); setAdding(false); setForm({ ...blankHw(), company_id: bracoId }) }
    setSaving(false)
  }

  async function remove(id: string) {
    await fetch(`/api/admin/costs/hardware/${id}`, { method: 'DELETE' })
    setHardware((h: any) => h.filter((x: any) => x.id !== id))
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
          <Plus size={13} /> Add hardware
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <select value={form.company_id ?? ''} onChange={e => setForm(f => ({ ...f, company_id: e.target.value || null }))}>
                {companies.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Item name"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
            <Field label="Cost (£)"><input type="number" value={form.amount_gbp} onChange={e => setForm(f => ({ ...f, amount_gbp: parseFloat(e.target.value) || 0 }))} /></Field>
            <Field label="Purchase date"><input type="date" value={form.purchase_date ?? ''} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value || null }))} /></Field>
            <Field label="Amortise over (months)"><input type="number" value={form.amortise_months ?? ''} onChange={e => setForm(f => ({ ...f, amortise_months: parseInt(e.target.value) || null }))} placeholder="Leave blank = one-off" /></Field>
            <Field label="Notes"><input value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} /></Field>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Client', 'Item', 'Cost', 'Date', 'Amortise', 'Monthly equiv.', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hardware.map((h: Hardware) => (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{companies.find((c: Company) => c.id === h.company_id)?.name ?? 'Braco'}</td>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{h.name}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{GBP(h.amount_gbp)}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{h.purchase_date ?? '—'}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{h.amortise_months ? `${h.amortise_months}mo` : 'One-off'}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-primary)' }}>{h.amortise_months ? GBP(h.amount_gbp / h.amortise_months) : '—'}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(h.id)} className="opacity-40 hover:opacity-100"><Trash2 size={13} style={{ color: 'var(--text-muted)' }} /></button>
                </td>
              </tr>
            ))}
            {hardware.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No hardware items yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Time entries ──────────────────────────────────────────────────────────────
function TimeTab({ timeEntries, setTime, companies, bracoId }: any) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState(() => ({ ...blankTime(), company_id: bracoId }))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const res = await fetch('/api/admin/costs/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const { data } = await res.json()
    if (data) { setTime((t: any) => [data, ...t]); setAdding(false); setForm({ ...blankTime(), company_id: bracoId }) }
    setSaving(false)
  }

  async function remove(id: string) {
    await fetch(`/api/admin/costs/time/${id}`, { method: 'DELETE' })
    setTime((t: any) => t.filter((x: any) => x.id !== id))
  }

  const totals = useMemo(() => {
    const map: Record<string, { hours: number; value: number }> = {}
    for (const t of timeEntries) {
      if (!map[t.developer]) map[t.developer] = { hours: 0, value: 0 }
      map[t.developer].hours += t.hours
      map[t.developer].value += t.hours * t.rate_gbp
    }
    return map
  }, [timeEntries])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-4 flex-wrap">
          {Object.entries(totals).map(([dev, t]: any) => (
            <div key={dev} className="rounded-lg border px-3 py-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{dev}</p>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t.hours}h · {GBP(t.value)}</p>
            </div>
          ))}
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white shrink-0" style={{ background: 'var(--accent)' }}>
          <Plus size={13} /> Log time
        </button>
      </div>

      {adding && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Field label="Client">
              <select value={form.company_id ?? ''} onChange={e => setForm(f => ({ ...f, company_id: e.target.value || null }))}>
                {companies.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Developer">
              <select value={form.developer} onChange={e => setForm(f => ({ ...f, developer: e.target.value }))}>
                {DEVELOPERS.map(d => <option key={d}>{d}</option>)}
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Date"><input type="date" value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></Field>
            <Field label="Hours"><input type="number" step="0.5" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: parseFloat(e.target.value) || 0 }))} /></Field>
            <Field label="Rate (£/hr)"><input type="number" value={form.rate_gbp} onChange={e => setForm(f => ({ ...f, rate_gbp: parseFloat(e.target.value) || 0 }))} /></Field>
            <Field label="Description"><input value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value || null }))} /></Field>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Save</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
              {['Date', 'Client', 'Developer', 'Hours', 'Rate', 'Value', 'Description', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timeEntries.map((t: TimeEntry) => (
              <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{t.entry_date}</td>
                <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-muted)' }}>{companies.find((c: Company) => c.id === t.company_id)?.name ?? 'Braco'}</td>
                <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{t.developer}</td>
                <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-primary)' }}>{t.hours}</td>
                <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-muted)' }}>{GBP(t.rate_gbp)}</td>
                <td className="px-4 py-2.5 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{GBP(t.hours * t.rate_gbp)}</td>
                <td className="px-4 py-2.5 text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>{t.description ?? '—'}</td>
                <td className="px-4 py-2.5">
                  <button onClick={() => remove(t.id)} className="opacity-40 hover:opacity-100"><Trash2 size={13} style={{ color: 'var(--text-muted)' }} /></button>
                </td>
              </tr>
            ))}
            {timeEntries.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No time entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Invoices ──────────────────────────────────────────────────────────────────
function InvoicesTab({ invoices, setInvoices, companies, subs, allocs, hardware, timeEntries, usageLogs }: any) {
  const [creating, setCreating] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState('')
  const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10))
  const [periodEnd, setPeriodEnd]     = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0,10))

  async function generateInvoice() {
    if (!selectedCompany) return
    const res = await fetch('/api/admin/costs/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ company_id: selectedCompany, period_start: periodStart, period_end: periodEnd }),
    })
    const { data } = await res.json()
    if (data) { setInvoices((inv: any) => [data, ...inv]); setCreating(false) }
  }

  const STATUS_COLORS: Record<string, string> = { draft: '#94a3b8', sent: '#f59e0b', paid: '#10b981' }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>
          <Plus size={13} /> Generate invoice
        </button>
      </div>

      {creating && (
        <div className="rounded-xl border p-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--accent)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Generate invoice</p>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Client">
              <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                <option value="">Select client…</option>
                {companies.map((c: Company) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Period start"><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></Field>
            <Field label="Period end"><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></Field>
          </div>
          <div className="flex gap-2">
            <button onClick={generateInvoice} disabled={!selectedCompany} className="px-3 py-1.5 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--accent)' }}>Generate</button>
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {invoices.map((inv: Invoice) => (
          <InvoiceCard key={inv.id} invoice={inv} companies={companies} setInvoices={setInvoices} />
        ))}
        {invoices.length === 0 && (
          <div className="rounded-xl border p-8 text-center" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
            <FileText size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No invoices yet. Generate one above.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function InvoiceCard({ invoice, companies, setInvoices }: any) {
  const [open, setOpen] = useState(false)
  const company = companies.find((c: Company) => c.id === invoice.company_id)
  const total = (invoice.invoice_line_items ?? []).reduce((a: number, l: LineItem) => a + l.total_gbp, 0)
  const STATUS_COLORS: Record<string, string> = { draft: '#94a3b8', sent: '#f59e0b', paid: '#10b981' }

  async function updateStatus(status: string) {
    await fetch(`/api/admin/costs/invoices/${invoice.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setInvoices((inv: any) => inv.map((i: any) => i.id === invoice.id ? { ...i, status } : i))
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
      <button className="w-full flex items-center gap-4 px-4 py-3 text-left" onClick={() => setOpen(o => !o)}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{invoice.invoice_number}</span>
            <Tag color={STATUS_COLORS[invoice.status]}>{invoice.status}</Tag>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{company?.name} · {invoice.period_start} → {invoice.period_end}</p>
        </div>
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{GBP(total)}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
      </button>

      {open && (
        <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Description', 'Qty', 'Unit price', 'Total'].map(h => (
                  <th key={h} className="pb-2 text-left text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(invoice.invoice_line_items ?? []).sort((a: LineItem, b: LineItem) => a.sort_order - b.sort_order).map((l: LineItem) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2" style={{ color: 'var(--text-primary)' }}>{l.description}</td>
                  <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{l.quantity}</td>
                  <td className="py-2 text-right" style={{ color: 'var(--text-muted)' }}>{GBP(l.unit_price_gbp)}</td>
                  <td className="py-2 text-right font-medium" style={{ color: 'var(--text-primary)' }}>{GBP(l.total_gbp)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="pt-3 text-right font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Total</td>
                <td className="pt-3 text-right font-bold" style={{ color: 'var(--text-primary)' }}>{GBP(total)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="flex gap-2 mt-3">
            {invoice.status === 'draft' && <button onClick={() => updateStatus('sent')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#f59e0b' }}>Mark sent</button>}
            {invoice.status === 'sent'  && <button onClick={() => updateStatus('paid')} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#10b981' }}>Mark paid</button>}
            {invoice.status !== 'draft' && <button onClick={() => updateStatus('draft')} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>Revert to draft</button>}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shared UI helpers ─────────────────────────────────────────────────────────
function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</label>
      <div className="[&>input]:w-full [&>select]:w-full [&>input]:px-3 [&>input]:py-1.5 [&>select]:px-3 [&>select]:py-1.5 [&>input]:rounded-lg [&>select]:rounded-lg [&>input]:border [&>select]:border [&>input]:text-sm [&>select]:text-sm"
        style={{ '--field-border': 'var(--border)' } as any}
      >
        <style>{`
          .field-wrap input, .field-wrap select {
            background: var(--bg-base);
            border-color: var(--border);
            color: var(--text-primary);
          }
        `}</style>
        {children}
      </div>
    </div>
  )
}

function StyledSelect({ value, onChange, children }: { value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: '100%',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        colorScheme: 'dark',
      }}
    >
      {children}
    </select>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: color ? `${color}20` : 'var(--bg-surface)', color: color ?? 'var(--text-muted)', border: `1px solid ${color ?? 'var(--border)'}20` }}>
      {children}
    </span>
  )
}
