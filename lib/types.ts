export type Role = 'superadmin' | 'admin' | 'project_manager' | 'engineer' | 'operative' | 'client'

export type Module =
  | 'projects'
  | 'documents'
  | 'reviews'
  | 'reference_library'
  | 'procurement'
  | 'tests'
  | 'assurance'
  | 'construction'
  | 'planning'
  | 'team'
  | 'plant'

export type PlantStatus = 'available' | 'on_hire' | 'breakdown' | 'returned' | 'sold'
export type PlantCategory = 'excavator' | 'dumper' | 'telehandler' | 'crane' | 'roller' | 'generator' | 'lorry' | 'scaffold' | 'pump' | 'other'

export interface PlantItem {
  id: string
  company_id: string
  name: string
  category: PlantCategory
  make: string | null
  model: string | null
  plant_ref: string | null
  year: number | null
  status: PlantStatus
  project_id: string | null
  site_id: string | null
  operator_id: string | null
  supplier: string | null
  hire_rate_daily: number | null
  hire_rate_weekly: number | null
  on_hire_date: string | null
  expected_off_hire: string | null
  actual_off_hire: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PlantFinancial {
  id: string
  plant_id: string
  project_id: string | null
  company_id: string
  type: 'cost' | 'income'
  description: string | null
  amount: number
  date: string
  invoice_ref: string | null
  status: 'outstanding' | 'invoiced' | 'paid'
  created_at: string
}

export interface PlantCertificate {
  id: string
  plant_id: string
  company_id: string
  type: string
  reference: string | null
  issued_date: string | null
  expiry_date: string
  issued_by: string | null
  file_url: string | null
  notes: string | null
  created_at: string
}

export interface PlantManual {
  id: string
  plant_id: string
  company_id: string
  name: string
  storage_path: string
  file_size: number | null
  ai_processed: boolean
  ai_processed_at: string | null
  created_at: string
}

export interface PlantMaintenanceTask {
  id: string
  plant_id: string
  company_id: string
  manual_id: string | null
  title: string
  description: string | null
  interval_type: string | null
  interval_value: number | null
  next_due_date: string | null
  recurring: boolean
  created_at: string
}

export interface PlantMaintenanceLog {
  id: string
  plant_id: string
  task_id: string | null
  company_id: string
  carried_out_by: string | null
  carried_out_date: string
  description: string
  parts_used: { name: string; qty: number; cost: number }[]
  labour_cost: number
  parts_cost: number
  downtime_hours: number
  next_due_date: string | null
  notes: string | null
  created_at: string
}

export interface Company {
  id: string
  name: string
  slug: string
  logo_url: string | null
  modules: Module[]
  accent_color: string | null
  secondary_color: string | null
  tagline: string | null
  industry: 'bess' | 'civils' | string
  created_at: string
  updated_at: string
}

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
  company_id: string | null
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

export type TestStatus = 'Planned' | 'In Progress' | 'Pass' | 'Conditional Pass' | 'Fail' | 'Awaiting Review' | 'Cancelled'
export type TestCategory = 'Civils & Geotechnical' | 'HV Electrical' | 'LV Electrical' | 'Protection & Control' | 'BESS & Inverter' | 'FAT' | 'SAT' | 'DNO / Grid' | 'Fire & Safety' | 'Other'

export interface TestRecord {
  id: string
  project_id: string
  test_ref: string | null
  title: string
  category: TestCategory
  test_type: string
  description: string | null
  planned_date: string | null
  actual_date: string | null
  location: string | null
  status: TestStatus
  pass_criteria: string | null
  result_summary: string | null
  results_data: any | null
  results_source: string | null
  witnessed_by: string | null
  certificate_ref: string | null
  itp_ref: string | null
  notes: string | null
  assigned_to: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  test_documents?: TestDocument[]
}

export interface TestDocument {
  id: string
  test_id: string
  storage_path: string
  file_name: string
  file_size: number | null
  doc_type: 'Result Sheet' | 'Certificate' | 'Method Statement' | 'Witness Sheet' | 'Calibration Certificate' | 'Other'
  uploaded_by: string | null
  uploaded_at: string
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
