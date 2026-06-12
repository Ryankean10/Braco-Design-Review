export const STAGE_ORDER = [
  'Feasibility',
  'Design',
  'Procure',
  'Build & Install',
  'Test & Commission',
  'Energise & Handover',
] as const

export type StageName = typeof STAGE_ORDER[number]

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
  stage: StageName
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

// Default checklist items per stage — seeded when project_stages row is created
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

export function makeDefaultStages(projectId: string): Omit<ProjectStage, 'id' | 'created_at' | 'updated_at'>[] {
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
