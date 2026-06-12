export type Role = 'admin' | 'project_manager' | 'engineer' | 'operative' | 'client'

export type Stage =
  | 'Feasibility'
  | 'Design'
  | 'Procure'
  | 'Build & Install'
  | 'Test & Commission'
  | 'Energise & Handover'

export type DocType = 'Drawing' | 'Specification' | 'Report' | 'Schedule' | 'Certificate' | 'Other'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}

export interface Project {
  id: string
  name: string
  client: string
  location: string
  capacity_mw: number | null
  stage: Stage
  created_by: string
  created_at: string
  updated_at: string
}

export type StandardCategory =
  | 'Grid Connection' | 'Protection' | 'Safety' | 'Civils & Geotechnical'
  | 'Electrical' | 'Fire & BESS Safety' | 'Temporary Works' | 'CDM / H&S' | 'Other'

export type StandardStatus = 'In Force' | 'Withdrawn' | 'Draft' | 'Superseded'

export interface Standard {
  id: string
  ref: string
  title: string
  body: string
  category: StandardCategory
  status: StandardStatus
  effective_date: string | null
  summary: string | null
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface StandardClause {
  id: string
  standard_id: string
  clause_ref: string
  heading: string
  body: string
  review_lenses: string[]
  severity_hint: 'Critical' | 'Major' | 'Minor' | 'Observation' | null
  created_at: string
}

export interface HsReference {
  id: string
  ref: string
  title: string
  duty_holder: string | null
  body: string
  category: string
  source_url: string | null
  created_at: string
}

export interface LessonLearned {
  id: string
  title: string
  description: string
  category: string
  severity: 'Critical' | 'Major' | 'Minor' | 'Observation'
  source: string | null
  review_lenses: string[]
  created_at: string
  updated_at: string
}

export interface OperatorRule {
  id: string
  operator: string
  rule_ref: string
  title: string
  body: string
  category: string
  applicable_voltage_kv: string | null
  source_url: string | null
  created_at: string
}

export interface Document {
  id: string
  project_id: string
  doc_no: string
  title: string
  rev: string
  type: DocType
  stage: Stage
  storage_path: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  supersedes: string | null
  uploaded_by: string | null
  uploaded_at: string
}
