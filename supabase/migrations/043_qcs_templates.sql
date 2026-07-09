-- 043 — QCS Template Library

CREATE TABLE IF NOT EXISTS public.qcs_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref           text NOT NULL UNIQUE,          -- IPE-SF-ENE-007
  title         text NOT NULL,                 -- T&C QCS (Energy Projects) - General Inspections
  short_title   text NOT NULL,                 -- General Inspections
  category      text NOT NULL,                 -- 'T&C' | 'CON ELE' | 'CON CIV'
  discipline    text NOT NULL,                 -- 'Electrical' | 'Civils' | 'T&C'
  version       text NOT NULL DEFAULT '1.0',
  keywords      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- for ITP activity matching
  docx_path     text,                          -- Supabase storage path
  pdf_path      text,                          -- Supabase storage path
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.qcs_templates ENABLE ROW LEVEL SECURITY;

-- All internal roles can read templates
CREATE POLICY "qcs_templates_internal_select" ON public.qcs_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'engineer', 'project_manager', 'operative')
    )
  );

-- Only admins can manage templates
CREATE POLICY "qcs_templates_admin_insert" ON public.qcs_templates
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "qcs_templates_admin_update" ON public.qcs_templates
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed all 50 templates
INSERT INTO public.qcs_templates (ref, title, short_title, category, discipline, version, keywords) VALUES
-- T&C Templates
('IPE-SF-ENE-007','T&C QCS (Energy Projects) - General Inspections','General Inspections','T&C','T&C','1.0','["general inspection","general","inspection"]'),
('IPE-SF-ENE-008','T&C QCS (Energy Projects) - Contact Resistance','Contact Resistance','T&C','T&C','2.0','["contact resistance","resistance test","ductor"]'),
('IPE-SF-ENE-009','T&C QCS (Energy Projects) - Auxiliary Relays','Auxiliary Relays','T&C','T&C','1.0','["auxiliary relay","aux relay","relay"]'),
('IPE-SF-ENE-010','T&C QCS (Energy Projects) - Voltage Relays','Voltage Relays','T&C','T&C','1.0','["voltage relay","overvoltage","undervoltage"]'),
('IPE-SF-ENE-011','T&C QCS (Energy Projects) - IEDs & Relay Test Set Report','IEDs & Relay Test Set Report','T&C','T&C','1.0','["IED","relay test","protection relay","intelligent electronic device"]'),
('IPE-SF-ENE-012','T&C QCS (Energy Projects) - CTs','CTs','T&C','T&C','2.0','["CT test","current transformer test","CT commissioning"]'),
('IPE-SF-ENE-013','T&C QCS (Energy Projects) - CTs (Interconnection Tests)','CTs (Interconnection Tests)','T&C','T&C','1.0','["CT interconnection","current transformer interconnection"]'),
('IPE-SF-ENE-014','T&C QCS (Energy Projects) - VTs','VTs','T&C','T&C','1.0','["VT test","voltage transformer test","VT commissioning"]'),
('IPE-SF-ENE-015','T&C QCS (Energy Projects) - Functionality','Functionality','T&C','T&C','1.0','["functionality","functional test","function test"]'),
('IPE-SF-ENE-016','T&C QCS (Energy Projects) - IR and Voltage Withstand','IR and Voltage Withstand','T&C','T&C','1.0','["insulation resistance","IR test","voltage withstand","hi-pot","hipot"]'),
('IPE-SF-ENE-017','T&C QCS (Energy Projects) - VDSs','VDSs','T&C','T&C','1.0','["VDS","voltage detection system"]'),
('IPE-SF-ENE-018','T&C QCS (Energy Projects) - Battery Chargers','Battery Chargers','T&C','T&C','1.0','["battery charger","charger commissioning","DC charger"]'),
('IPE-SF-ENE-019','T&C QCS (Energy Projects) - VLDs','VLDs','T&C','T&C','1.0','["VLD","voltage limiting device"]'),
('IPE-SF-ENE-020','T&C QCS (Energy Projects) - Checklists','Checklists','T&C','T&C','1.0','["checklist","pre-energisation","pre energisation"]'),
('IPE-SF-ENE-021','T&C QCS (Energy Projects) - SF6 Gas Pressure','SF6 Gas Pressure','T&C','T&C','1.0','["SF6","gas pressure","gas filled","switchgear gas"]'),
('IPE-SF-ENE-022','T&C QCS (Energy Projects) - HV Cables','HV Cables T&C','T&C','T&C','1.0','["HV cable test","high voltage cable test","cable commissioning","VLF","tan delta"]'),
('IPE-SF-ENE-023','T&C QCS (Energy Projects) - LV Multicore Cables','LV Multicore Cables','T&C','T&C','1.0','["LV multicore","multicore cable test","continuity test","multicore"]'),
('IPE-SF-ENE-024','T&C QCS (Energy Projects) - LV Cables and Circuits (BS7671 Tests)','LV Cables & Circuits (BS7671)','T&C','T&C','1.0','["BS7671","LV cable test","circuit test","continuity","polarity","earth fault loop"]'),
('IPE-SF-ENE-025','T&C QCS (Energy Projects) - Fall of Potential','Fall of Potential','T&C','T&C','1.0','["fall of potential","earth electrode","ground resistance","earth test"]'),
('IPE-SF-ENE-026','T&C QCS (Energy Projects) - SCADA','SCADA','T&C','T&C','1.0','["SCADA","supervisory control","data acquisition","comms test","communication test"]'),
('IPE-SF-ENE-027','T&C QCS (Energy Projects) - Power Transformers','Power Transformers','T&C','T&C','1.0','["power transformer","transformer commissioning","transformer test"]'),
('IPE-SF-ENE-029','T&C QCS (Energy Projects) - Instrumentation - Ammeters','Instrumentation - Ammeters','T&C','T&C','1.0','["ammeter","current measurement","instrumentation"]'),
('IPE-SF-ENE-030','T&C QCS (Energy Projects) - Instrumentation - Voltmeters','Instrumentation - Voltmeters','T&C','T&C','1.0','["voltmeter","voltage measurement","instrumentation"]'),
('IPE-SF-ENE-031','T&C QCS (Energy Projects) - Instrumentation - PQMs','Instrumentation - PQMs','T&C','T&C','1.0','["PQM","power quality","power quality meter"]'),
('IPE-SF-ENE-032','T&C QCS (Energy Projects) - CB Protection Units','CB Protection Units','T&C','T&C','1.0','["CB protection","circuit breaker protection","protection unit"]'),
('IPE-SF-ENE-140','T&C QCS (Energy Projects) - Twisted Pair Backbone Cables','Twisted Pair Backbone Cables','T&C','T&C','1.0','["twisted pair backbone","backbone cable","comms backbone"]'),
('IPE-SF-ENE-141','T&C QCS (Energy Projects) - Twisted Pair Patch Cables','Twisted Pair Patch Cables','T&C','T&C','1.0','["twisted pair patch","patch cable","patch lead"]'),
('IPE-SF-ENE-142','T&C QCS (Energy Projects) - Fibre Patch Cables','Fibre Patch Cables','T&C','T&C','1.0','["fibre patch","fiber patch","optical patch","fibre lead"]'),
('IPE-SF-ENE-143','T&C QCS (Energy Projects) - Fibre Backbone Cables','Fibre Backbone Cables','T&C','T&C','1.0','["fibre backbone","fiber backbone","optical backbone","fibre trunk"]'),
-- CON ELE Templates
('IPE-SF-ENE-101','CON ELE QCS (Energy Projects) - HV & DC Power Cable Installation','HV & DC Cable Installation','CON ELE','Electrical','2.0','["HV cable installation","DC cable installation","high voltage cable","power cable pull","cable pull","cable laying"]'),
('IPE-SF-ENE-102','CON ELE QCS (Energy Projects) - HV Power Cable Termination Installation','HV Cable Termination','CON ELE','Electrical','3.0','["HV termination","high voltage termination","cable termination","HV cable termination"]'),
('IPE-SF-ENE-103','CON ELE QCS (Energy Projects) - HV Power Cable Joint Installation','HV Cable Joint','CON ELE','Electrical','3.0','["HV joint","cable joint","high voltage joint","HV splice"]'),
('IPE-SF-ENE-104','CON ELE QCS (Energy Projects) - CT/VT/CVT Installation','CT/VT/CVT Installation','CON ELE','Electrical','1.0','["CT installation","VT installation","CVT installation","instrument transformer installation"]'),
('IPE-SF-ENE-105','CON ELE QCS (Energy Projects) - Outdoor AIS (Disconnectors & Earth Switches)','AIS Disconnectors & Earth Switches','CON ELE','Electrical','3.0','["disconnector","earth switch","AIS","isolator","outdoor switchgear"]'),
('IPE-SF-ENE-106','CON ELE QCS (Energy Projects) - Outdoor AIS (Busbars)','AIS Busbars','CON ELE','Electrical','3.0','["busbar","bus bar","AIS busbar","outdoor busbar"]'),
('IPE-SF-ENE-107','CON ELE QCS (Energy Projects) - Outdoor AIS (Steelwork Assembly)','AIS Steelwork Assembly','CON ELE','Electrical','3.0','["steelwork","steel structure","AIS steelwork","gantry","structure assembly"]'),
('IPE-SF-ENE-108','CON ELE QCS (Energy Projects) - Outdoor AIS (Post Insulators)','AIS Post Insulators','CON ELE','Electrical','2.0','["post insulator","line insulator","string insulator","AIS insulator"]'),
('IPE-SF-ENE-109','CON ELE QCS (Energy Projects) - DC Power Cable Termination Installation','DC Cable Termination','CON ELE','Electrical','1.0','["DC termination","DC cable termination","DC power termination"]'),
('IPE-SF-ENE-110','CON ELE QCS (Energy Projects) - LV Cable Containment Inspection','LV Cable Containment Inspection','CON ELE','Electrical','2.0','["containment inspection","cable tray inspection","trunking inspection","cable basket inspection"]'),
('IPE-SF-ENE-111','CON ELE QCS (Energy Projects) - Cable Drum Inspection','Cable Drum Inspection','CON ELE','Electrical','2.0','["cable drum","drum inspection","drum check","cable reel"]'),
('IPE-SF-ENE-112','CON ELE QCS (Energy Projects) - LV Cable Installation & Termination','LV Cable Installation & Termination','CON ELE','Electrical','2.0','["LV cable installation","LV termination","low voltage cable","LV cable","multicore installation","control cable","instrument cable"]'),
('IPE-SF-ENE-116','CON ELE QCS (Energy Projects) - LV Panel & Wiring Installation','LV Panel & Wiring Installation','CON ELE','Electrical','2.0','["LV panel","panel installation","wiring installation","panel wiring","DB installation","distribution board"]'),
('IPE-SF-ENE-117','CON ELE QCS (Energy Projects) - Earthing System Installation','Earthing System Installation','CON ELE','Electrical','2.0','["earthing","grounding","earth electrode","earth mat","earthing installation","earth bar","earth conductor"]'),
('IPE-SF-ENE-130','CON ELE QCS (Energy Projects) - Equipment Installation - Battery Containers, Substations etc','Equipment Installation','CON ELE','Electrical','1.1','["equipment installation","battery container","substation installation","BESS installation","container installation","plant installation"]'),
('IPE-SF-ENE-135','CON ELE QCS (Energy Projects) - Cable Containment Installation','Cable Containment Installation','CON ELE','Electrical','1.0','["cable containment","cable tray","cable ladder","trunking installation","cable tray installation","containment installation"]'),
('IPE-SF-ENE-137','CON ELE QCS (Energy Projects) - Waterproof Membrane Installation','Waterproof Membrane Installation','CON ELE','Electrical','1.0','["waterproof membrane","membrane installation","DPM","damp proof","waterproofing"]'),
('IPE-SF-ENE-138','CON ELE QCS (Energy Projects) - ≥132kV Joint Bay Installation','≥132kV Joint Bay Installation','CON ELE','Electrical','1.0','["132kV","joint bay","HV joint bay","132 kV","transmission cable"]'),
('IPE-SF-ENE-144','CON ELE QCS (Energy Projects) - Circuit Breaker Installation','Circuit Breaker Installation','CON ELE','Electrical','1.0','["circuit breaker installation","CB installation","breaker installation","VCB installation","ACB installation"]'),
-- CON CIV Templates
('IPE-SF-ENE-118','CON CIV QCS (Energy Projects) - Road Installation','Road Installation','CON CIV','Civils','2.0','["road installation","road construction","carriageway","road build"]'),
('IPE-SF-ENE-119','CON CIV QCS (Energy Projects) - Back Filling','Back Filling','CON CIV','Civils','1.0','["backfill","back filling","fill","trench fill","reinstatement"]'),
('IPE-SF-ENE-120','CON CIV QCS (Energy Projects) - Compaction of Unbound Materials','Compaction of Unbound Materials','CON CIV','Civils','1.0','["compaction","unbound material","compaction test","plate bearing","proctor"]'),
('IPE-SF-ENE-121','CON CIV QCS (Energy Projects) - Setting Out','Setting Out','CON CIV','Civils','1.0','["setting out","survey","benchmark","coordinates","grid lines","set out"]'),
('IPE-SF-ENE-122','CON CIV QCS (Energy Projects) - Bulk Excavation','Bulk Excavation','CON CIV','Civils','2.0','["bulk excavation","excavation","dig","earthworks","cut","formation"]'),
('IPE-SF-ENE-126','CON CIV QCS (Energy Projects) - Duct Installation','Duct Installation','CON CIV','Civils','1.0','["duct installation","ducting","conduit installation","cable duct","underground duct"]'),
('IPE-SF-ENE-127','CON CIV QCS (Energy Projects) - Trough CMS Installation','Trough CMS Installation','CON CIV','Civils','1.0','["trough","CMS","cable management","trough installation","cable trough"]'),
('IPE-SF-ENE-128','CON CIV QCS (Energy Projects) - Drainage Installation','Drainage Installation','CON CIV','Civils','1.0','["drainage","drain installation","surface water","foul drainage","drainage pipe","soakaway"]'),
('IPE-SF-ENE-131','CON CIV QCS (Energy Projects) - Fencing Installation','Fencing Installation','CON CIV','Civils','1.0','["fencing","fence installation","security fence","perimeter fence","palisade","chain link"]'),
('IPE-SF-ENE-132','CON CIV QCS (Energy Projects) - Stakka Box / Chamber Installation','Stakka Box / Chamber Installation','CON CIV','Civils','1.0','["stakka box","chamber","inspection chamber","manhole","pull pit"]'),
('IPE-SF-ENE-134','CON CIV QCS (Energy Projects) - Access Road Installation','Access Road Installation','CON CIV','Civils','1.0','["access road","site road","haul road","access track","hardcore road"]'),
('IPE-SF-ENE-136','CON CIV QCS (Energy Projects) - Concrete Preparation and Installation','Concrete Preparation and Installation','CON CIV','Civils','1.0','["concrete","concrete pour","concrete base","foundation concrete","pad","slab","blinding"]'),
('IPE-SF-ENE-139','CON CIV QCS (Energy Projects) - Driven Piling','Driven Piling','CON CIV','Civils','1.0','["piling","driven pile","pile installation","ground screw","helical pile","foundation pile"]')
ON CONFLICT (ref) DO NOTHING;
