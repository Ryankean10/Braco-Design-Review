-- ────────────────────────────────────────────────────────────────────────────
-- 024b — Seed work planner knowledge base
-- Benchmarks from Braco, Kilwinning, Dyce (actuals where known, estimated elsewhere)
-- ────────────────────────────────────────────────────────────────────────────

INSERT INTO public.project_benchmarks (
  site_name, capacity_mw, mvs_count, site_area_ha, region, connection_type, terrain,
  total_duration_weeks, peak_crew, total_manhours,
  civil_hours, electrical_hours, mechanical_hours, commissioning_hours, supervision_hours, hv_hours,
  ac_battery_cables, dc_string_cables, lv_cables, comms_cables, hv_cables,
  total_cost, civil_cost, electrical_cost, mechanical_cost, commissioning_cost, supervision_cost,
  source_notes, data_confidence
) VALUES
-- Dyce — most data-rich (construction in progress)
(
  'Dyce BESS', 50, 7, 1.8, 'Scotland', 'distribution', 'standard',
  63, 12, 4800,
  1200, 2100, 600, 480, 420, 0,
  252, 210, 56, 25, 6,
  3200000, 480000, 840000, 240000, 192000, 168000,
  'P6 programme actuals to June 2026; manhours estimated from crew × duration. 63-week contract duration. Connection via iDNO fibre + 11kV ring main.',
  'partial'
),
-- Braco — 50MW under construction
(
  'Braco BESS', 50, 7, 1.6, 'Scotland', 'distribution', 'rural',
  52, 10, 4200,
  1100, 1800, 550, 420, 330, 0,
  240, 196, 48, 22, 6,
  2900000, 440000, 720000, 220000, 168000, 132000,
  'Braco 50MW BESS Scotland. Programme data from May 2026 P6 submission. Rural access adds approx 8% to civil costs.',
  'partial'
),
-- Kilwinning — 27MW smaller site
(
  'Kilwinning BESS', 27, 4, 1.0, 'Scotland', 'distribution', 'standard',
  38, 8, 2600,
  650, 1100, 320, 280, 250, 0,
  140, 112, 32, 14, 4,
  1750000, 260000, 440000, 128000, 112000, 100000,
  'Kilwinning 27MW. Smaller footprint, 4 MVS banks. P6 rev 4.2.1. Proportionally higher supervision ratio on smaller sites.',
  'estimated'
);

-- Long lead library — seeded from BESS project experience
INSERT INTO public.long_lead_library (
  equipment_type, description, typical_lead_weeks_min, typical_lead_weeks_max,
  risk_level, supplier_region, notes, source_projects
) VALUES
('BESS Units / Battery Modules',   'Lithium-ion battery energy storage units including BMS',                    32, 52, 'Critical', 'China/Asia',  'Subject to global supply constraints. Order at FID or earlier. Dyce units arrived week 12 of programme.', ARRAY['Dyce','Braco','Kilwinning']),
('HV Transformer (33kV/11kV)',     '33kV or 11kV grid transformer, oil-cooled',                                 36, 52, 'Critical', 'UK/EU',       'Heavily constrained supply chain 2024-2026. Some suppliers quoting 52+ weeks. Confirm rating early.', ARRAY['Dyce','Braco']),
('MV Switchgear (11kV)',           'Ring main units, circuit breakers, metering panels',                        20, 32, 'High',     'UK/EU',       'iDNO-approved equipment list may restrict supplier choice, adding lead time.', ARRAY['Dyce','Kilwinning']),
('Grid Protection Relays',        'G99 protection scheme, DNO-approved relay set',                             14, 24, 'High',     'UK/EU',       'DNO approval of protection design must precede order. Allow 8 weeks for DNO review in programme.', ARRAY['Dyce','Braco','Kilwinning']),
('Power Conversion System (PCS)', 'Inverter/converter units, DC-AC interface',                                  24, 40, 'Critical', 'EU/Asia',     'Often procured with BESS units as package. Confirm scope split with supplier early.', ARRAY['Dyce','Braco']),
('HV Cables (33kV XLPE)',         '33kV underground cable for grid connection',                                 16, 28, 'High',     'UK/EU',       'Bespoke drum lengths — accurate route survey needed before order. Allow 4 weeks for survey.', ARRAY['Dyce']),
('LV Distribution Boards',        'Main LV distribution, auxiliary supplies, UPS',                              10, 18, 'Medium',   'UK',          'Standard items but verify ratings against BESS auxiliary load schedule.', ARRAY['Dyce','Braco','Kilwinning']),
('DNO Connection Assets',         'Owned by DNO — pole/substation equipment, protection upgrades',              26, 52, 'Critical', 'DNO',         'DNO programme is outside contractor control. Dates set by iDNO/DNO at connection offer stage. Treat as hard constraint.', ARRAY['Dyce','Braco']),
('Fire Suppression System',       'Container-level fire detection and suppression (FM200 / inert gas)',          16, 26, 'High',     'UK/EU',       'Certification requirements affect lead time. Confirm BESS supplier interface early.', ARRAY['Dyce','Braco','Kilwinning']),
('SCADA / EMS System',            'Site SCADA, energy management system, DNO telemetry interface',              14, 22, 'High',     'UK',          'DNO telemetry spec must be confirmed before design freeze. Allow 6 weeks for spec approval.', ARRAY['Dyce','Braco']),
('Civil Groundworks Contractor',  'Foundations, trenching, drainage, access roads',                              6, 12, 'Medium',   'UK',          'Resource availability in Scotland can be constrained in summer. Mobilisation 4-6 weeks after contract award.', ARRAY['Dyce','Braco','Kilwinning']),
('Structural Steel / Containers', 'BESS container frames, cable containment structures',                        12, 20, 'Medium',   'UK/EU',       'Fabrication lead time depends on complexity. Early issue of layout drawings critical.', ARRAY['Dyce','Braco']),
('Fibre / Comms Infrastructure',  'Site comms, iDNO fibre, CCTV, access control',                               8, 16, 'Low',      'UK',          'iDNO fibre connection timing linked to DNO works programme — align early.', ARRAY['Dyce','Kilwinning']),
('Planning Permission',           'Deemed consent (T&CP) or full planning application',                         12, 52, 'High',     'Local Authority', 'Scotland: typically PAN + planning application. Timescale highly variable. Grid-scale battery storage now material change of use.', ARRAY['Dyce','Braco','Kilwinning']);
