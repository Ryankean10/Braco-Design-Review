-- ============================================================
-- Seed data — Standards Register
-- ============================================================

insert into public.standards (ref, title, body, category, status, effective_date, summary, source_url) values

-- Grid Connection / Protection
('ENA EREC G99 Issue 2',
 'Requirements for the Connection of Generation Equipment in Parallel with Public Distribution Networks above 16 A',
 'Energy Networks Association (ENA)',
 'Grid Connection',
 'In Force',
 '2026-03-01',
 'Mandatory standard for all generating plant > 16 A/phase connecting to UK distribution networks. Issue 2 (in force 1 Mar 2026) introduces new mandatory requirements for electricity storage (BESS), updated loss of mains (LoM) protection thresholds, strengthened reactive power obligations, and revised fault ride-through rules. Replaces Issue 1 Amendment 9 (2022).',
 'https://www.energynetworks.org/publications/erec-g99-requirements-for-connection-of-generation-equipment'),

('ENA EREC G98 Issue 1 Amendment 5',
 'Requirements for the Connection of Fully Type Tested Micro-generators in Parallel with a Public Low Voltage Distribution Network',
 'Energy Networks Association (ENA)',
 'Grid Connection',
 'In Force',
 '2022-01-01',
 'Covers micro-generators up to 16 A/phase per phase. Not directly applicable to utility-scale BESS but referenced for domestic storage.',
 'https://www.energynetworks.org/publications/erec-g98'),

('BS EN IEC 62271-200:2021',
 'High-voltage switchgear and controlgear — AC metal-enclosed switchgear and controlgear for rated voltages above 1 kV and up to and including 52 kV',
 'British Standards Institution / IEC',
 'Electrical',
 'In Force',
 '2021-05-01',
 'Specifies requirements for AC metal-enclosed switchgear (11 kV, 33 kV). Key classifications: Loss of Service Continuity (LSC) category A or B, Internal Arc Classification (IAC), partition class (PM, PI), accessibility class (A, B, C). IAC testing mandatory for substations. All MV switchgear for BESS grid connection must meet this standard.',
 'https://www.en-standard.eu/bs-en-iec-62271-200-2021'),

('BS EN IEC 62271-100:2021',
 'High-voltage switchgear and controlgear — AC circuit-breakers',
 'British Standards Institution / IEC',
 'Electrical',
 'In Force',
 '2021-01-01',
 'Requirements for AC circuit-breakers above 1 kV. Covers short-circuit breaking capacity, TRV requirements, rated operating sequence, mechanical endurance. Applicable to HV circuit-breakers in BESS substation.',
 null),

('IEC 62619:2022',
 'Secondary cells and batteries containing alkaline or other non-acid electrolytes — Safety requirements for secondary lithium cells and batteries for use in industrial applications',
 'IEC',
 'Fire & BESS Safety',
 'In Force',
 '2022-01-01',
 'Fundamental battery cell/module safety standard for BESS. Covers: abuse tolerance (overcharge, over-discharge, short-circuit, crush, thermal), mechanical integrity, environmental testing, documentation. Required for CE/UKCA marking of battery systems. Complemented by UL 9540A for thermal propagation.',
 'https://www.iec.ch/obb/'),

('IEC 62933-2-1:2017',
 'Electrical energy storage (EES) systems — Unit parameters and testing methods — General specification',
 'IEC',
 'Fire & BESS Safety',
 'In Force',
 '2017-01-01',
 'Defines performance and safety parameters for grid-connected EES systems including round-trip efficiency, response time, ramp rate, state of charge accuracy. Referenced by DNOs and NESO for BESS performance verification.',
 null),

('BS EN 1997-1:2004+A1:2013 (Eurocode 7)',
 'Geotechnical design — Part 1: General rules',
 'British Standards Institution / CEN',
 'Civils & Geotechnical',
 'In Force',
 '2013-01-01',
 'Limit state design standard for geotechnical structures. Mandates Geotechnical Design Report (GDR). Three Design Approaches (DA1, DA2, DA3) with partial factors. Key checks: ULS bearing capacity, SLS settlement (Annex H limits), slope stability. Geotechnical Category (GC1–GC3) determines investigation and monitoring requirements. BESS pad foundations typically GC2 requiring site investigation and ground model.',
 'https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/06_EC2WS_Frank_Geotechnics.pdf'),

('BS 5975:2019+A1:2021',
 'Code of practice for temporary works procedures and the permissible stress design of falsework',
 'British Standards Institution',
 'Temporary Works',
 'In Force',
 '2021-01-01',
 'Governing standard for temporary works in UK construction. Introduces PC Temporary Works Coordinator (PC TWC). All temporary works designs categorised 0–3; Category 2 and above require independent check by Temporary Works Design Checker (TWDC). Requires Temporary Works Register and permit-to-load system. Interfaces with CDM 2015.',
 'https://imperiumengineering.co.uk/british-standards-for-temporary-works-design-what-you-need-to-know/'),

('BS 7121 Parts 1-4',
 'Code of practice for safe use of cranes',
 'British Standards Institution',
 'Temporary Works',
 'In Force',
 '2016-01-01',
 'Covers planning, use and thorough examination of cranes. Part 1 general; Part 2 mobile cranes; Part 4 tower cranes. Requires Appointed Person (AP) for every crane operation lift plan. BESS module installation involves heavy lifts — AP-supervised lift plans mandatory. Ground bearing pressure checks under BS 5975.',
 null),

('Construction (Design and Management) Regulations 2015',
 'CDM 2015',
 'UK Parliament / HSE',
 'CDM / H&S',
 'In Force',
 '2015-04-06',
 'Statutory regulations placing health and safety duties on Clients, Principal Designers, Designers, Principal Contractors and Contractors. Projects with more than one contractor require appointment of Principal Designer and Principal Contractor. Requires: pre-construction information pack, Construction Phase Plan (CPP), Health & Safety File. Notifiable projects (>30 working days with >20 workers simultaneously, or >500 person-days) require F10 notification to HSE.',
 'https://www.hse.gov.uk/construction/cdm/2015/summary.htm'),

('HSG47 (Third Edition 2014)',
 'Avoiding danger from underground services',
 'HSE',
 'CDM / H&S',
 'In Force',
 '2014-01-01',
 'HSE guidance on safe excavation near buried utilities. Three-stage safe system: (1) desktop survey & service records, (2) CAT (Cable Avoidance Tool) and Genny survey before any excavation, (3) safe hand dig within 0.5 m tolerance zone. Excavation permits required. Records must be obtained from all utility providers before breaking ground.',
 'https://www.hse.gov.uk/pubns/books/hsg47.htm'),

('NJUG Volume 1 Issue 8',
 'Guidelines on the Positioning and Colour Coding of Utilities Apparatus',
 'National Joint Utilities Group (NJUG)',
 'CDM / H&S',
 'In Force',
 '2022-01-01',
 'Standard burial depths and colours for UK utilities. Electricity: 750 mm (roads/verges), 600 mm (footways), red/black ducting. Gas: 750 mm (roads), 600 mm (footways), yellow. Water: 750–1350 mm, blue. Service separation ≥150 mm. Applicable to BESS site groundworks and HV cable routes.',
 'http://streetworks.org.uk/wp-content/uploads/2024/07/Updated-SWUK-Guidance-on-the-Positioning-and-Colour-Coding-of-Underground-Utilities-Apparatus.pdf'),

('BS EN IEC 60364-4-41:2017',
 'Low-voltage electrical installations — Protection for safety — Protection against electric shock',
 'British Standards Institution / IEC',
 'Electrical',
 'In Force',
 '2017-01-01',
 'Fundamental LV earthing and shock protection standard. Defines earthing arrangements: TN-S, TN-C-S, TT, IT. Protective bonding requirements. Disconnection time limits (0.4 s / 5 s depending on system type and voltage). Applicable to LV auxiliary supplies and container LV distribution within BESS enclosures.',
 null);


-- ============================================================
-- Seed — Standard Clauses (G99 Issue 2 key clauses)
-- ============================================================

with g99 as (select id from public.standards where ref = 'ENA EREC G99 Issue 2' limit 1)
insert into public.standard_clauses (standard_id, clause_ref, heading, body, review_lenses, severity_hint)
select g99.id, clause_ref, heading, body, review_lenses::text[], severity_hint
from g99, (values

  ('Section 5 / Table 3',
   'Voltage protection trip thresholds — Stage 1',
   'Under-voltage Stage 1: V < 0.87 pu — trip within 2.5 s. Over-voltage Stage 1: V > 1.1 pu — trip within 1.0 s. Under-voltage Stage 2: V < 0.80 pu — trip within 0.5 s. Over-voltage Stage 2: V > 1.14 pu — trip within 0.5 s. These are mandatory minimum settings; DNO may specify tighter values.',
   '{"Standards & Compliance","Testing & Commissioning"}',
   'Critical'),

  ('Section 5 / Table 4',
   'Frequency protection trip thresholds',
   'Under-frequency Stage 1: f < 47.5 Hz — trip within 20 s. Under-frequency Stage 2: f < 47.0 Hz — trip within 0.5 s. Over-frequency Stage 1: f > 52.0 Hz — trip within 0.5 s. Over-frequency Stage 2: f > 52.0 Hz — trip within 0.5 s. These align with GB Grid Code frequency ranges.',
   '{"Standards & Compliance","Testing & Commissioning"}',
   'Critical'),

  ('Section 5.5',
   'Loss of Mains (LoM) protection — RoCoF',
   'Rate of Change of Frequency (RoCoF) relay mandatory for all Type B and above (P > 1 MW). Default setting: 1.0 Hz/s measured over a 500 ms window. Vector shift relay: default 12°. DNO may require alternative settings. LoM must be independently tested at commissioning stage; test records retained in ITP.',
   '{"Standards & Compliance","Testing & Commissioning","Protection"}',
   'Critical'),

  ('Section 5.6',
   'Reconnection after disconnection',
   'Following disconnection by voltage or frequency protection, the Power Generating Module shall not reconnect until: (a) voltage within Stage 1 limits for a minimum of 20 s; (b) frequency within Stage 1 limits for a minimum of 20 s. Both conditions must be simultaneously satisfied before reconnection sequence may begin.',
   '{"Standards & Compliance","Testing & Commissioning"}',
   'Major'),

  ('Section 6.3',
   'Reactive power capability — 1 MW to 10 MW modules',
   'Power Generating Modules rated 1 MW to 10 MW must be capable of continuous operation between 0.95 power factor lagging and 0.95 power factor leading at the connection point when operating at registered capacity. DNO may require operation at a fixed power factor, reactive power set-point, or automatic voltage regulation mode.',
   '{"Standards & Compliance","Procurement"}',
   'Major'),

  ('Section 6.4',
   'Reactive power capability — above 10 MW',
   'Power Generating Modules above 10 MW must meet the reactive power capability envelope defined by the DNO network study. Typically Q range of ±0.33 pu at rated MW output. Automatic Voltage Regulation (AVR) with voltage droop 2–7% required unless otherwise agreed.',
   '{"Standards & Compliance","Procurement"}',
   'Major'),

  ('Section 7 / Annex A',
   'Fault ride-through (FRT) requirements',
   'Type B and above must ride through voltage dips to 0.15 pu for 140 ms and return to ≥0.9 pu within 1.5 s. Must remain connected during symmetrical three-phase faults on the distribution network. BESS inverters must inject reactive current during voltage dips at a rate of 2% per 1% voltage drop.',
   '{"Standards & Compliance","Procurement"}',
   'Critical'),

  ('Section 8',
   'Electricity storage — specific requirements (Issue 2 additions)',
   'BESS (Electricity Storage) must comply with all relevant sections of G99 in both charge and discharge modes. Bidirectional metering required. Protection settings must be evaluated for both import and export conditions. Storage state of charge (SoC) management must not cause inadvertent disconnection from the network. Pre-energisation test programme to be agreed with DNO.',
   '{"Standards & Compliance","Testing & Commissioning"}',
   'Critical'),

  ('Section 12',
   'Type testing and certification (Form A2)',
   'All Power Generating Modules must be type tested and hold valid G99 Form A2 (Type A) or equivalent for the inverter/converter type. Form A2 must be submitted with connection application. DNO may accept alternative type test evidence for novel topologies subject to agreement. BESS must hold IEC 62619 certification.',
   '{"Standards & Compliance","Procurement"}',
   'Major'),

  ('Section 13 / Annex G',
   'Commissioning tests — mandatory schedule',
   'Prior to energisation, the following tests must be witnessed by DNO or submitted as witnessed test records: (1) protection relay functional test, (2) RoCoF relay test at 1.0 Hz/s, (3) vector shift test at 12°, (4) reactive power capability demonstration, (5) anti-islanding test, (6) fault ride-through test (simulated). All results recorded in ITP and provided to DNO at FON stage.',
   '{"Testing & Commissioning","Standards & Compliance"}',
   'Critical')

) as t(clause_ref, heading, body, review_lenses, severity_hint);


-- ============================================================
-- Seed — Standard Clauses (CDM 2015 key duties)
-- ============================================================

with cdm as (select id from public.standards where ref = 'Construction (Design and Management) Regulations 2015' limit 1)
insert into public.standard_clauses (standard_id, clause_ref, heading, body, review_lenses, severity_hint)
select cdm.id, clause_ref, heading, body, review_lenses::text[], severity_hint
from cdm, (values

  ('Regulation 4',
   'Client duties — suitable arrangements',
   'Client must make suitable arrangements for managing the project, including allocation of sufficient time and resources. Must appoint a Principal Designer and Principal Contractor in writing before construction begins where more than one contractor is to be involved. Client retains duty even if they delegate management to others.',
   '{"Standards & Compliance","Civils & Temporary Works"}',
   'Critical'),

  ('Regulation 11',
   'Principal Designer duties',
   'Principal Designer must: (a) plan, manage, monitor and co-ordinate pre-construction H&S; (b) identify and, where possible, eliminate foreseeable risks; (c) ensure all designers co-operate and comply; (d) liaise with Principal Contractor throughout; (e) prepare and maintain the Health & Safety File.',
   '{"Standards & Compliance","Civils & Temporary Works"}',
   'Major'),

  ('Regulation 12',
   'Principal Contractor duties — Construction Phase Plan',
   'Principal Contractor must: (a) draw up Construction Phase Plan before site set up; (b) manage and monitor health and safety during construction; (c) arrange suitable site inductions; (d) ensure only authorised persons access site; (e) consult workers on H&S matters.',
   '{"Standards & Compliance","Civils & Temporary Works"}',
   'Major'),

  ('Regulation 15',
   'Notifiable projects — F10 notification',
   'Projects involving more than 30 working days with more than 20 simultaneous workers, or more than 500 person-days total, must be notified to HSE via F10 form before construction phase begins. BESS construction projects typically meet this threshold.',
   '{"Standards & Compliance","Civils & Temporary Works"}',
   'Critical')

) as t(clause_ref, heading, body, review_lenses, severity_hint);


-- ============================================================
-- Seed — Standard Clauses (BS 5975 key clauses)
-- ============================================================

with bs5975 as (select id from public.standards where ref = 'BS 5975:2019+A1:2021' limit 1)
insert into public.standard_clauses (standard_id, clause_ref, heading, body, review_lenses, severity_hint)
select bs5975.id, clause_ref, heading, body, review_lenses::text[], severity_hint
from bs5975, (values

  ('Clause 6.2',
   'Temporary Works Coordinator appointment',
   'A Temporary Works Coordinator (TWC) must be appointed in writing by the contractor for all temporary works. On multi-contractor projects, the Principal Contractor must also appoint a PC TWC. The TWC must be competent (relevant qualifications and experience) and have authority to stop work if temporary works are unsafe.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Critical'),

  ('Clause 9 / Table 1',
   'Design check categories',
   'Category 0: standard solution from code/published table — self-checked by designer. Category 1: straightforward design — checked by another competent person in same organisation. Category 2: more complex design — independent check by Temporary Works Design Checker (TWDC) from different organisation. Category 3: high-risk or unusual design — full independent check; may require specialist review. BESS module lift plans, falsework, retention systems typically Category 2.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major'),

  ('Clause 11',
   'Temporary Works Register',
   'Contractor must maintain a Temporary Works Register listing all temporary works elements, their design check category, design check certificate reference, permit to load/strike date, and inspection records. Register must be available on site at all times and retained for the project duration.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major'),

  ('Clause 14',
   'Permit to load / permit to strike',
   'Before any temporary works are loaded or struck, a Permit to Load or Permit to Strike must be issued by the TWC (or delegated competent person). Permit confirms the works have been erected in accordance with the design, are inspected and safe to load/strip. Records retained.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major')

) as t(clause_ref, heading, body, review_lenses, severity_hint);


-- ============================================================
-- Seed — Eurocode 7 key clauses
-- ============================================================

with ec7 as (select id from public.standards where ref = 'BS EN 1997-1:2004+A1:2013 (Eurocode 7)' limit 1)
insert into public.standard_clauses (standard_id, clause_ref, heading, body, review_lenses, severity_hint)
select ec7.id, clause_ref, heading, body, review_lenses::text[], severity_hint
from ec7, (values

  ('Section 2.4 / Annex B',
   'Geotechnical Categories',
   'GC1: small, simple structures — limited investigation, experienced engineer. GC2: conventional structures — site investigation, design by qualified geotechnical engineer. GC3: unusual structures or poor ground — extensive investigation, specialist design and monitoring. BESS pad foundations and access roads typically GC2; piled foundations or contaminated sites may be GC3.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major'),

  ('Section 6.5',
   'Bearing resistance — ULS check',
   'Foundation bearing resistance must satisfy: Vd ≤ Rd where Vd is design vertical action and Rd is design bearing resistance. Partial factor γR = 1.0 (DA1 Combination 2) applied to soil strength. Eccentricity of load must not exceed B/3 for strip, B/6 for pad (effective area method). BESS containers are heavy eccentric loads — check for each load case (full/empty modules, wind uplift).',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major'),

  ('Section 6.6 / Annex H',
   'Settlement — SLS limits',
   'Maximum allowable total settlement: 50 mm typical for rigid structures; differential settlement between adjacent foundations ≤ 15–20 mm unless structure can accommodate more. BESS cable connections and buswork tolerances dictate tighter limits — verify with equipment manufacturer. Annex H indicative values; project-specific limits must be established and checked by design.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major'),

  ('Section 12',
   'Retaining structures',
   'Stability of embedded retaining walls (sheet piles, contiguous piles) must be verified for ULS (overturning, sliding, bearing, heave) and SLS (wall deflection, ground settlement). Required for BESS sites with ground level differences > 1 m or where cut slopes approach. Monitoring programme required during construction for GC3 or complex retaining works.',
   '{"Civils & Temporary Works","Standards & Compliance"}',
   'Major')

) as t(clause_ref, heading, body, review_lenses, severity_hint);


-- ============================================================
-- Seed — H&S References
-- ============================================================

insert into public.hs_references (ref, title, duty_holder, body, category, source_url) values

('CDM 2015 Reg 4',
 'Client — suitable project management arrangements',
 'Client',
 'Client must make and maintain suitable arrangements for managing the project so that construction work can be carried out so far as is reasonably practicable without risk to H&S. Includes appointing competent Principal Designer and Principal Contractor, ensuring pre-construction information is compiled and shared.',
 'CDM',
 'https://www.hse.gov.uk/construction/cdm/2015/clients.htm'),

('CDM 2015 Reg 11',
 'Principal Designer — pre-construction H&S coordination',
 'Principal Designer',
 'Must plan, manage, monitor and co-ordinate pre-construction H&S. Identify, eliminate or control foreseeable risks. Ensure designers carry out their duties. Prepare and maintain the Health & Safety File. Provide relevant information to the Principal Contractor.',
 'CDM',
 'https://www.hse.gov.uk/construction/cdm/2015/principal-designers.htm'),

('CDM 2015 Reg 12',
 'Principal Contractor — Construction Phase Plan and site management',
 'Principal Contractor',
 'Must draw up the Construction Phase Plan before construction begins. Manage and monitor H&S during construction. Ensure site inductions and restrict access to authorised persons only. Consult with workers. Liaise with Principal Designer for the duration of appointment.',
 'CDM',
 'https://www.hse.gov.uk/construction/cdm/2015/principal-contractors.htm'),

('HSG47 §3',
 'Desktop study and service records before excavation',
 'Principal Contractor / Contractor',
 'Before any excavation, the contractor must obtain records of all underground services from relevant utility owners (electricity, gas, water, telecoms). Records must be obtained from all potentially relevant utilities — do not assume services shown on drawings are complete or accurate. A desktop record search is the first step in the three-stage safe system of work.',
 'Underground Services',
 'https://www.hse.gov.uk/pubns/books/hsg47.htm'),

('HSG47 §4',
 'CAT and Genny survey — locating buried services',
 'Principal Contractor / Contractor',
 'A Cable Avoidance Tool (CAT) and signal generator (Genny) survey must be carried out immediately before any excavation commences. CAT operator must be trained and competent. Survey must cover full area of planned excavation plus 1–2 m clearance on all sides. Results documented and marked out on ground.',
 'Underground Services',
 'https://www.hse.gov.uk/pubns/books/hsg47.htm'),

('HSG47 §5',
 'Hand digging within tolerance zone',
 'Contractor',
 'Once a service is located, hand digging (or safe mechanical equivalent with approval) must be used within 0.5 m of the estimated service position. Do not use mechanical excavation within 0.5 m of a live service. Expose service sufficiently to confirm its exact position before continuing excavation.',
 'Underground Services',
 'https://www.hse.gov.uk/pubns/books/hsg47.htm'),

('NJUG Vol 1 Issue 8',
 'Standard burial depths and service separation',
 'Designer / Principal Contractor',
 'Standard depths: Electricity cables 750 mm (roads/verges), 600 mm (footways). Gas pipes 750 mm (roads), 600 mm (footways). Water pipes 750–1350 mm. Minimum horizontal separation between services 150 mm. Where services must cross, vertical separation ≥150 mm. BESS HV cable routes must respect these clearances and be confirmed by CAT survey.',
 'Underground Services',
 'http://streetworks.org.uk/wp-content/uploads/2024/07/Updated-SWUK-Guidance-on-the-Positioning-and-Colour-Coding-of-Underground-Utilities-Apparatus.pdf'),

('BS 7121-1 §10',
 'Appointed Person — lift planning',
 'Contractor / Temporary Works Coordinator',
 'Every crane lifting operation requires an Appointed Person (AP) who is competent and independent of commercial pressures. AP must produce a Lift Plan for every lift covering: equipment selection, ground bearing pressure, radius and load charts, slinging arrangements, exclusion zones, emergency procedures. BESS module installation involves lifts > 5 t — AP mandatory.',
 'Lifting Operations',
 'https://www.hse.gov.uk/work-equipment-machinery/loler.htm'),

('LOLER 1998 Reg 8',
 'Thorough examination — lifting equipment',
 'Employer / Contractor',
 'All lifting equipment used on site must have a current thorough examination certificate (6-monthly for equipment used for lifting persons; 12-monthly for other lifting equipment). Records must be available on site. Cranes, MEWPS and lifting accessories must be checked before first use and at required intervals.',
 'Lifting Operations',
 'https://www.hse.gov.uk/work-equipment-machinery/loler.htm'),

('IEC 62619:2022 §6',
 'Battery system safety — thermal runaway prevention',
 'Designer / Manufacturer',
 'BESS cells/modules must be certified to IEC 62619. Battery management system (BMS) must include: overcharge protection, over-discharge protection, over-temperature shutdown, short-circuit protection. Thermal runaway propagation must be evaluated per UL 9540A. Fire suppression system must be designed with reference to thermal runaway gas release rates and volumes per container.',
 'Fire & Explosion',
 'https://www.iec.ch/obb/'),

('BS EN 13501-1',
 'Fire classification of construction products — reaction to fire',
 'Designer',
 'All construction products in BESS containers and substation must meet minimum fire reaction classification. Battery enclosure structure typically required to achieve A1 or A2-s1,d0 classification. Fire suppression system actuation must not compromise structural integrity. Fire strategy report required for all BESS sites — coordinate with local fire service for emergency response planning.',
 'Fire & Explosion',
 null);


-- ============================================================
-- Seed — Operator Rules (SSEN / Generic DNO + NESO)
-- ============================================================

insert into public.operator_rules (operator, rule_ref, title, body, category, applicable_voltage_kv, source_url) values

('SSEN (SSE Northern)',
 'G99 Issue 2 §5 / SSEN DG Policy',
 'Protection relay settings — SSEN distribution zones',
 'SSEN requires all G99 connections to submit protection relay co-ordination study. Under-voltage Stage 1: 0.87 pu / 2.5 s. Over-voltage Stage 1: 1.10 pu / 1.0 s. Frequency: 47.0 Hz / 0.5 s; 52.0 Hz / 0.5 s. RoCoF: 1.0 Hz/s / 500 ms window. Vector shift: 12°. Settings confirmed by DNO after network study — do not use default settings without DNO written confirmation.',
 'Protection Settings',
 '11, 33',
 'https://www.ssen.co.uk/get-connected/generation-connections/'),

('SSEN (SSE Northern)',
 'SSEN DG Policy §4.3',
 'Reactive power operating mode',
 'For BESS > 1 MW at 11 kV: SSEN default operating mode is Unity Power Factor unless network study identifies voltage issues. For projects > 10 MW or at 33 kV: Automatic Voltage Regulation (AVR) mode required with 4% droop. Mode confirmed at FON stage. No unilateral changes to reactive power operating mode post-energisation.',
 'Reactive Power',
 '11, 33',
 null),

('SSEN (SSE Northern)',
 'SSEN Metering Policy',
 'Metering requirements — BESS sites',
 'Half-hourly metering mandatory for BESS > 100 kW. Smart meters (SMETS2 compliant) for import/export metering at Point of Connection (PoC). Bidirectional CT metering required — confirm CT ratio and meter type with SSEN metering department at IAN stage. Meter serial numbers to be provided at FON.',
 'Metering',
 '11, 33',
 null),

('NESO (National Energy System Operator)',
 'Grid Code ECP.11.7',
 'ECP.11.7 — Generating Unit performance monitoring',
 'Transmission-connected BESS must comply with ECP.11.7 covering: Frequency Response (FFR, EFR, Firm Frequency Response), Reactive Power, Fault Ride-Through, SCADA data requirements. Performance monitoring via NETS SQSS. Despatch instructions via BM (Balancing Mechanism) or ancillary service contracts. Issue 6 Revision 41 (June 2026) introduced updated SOC visibility requirements for storage participants.',
 'Grid Code',
 '132, 275, 400',
 'https://www.neso.energy/industry-information/codes/grid-code'),

('NESO (National Energy System Operator)',
 'Grid Code BC2',
 'Frequency response obligations — transmission-connected BESS',
 'All transmission-connected BMUs must provide Mandatory Frequency Response (MFR) capability: primary response within 10 s, secondary response within 30 s. BESS must not trip on under-frequency events within the statutory range 47.0–52.0 Hz. FFR delivery windows: response within 1 s, sustained for 30 s minimum. SOC must be managed to ensure response capability at all times.',
 'Grid Code',
 '132, 275, 400',
 null),

('All GB DNOs',
 'G99 Issue 2 §13',
 'Pre-energisation test programme — mandatory steps',
 'Before any G99 connection energises, the following must be completed and records submitted to DNO: (1) G99 Form A2 type test certificate for each inverter/converter type; (2) site commissioning test report covering all mandatory tests in Annex G; (3) protection relay settings confirmation signed by DNO; (4) ITP (Inspection and Test Plan) with all hold points signed off; (5) FON (Final Offer Notice) acceptance. Energisation cannot proceed until DNO issues final written consent.',
 'Protection Settings',
 '11, 33, 132',
 null),

('All GB DNOs',
 'G99 §8 / IEC 62619',
 'BESS-specific pre-connection requirements',
 'BESS connecting under G99 must provide: (a) IEC 62619 certificate for battery cells/modules; (b) BMS functional description and settings; (c) Thermal runaway assessment confirming no propagation to adjacent containers; (d) Fire suppression system design and actuation logic; (e) Description of BESS behaviour during all G99 protection trip events (both import and export modes). These documents are reviewed at IAN stage.',
 'Protection Settings',
 '11, 33',
 null);


-- ============================================================
-- Seed — Lessons Learned (BESS construction generic)
-- ============================================================

insert into public.lessons_learned (title, description, category, severity, source, review_lenses) values

('HV cable route — uncharted services found during excavation',
 'During HV cable trench excavation, uncharted 11 kV cables and a gas main were encountered that did not appear on utility records. Work stopped for 3 days pending re-survey. Root cause: desktop survey only covered public highways; private cables on developer land not registered with DNO. Lesson: commission full intrusive investigation including private infrastructure before finalising HV cable route. Request records from site owner, previous operators and DNO — not just public utility searches.',
 'Civils',
 'Critical',
 'Generic BESS industry lessons',
 '{"Civils & Temporary Works","Constructability"}'),

('BESS module delivery — ground bearing failure on temporary haul road',
 'During delivery of BESS containers (30 t each on articulated lorry), haul road substrate failed causing lorry to become stuck and damaging installed cabling. Root cause: haul road designed for 20 t axle load; delivery vehicle exceeded design load. Lesson: obtain maximum axle load from all delivery contractors during procurement. Ground-bearing assessment must cover loaded delivery vehicles, not just operating loads.',
 'Construction',
 'Major',
 'Generic BESS industry lessons',
 '{"Constructability","Civils & Temporary Works"}'),

('Protection relay settings — wrong RoCoF window installed',
 'During commissioning, DNO witness test revealed protection relay had been programmed with 200 ms RoCoF measurement window instead of mandatory 500 ms. This caused the relay to trip on normal transient frequency fluctuations during testing. Re-programming and retest required — 2 week programme delay. Lesson: relay settings document must be reviewed and approved by DNO before relays are programmed. Commissioning ITP must include DNO-signed settings confirmation as a hold point.',
 'Protection',
 'Critical',
 'Generic BESS industry lessons',
 '{"Testing & Commissioning","Standards & Compliance"}'),

('Inverter G99 Form A2 — expired certificate discovered at FON',
 'At FON stage, DNO rejected the G99 Form A2 type test certificate because it had been issued for an earlier firmware version and was > 3 years old. Supplier had updated inverter firmware during production without re-certifying. New type testing required — 8 week delay. Lesson: specify in procurement that G99 Form A2 must be current (< 3 years) and valid for the exact firmware version to be supplied. Check certificate at tender stage, not at commissioning.',
 'Procurement',
 'Critical',
 'Generic BESS industry lessons',
 '{"Procurement","Standards & Compliance"}'),

('Foundation settlement — differential movement between container and cable pit',
 'After 6 months operation, differential settlement of 18 mm between BESS container pad and adjacent HV cable pit caused stress on HV cable terminations and cracking of cable pit lid. Root cause: cable pit founded on disturbed backfill without compaction testing; container pad on engineered imported fill. Lesson: ensure all foundations within a BESS compound are designed to compatible settlement limits. Cable pit and cable route foundations must be included in geotechnical design, not treated as minor civil works.',
 'Civils',
 'Major',
 'Generic BESS industry lessons',
 '{"Civils & Temporary Works","Constructability"}'),

('Thermal runaway fire — suppression system failed to actuate',
 'Thermal runaway event in one battery string. Cabinet-level suppression system failed to actuate due to incorrect wiring of suppression trigger relay (normally-open vs normally-closed configuration). Fire spread to adjacent string before manual intervention. Lesson: suppression system commissioning must include end-to-end functional test of suppression trigger logic, not just continuity checks. ITP must include suppression system actuation test as a hold point witnessed by installer and fire engineer.',
 'Commissioning',
 'Critical',
 'Generic BESS industry lessons',
 '{"Testing & Commissioning","Standards & Compliance"}'),

('Crane lift — ground bearing plates omitted on soft ground',
 'Mobile crane set up without ground bearing plates on area of made ground. Outrigger pad sank during lift of BESS container (28 t), causing load swing. No injuries but lift aborted. Root cause: Lift Plan based on hard standing classification; actual ground conditions not verified. Lesson: AP must confirm actual ground conditions at crane set-up positions before lift commences. Ground bearing calculation must be site-specific — do not use generic hard standing assumptions.',
 'Construction',
 'Critical',
 'Generic BESS industry lessons',
 '{"Civils & Temporary Works","Constructability"}'),

('Lead time — HV switchgear 52-week delivery not flagged at design stage',
 'Project programme assumed 26-week delivery for 11 kV switchgear. Actual manufacturer lead time at time of order was 52 weeks. Discovery made at detailed design stage — 26-week programme overrun. Lesson: obtain written lead time confirmation from at least two manufacturers for all HV switchgear and transformers at RIBA Stage 2 (Concept Design). Do not rely on historical lead times — supply chain disruption has extended lead times significantly since 2022.',
 'Procurement',
 'Critical',
 'Generic BESS industry lessons',
 '{"Procurement","Constructability"}'),

('DNO IAN conditions — earthing requirement changed post-IAN',
 'DNO issued IAN with earthing conditions referencing BS 7671 Amendment 2. After detailed design was complete, DNO issued revised earthing conditions citing updated network earthing policy requiring a dedicated earth electrode system separate from the distribution transformer earth. Redesign and re-cabling required. Lesson: request DNO earthing policy document and any site-specific earthing requirements at pre-application meeting. Confirm earthing requirements in writing with DNO at IAN stage before completing earth electrode design.',
 'Electrical',
 'Major',
 'Generic BESS industry lessons',
 '{"Standards & Compliance","Constructability"}');
