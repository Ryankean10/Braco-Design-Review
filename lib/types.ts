export type Role = 'admin' | 'engineer'

export type Stage =
  | 'Feasibility'
  | 'Design'
  | 'Procure'
  | 'Build & Install'
  | 'Test & Commission'
  | 'Energise & Handover'

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
