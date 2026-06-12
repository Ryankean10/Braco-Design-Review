export type Role = 'admin' | 'engineer'

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
