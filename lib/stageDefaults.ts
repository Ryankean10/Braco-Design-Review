// ── BESS stages ────────────────────────────────────────────────────────────

export const STAGE_ORDER = [
  'Feasibility',
  'Design',
  'Procure',
  'Build & Install',
  'Test & Commission',
  'Energise & Handover',
] as const

export type StageName = typeof STAGE_ORDER[number]

// ── Civils / contractor stages ─────────────────────────────────────────────

export const CIVILS_STAGE_ORDER = [
  'Tender',
  'Awarded',
  'Mobilised',
  'Handover',
  'Complete',
] as const

export type CivilsStageName = typeof CIVILS_STAGE_ORDER[number]

export type AnyStage = StageName | CivilsStageName

// ── Shared types ───────────────────────────────────────────────────────────

export type ChecklistItem = {
  id: string
  label: string
  checked: boolean
  checked_by: string | null
  checked_by_name: string | null
  checked_at: string | null
}

export type StageStatus = 'Not Started' | 'In Progress' | 'Complete' | 'On Hold'

export interface ProjectStage {
  id: string
  project_id: string
  stage: AnyStage
  status: StageStatus
  checklist: ChecklistItem[]
  signed_off_by: string | null
  signed_off_at: string | null
  sign_off_notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

// ── BESS checklists ────────────────────────────────────────────────────────

export const DEFAULT_CHECKLISTS: Record<StageName, string[]> = {
  'Feasibility': [
    'Grid connection application submitted to DNO/NESO',
    'Site secured — land option or lease signed',
    'Employer\'s Requirements (ER) issued',
    'Initial planning assessment / pre-application complete',
    'Commercial terms agreed and contract signed',
    'Initial risk register raised',
  ],
  'Design': [
    'Outline design issued for client review',
    'Detailed design complete',
    'All drawings issued at For Client Review status',
    'Client design sign-off received',
    'Protection settings report issued',
    'G99 / Grid Code application submitted to DNO/NESO',
    'DNO design acceptance received',
    'Planning permission granted',
  ],
  'Procure': [
    'Long-lead items identified and lead times confirmed',
    'Procurement register complete and approved',
    'BESS containers / inverter-chargers ordered',
    'Transformer(s) ordered',
    'HV switchgear ordered',
    'Cables and containment ordered',
    'Fire suppression system ordered',
    'RAMS and method statements approved',
  ],
  'Build & Install': [
    'Site establishment and welfare complete',
    'Groundworks and civil foundations complete',
    'Plate load / bearing tests complete and signed off',
    'BESS containers installed and aligned',
    'Transformer(s) installed',
    'HV / LV electrical installation complete',
    'Cable terminations and glanding complete',
    'SCADA / comms installation complete',
  ],
  'Test & Commission': [
    'Inspection and Test Plan (ITP) issued and approved',
    'HV cable pressure and sheath tests complete',
    'Insulation resistance tests complete',
    'Protection relay tests complete and witnessed',
    'BESS Factory Acceptance Test (FAT) complete',
    'Site Acceptance Test (SAT) complete',
    'G99 pre-energisation checklist signed off',
    'DNO witness inspection passed',
  ],
  'Energise & Handover': [
    'DNO energisation consent received',
    'Initial energisation witnessed and recorded',
    'Performance / capacity test complete',
    'Snagging list closed out',
    'O&M manuals issued to client',
    'As-built drawings issued',
    'Client final acceptance certificate signed',
    'Project handed over to operations',
  ],
}

// ── Civils checklists ──────────────────────────────────────────────────────

export const CIVILS_DEFAULT_CHECKLISTS: Record<CivilsStageName, string[]> = {
  'Tender': [
    'Enquiry / ITT received and logged',
    'Site visit carried out',
    'Scope of works confirmed with client',
    'Plant and labour requirements estimated',
    'Subcontractor quotes obtained',
    'Tender price agreed and signed off internally',
    'Tender submitted to client',
  ],
  'Awarded': [
    'Contract / order confirmation received',
    'Contract sum and programme dates confirmed',
    'Insurance and bonds in place',
    'Procurement list raised — long-lead items identified',
    'Project manager and site manager appointed',
    'Programme issued to client',
    'Pre-start meeting held with client',
  ],
  'Mobilised': [
    'Plant allocated and delivery dates confirmed',
    'Crew appointed and inducted',
    'RAMS and method statements prepared and approved',
    'Traffic management plan approved',
    'Site establishment and welfare set up',
    'Temporary works design approved (if required)',
    'Drawings issued for construction',
    'Daily site diaries and timesheets in place',
  ],
  'Handover': [
    'Practical completion certificate issued',
    'Snagging list issued and agreed with client',
    'All snagging items rectified and signed off',
    'As-built drawings issued',
    'O&M manuals issued (if applicable)',
    'Final account submitted and agreed',
  ],
  'Complete': [
    'Final account signed off by client',
    'Retention released (or retention bond in place)',
    'Defects liability period expired',
    'Lessons learned review completed',
    'Project file archived',
  ],
}

// ── Colour maps ────────────────────────────────────────────────────────────

export const STAGE_COLOURS: Record<StageName, string> = {
  'Feasibility':         '#4b5563',
  'Design':              '#2563eb',
  'Procure':             '#7c3aed',
  'Build & Install':     '#d97706',
  'Test & Commission':   '#dc2626',
  'Energise & Handover': '#16a34a',
}

export const CIVILS_STAGE_COLOURS: Record<CivilsStageName, string> = {
  'Tender':    '#6366f1',
  'Awarded':   '#0ea5e9',
  'Mobilised': '#f59e0b',
  'Handover':  '#16a34a',
  'Complete':  '#10b981',
}

export function getStageColour(stage: string, industry = 'bess'): string {
  if (industry === 'civils') return CIVILS_STAGE_COLOURS[stage as CivilsStageName] ?? '#4b5563'
  return STAGE_COLOURS[stage as StageName] ?? '#4b5563'
}

// ── Factory functions ──────────────────────────────────────────────────────

export function makeDefaultStages(projectId: string, industry = 'bess'): Omit<ProjectStage, 'id' | 'created_at' | 'updated_at'>[] {
  if (industry === 'civils') {
    return CIVILS_STAGE_ORDER.map(stage => ({
      project_id: projectId,
      stage,
      status: 'Not Started' as StageStatus,
      checklist: CIVILS_DEFAULT_CHECKLISTS[stage].map((label, i) => ({
        id: `${stage.replace(/\s+/g, '_').toLowerCase()}_${i}`,
        label,
        checked: false,
        checked_by: null,
        checked_by_name: null,
        checked_at: null,
      })),
      signed_off_by: null,
      signed_off_at: null,
      sign_off_notes: null,
      started_at: null,
      completed_at: null,
    }))
  }

  return STAGE_ORDER.map(stage => ({
    project_id: projectId,
    stage,
    status: 'Not Started' as StageStatus,
    checklist: DEFAULT_CHECKLISTS[stage].map((label, i) => ({
      id: `${stage.replace(/\s+/g, '_').toLowerCase()}_${i}`,
      label,
      checked: false,
      checked_by: null,
      checked_by_name: null,
      checked_at: null,
    })),
    signed_off_by: null,
    signed_off_at: null,
    sign_off_notes: null,
    started_at: null,
    completed_at: null,
  }))
}

export function getStageOrder(industry = 'bess'): readonly string[] {
  return industry === 'civils' ? CIVILS_STAGE_ORDER : STAGE_ORDER
}
