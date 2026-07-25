export const CLASS_SOCIETIES = ['LR', 'BV', 'DNV', 'RINA', 'ABS', 'None'] as const

export const VESSEL_TYPES = [
  'Motor Yacht', 'Sailing Yacht', 'Motor Sailer', 'Explorer', 'Other'
] as const

export const VESSEL_STATUSES = ['active', 'laid-up', 'refit', 'sold'] as const

export const EQUIPMENT_CATEGORIES = [
  'Propulsion', 'Navigation', 'Safety', 'Electrical',
  'HVAC', 'Deck', 'Hull', 'Anchor & Mooring', 'Galley', 'Other'
] as const

export const MAINTENANCE_CATEGORIES = [
  'Routine', 'Seasonal', 'Overhaul', 'Condition-based', 'Class'
] as const

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

export const WORK_ORDER_TYPES = [
  'planned', 'corrective', 'class', 'warranty', 'improvement'
] as const

export const DOC_CATEGORIES = [
  'Class', 'Safety', 'Technical', 'Manual', 'Legal', 'ISM', 'ISPS', 'MLC', 'Crew', 'Other'
] as const

export const DOC_TYPES = [
  'Certificate', 'Manual', 'Drawing', 'Report', 'Record', 'Form', 'Policy', 'Other'
] as const

export const CREW_RANKS = [
  'Captain', 'Chief Officer', 'Second Officer', 'Third Officer',
  'Chief Engineer', 'Second Engineer', 'Third Engineer',
  'Bosun', 'Able Seaman', 'Ordinary Seaman',
  'Chief Steward', 'Stewardess', 'Cook', 'Deckhand', 'Other'
] as const

export const SURVEY_TYPES = [
  'annual', 'intermediate', 'special', 'dry_dock', 'bottom',
  'continuous', 'flag_state', 'isps'
] as const

export const DEFECT_TYPES = [
  'defect', 'observation', 'ncr', 'near_miss', 'psc_finding'
] as const

export const DEFECT_SEVERITIES = ['critical', 'major', 'minor', 'observation'] as const

export const BUDGET_CODE_TEMPLATES = [
  { code: 'M01', name: 'Deck Maintenance', category: 'opex' },
  { code: 'M02', name: 'Engine Maintenance', category: 'opex' },
  { code: 'M03', name: 'Hull & Structure', category: 'opex' },
  { code: 'M04', name: 'Electrical Systems', category: 'opex' },
  { code: 'M05', name: 'Safety Equipment', category: 'opex' },
  { code: 'M06', name: 'Navigation Systems', category: 'opex' },
  { code: 'C01', name: 'Class Surveys', category: 'opex' },
  { code: 'C02', name: 'Flag State Inspections', category: 'opex' },
  { code: 'S01', name: 'Spares & Consumables', category: 'opex' },
  { code: 'S02', name: 'Lubricants & Chemicals', category: 'opex' },
  { code: 'F01', name: 'Fuel', category: 'opex' },
  { code: 'F02', name: 'Luboil', category: 'opex' },
  { code: 'CR01', name: 'Crew Wages', category: 'opex' },
  { code: 'CR02', name: 'Crew Travel', category: 'opex' },
  { code: 'CR03', name: 'Crew Training', category: 'opex' },
  { code: 'P01', name: 'Port Dues & Pilotage', category: 'opex' },
  { code: 'I01', name: 'Insurance', category: 'opex' },
  { code: 'A01', name: 'Administration', category: 'opex' },
  { code: 'CAP01', name: 'Engine Overhaul', category: 'capex' },
  { code: 'CAP02', name: 'Refit & Modifications', category: 'capex' },
  { code: 'CAP03', name: 'Equipment Replacement', category: 'capex' },
] as const

export const KPI_THRESHOLDS = {
  maintenanceCompliance: { amber: 90, red: 75 },
  overdueJobs: { amber: 1, red: 5 },
  expiringCerts: { amber: 1, red: 3 },
  budgetBurn: { amber: 80, red: 95 },
  criticalStock: { amber: 1, red: 3 },
  openNcrs: { amber: 1, red: 2 },
} as const
