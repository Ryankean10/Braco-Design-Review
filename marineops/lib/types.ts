export type VesselStatus = 'active' | 'laid-up' | 'refit' | 'sold'
export type VesselType = 'Motor Yacht' | 'Sailing Yacht' | 'Motor Sailer' | 'Explorer' | 'Other'
export type ClassSociety = 'LR' | 'BV' | 'DNV' | 'RINA' | 'ABS' | 'None'
export type Priority = 'critical' | 'high' | 'medium' | 'low'
export type TrafficLight = 'green' | 'amber' | 'red' | 'neutral'

export type EquipmentStatus = 'operational' | 'degraded' | 'failed' | 'decommissioned'
export type MaintenanceCategory = 'Routine' | 'Seasonal' | 'Overhaul' | 'Condition-based' | 'Class'
export type IntervalType = 'calendar' | 'hours' | 'both'
export type WorkOrderStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'cancelled'
export type WorkOrderType = 'planned' | 'corrective' | 'class' | 'warranty' | 'improvement'
export type DefectStatus = 'open' | 'in_progress' | 'closed' | 'deferred'
export type DefectSeverity = 'critical' | 'major' | 'minor' | 'observation'
export type SurveyStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'waived'
export type CrewStatus = 'onboard' | 'signed_off' | 'shore_based'
export type POStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'invoiced' | 'cancelled'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'engineer' | 'viewer'
  created_at: string
}

export interface Vessel {
  id: string
  name: string
  imo_number: string | null
  mmsi: string | null
  call_sign: string | null
  flag: string
  port_of_registry: string | null
  class_society: ClassSociety | null
  class_notation: string | null
  vessel_type: VesselType
  gt: number | null
  nt: number | null
  loa_m: number | null
  beam_m: number | null
  max_draught_m: number | null
  year_built: number | null
  place_of_build: string | null
  hull_material: string | null
  main_engine_maker: string | null
  main_engine_model: string | null
  owner: string | null
  operator: string | null
  manager: string | null
  image_path: string | null
  status: VesselStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VesselRole {
  id: string
  user_id: string
  vessel_id: string | null
  role: 'fleet_manager' | 'captain' | 'chief_engineer' | 'engineer' | 'viewer'
  created_at: string
}

export interface VesselLocation {
  id: string
  vessel_id: string
  name: string
  parent_id: string | null
}

export interface Equipment {
  id: string
  vessel_id: string
  location_id: string | null
  name: string
  category: string
  maker: string | null
  model: string | null
  serial_no: string | null
  year_installed: number | null
  running_hours: number
  hours_updated_at: string | null
  status: EquipmentStatus
  critical: boolean
  class_item: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface RunningHoursLog {
  id: string
  vessel_id: string
  equipment_id: string
  hours: number
  date: string
  notes: string | null
  recorded_by: string | null
  created_at: string
}

export interface MaintenanceJob {
  id: string
  vessel_id: string
  equipment_id: string | null
  title: string
  description: string | null
  category: MaintenanceCategory
  interval_type: IntervalType
  interval_days: number | null
  interval_hours: number | null
  last_done_date: string | null
  last_done_hours: number | null
  next_due_date: string | null
  next_due_hours: number | null
  estimated_hours: number | null
  requires_shutdown: boolean
  class_required: boolean
  priority: Priority
  status: 'active' | 'suspended' | 'decommissioned'
  created_at: string
  updated_at: string
}

export interface WorkOrder {
  id: string
  vessel_id: string
  job_id: string | null
  wo_number: string
  title: string
  description: string | null
  type: WorkOrderType
  status: WorkOrderStatus
  planned_date: string | null
  started_at: string | null
  completed_at: string | null
  assigned_to: string | null
  actual_hours: number | null
  running_hours_at_completion: number | null
  labor_cost: number | null
  budget_code_id: string | null
  remarks: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface WorkOrderPart {
  id: string
  work_order_id: string
  inventory_id: string | null
  description: string
  quantity: number
  unit_cost: number | null
}

export interface InventoryItem {
  id: string
  vessel_id: string
  part_no: string | null
  name: string
  description: string | null
  maker: string | null
  compatible_equipment: string[] | null
  category: string | null
  location_on_vessel: string | null
  unit: string
  quantity: number
  min_quantity: number
  reorder_quantity: number | null
  unit_cost: number | null
  critical_spare: boolean
  class_required: boolean
  image_path: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface StockTransaction {
  id: string
  vessel_id: string
  inventory_id: string
  type: 'receipt' | 'issue' | 'adjustment' | 'transfer'
  quantity: number
  unit_cost: number | null
  work_order_id: string | null
  po_id: string | null
  reference: string | null
  date: string
  notes: string | null
  created_by: string | null
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  country: string | null
  categories: string[] | null
  payment_terms: string | null
  currency: string
  approved: boolean
  rating: number | null
  notes: string | null
  created_at: string
}

export interface Requisition {
  id: string
  vessel_id: string
  req_number: string
  title: string
  status: 'draft' | 'submitted' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled'
  priority: 'urgent' | 'normal' | 'planned'
  required_by: string | null
  notes: string | null
  created_by: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface ReqItem {
  id: string
  req_id: string
  inventory_id: string | null
  description: string
  quantity: number
  unit: string
  estimated_unit_cost: number | null
  work_order_id: string | null
}

export interface PurchaseOrder {
  id: string
  vessel_id: string
  supplier_id: string | null
  req_id: string | null
  po_number: string
  status: POStatus
  currency: string
  exchange_rate: number
  issue_date: string
  expected_delivery: string | null
  delivery_address: string | null
  payment_terms: string | null
  total_amount: number | null
  budget_code_id: string | null
  invoice_no: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PoItem {
  id: string
  po_id: string
  req_item_id: string | null
  inventory_id: string | null
  description: string
  quantity: number
  unit: string
  unit_price: number
  received_quantity: number
}

export interface BudgetCode {
  id: string
  vessel_id: string
  code: string
  name: string
  category: 'opex' | 'capex'
  year: number
  allocated_amount: number
  notes: string | null
}

export interface Expense {
  id: string
  vessel_id: string
  budget_code_id: string | null
  date: string
  amount: number
  currency: string
  exchange_rate: number
  amount_usd: number
  description: string
  vendor: string | null
  work_order_id: string | null
  po_id: string | null
  invoice_no: string | null
  receipt_path: string | null
  created_by: string | null
  created_at: string
}

export interface MaritimeDocument {
  id: string
  vessel_id: string
  doc_no: string | null
  title: string
  category: string
  type: string
  rev: string | null
  issue_date: string | null
  expiry_date: string | null
  issuing_authority: string | null
  storage_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  supersedes: string | null
  status: 'valid' | 'expiring_soon' | 'expired' | 'superseded' | 'pending'
  notes: string | null
  uploaded_by: string | null
  uploaded_at: string
}

export interface Certificate {
  id: string
  vessel_id: string | null
  crew_id: string | null
  entity_type: 'vessel' | 'crew'
  name: string
  cert_number: string | null
  issuing_authority: string | null
  issue_date: string | null
  expiry_date: string | null
  flag_state: string | null
  class_society: string | null
  class_required: boolean
  survey_type: string | null
  document_id: string | null
  created_at: string
  updated_at: string
}

export interface Survey {
  id: string
  vessel_id: string
  type: string
  class_society: string | null
  due_date: string
  window_start: string | null
  window_end: string | null
  completed_date: string | null
  surveyor: string | null
  survey_location: string | null
  status: SurveyStatus
  remarks: string | null
  work_order_id: string | null
  created_at: string
  updated_at: string
}

export interface CrewMember {
  id: string
  vessel_id: string
  user_id: string | null
  first_name: string
  last_name: string
  rank: string
  nationality: string | null
  passport_no: string | null
  seaman_book_no: string | null
  date_of_birth: string | null
  sign_on_date: string | null
  sign_off_date: string | null
  status: CrewStatus
  contact_email: string | null
  contact_phone: string | null
  nok_name: string | null
  nok_contact: string | null
  created_at: string
  updated_at: string
}

export interface Defect {
  id: string
  vessel_id: string
  ref_no: string
  title: string
  description: string | null
  equipment_id: string | null
  type: string
  severity: DefectSeverity
  source: string | null
  status: DefectStatus
  reported_by: string | null
  reported_date: string
  work_order_id: string | null
  closed_date: string | null
  corrective_action: string | null
  class_notified: boolean
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: 'insert' | 'update' | 'delete'
  table_name: string
  record_id: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: string
}

export interface FleetKPIs {
  maintenanceCompliance: number
  overdueJobs: number
  expiringCerts: number
  budgetBurn: number
  criticalStock: number
  openNcrs: number
}

export interface BudgetUtilization {
  id: string
  vessel_id: string
  code: string
  name: string
  category: string
  year: number
  allocated_amount: number
  spent: number
  remaining: number
  utilization_pct: number
}
