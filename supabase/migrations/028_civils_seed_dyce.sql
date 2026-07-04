-- 028 — Seed Dyce BESS civils activity register
-- Derived from ITP 35753-OCU-BE-DY-PL-PM-0001, ECV discipline rows (civils only — HV/LV cable excluded)
-- Progress seeded from ITP completion snapshot; going forward driven by site diaries

DO $$
DECLARE
  v_site_id uuid;
BEGIN
  SELECT id INTO v_site_id FROM public.construction_sites WHERE name ILIKE '%dyce%' LIMIT 1;
  IF v_site_id IS NULL THEN RETURN; END IF;

  -- Clear any existing civils activities for this site before re-seeding
  DELETE FROM public.civils_activities WHERE site_id = v_site_id;

  INSERT INTO public.civils_activities
    (site_id, activity_group, description, category, itp_ref, status, progress_pct, is_blocker, blocks_package, sort_order)
  VALUES
    -- ─── BELOW GROUND ─────────────────────────────────────────────────────────
    (v_site_id, 'Driven Piles',
     'Driven pile installation — all 11 piles across MVS bays, battery pads and substation locations',
     'Below Ground', 'ECV-DP', 'Complete', 100, false, NULL, 10),

    (v_site_id, 'Pile Cap Foundations',
     'Pile cap concrete foundations — 26 caps including all MVS bays, BAT pads, substation base and transformer plinth',
     'Below Ground', 'ECV-PC', 'Complete', 100, true, ARRAY['Electrical', 'HV Cable'], 20),

    (v_site_id, 'Drawpit Installation',
     'Draw pit installation — 3 draw pits for HV cable routes between substations and ring main',
     'Below Ground', 'ECV-DPT', 'Complete', 100, true, ARRAY['HV Cable'], 30),

    (v_site_id, 'Drainage Installation',
     'Surface water drainage — SR drain runs (SR1-5), SB soakaway chambers (SB1-10), SR sump tank and ACO channel installation',
     'Below Ground', 'ECV-DRN', 'In Progress', 0, false, NULL, 40),

    (v_site_id, 'Trough Installation',
     'Cable trough installation — 3 trough groups covering battery pad cable routes to distribution boards',
     'Below Ground', 'ECV-TRG', 'In Progress', 0, true, ARRAY['LV Cable', 'Electrical'], 50),

    -- ─── ABOVE GROUND ─────────────────────────────────────────────────────────
    (v_site_id, 'Concrete Pour Register',
     'Structural concrete pours — slab/pad pour records, cube test results and compressive strength sign-off',
     'Above Ground', 'ECV-CPR', 'In Progress', 0, false, NULL, 60),

    (v_site_id, 'Access Road Construction',
     'Site access road — formation, sub-base, geotextile, MOT Type 1 and surface course to site entrance',
     'Above Ground', 'ECV-RD', 'In Progress', 0, false, NULL, 70),

    (v_site_id, 'North Masonry Wall',
     'North acoustic masonry wall — block and mortar construction including capping, 2 sections',
     'Above Ground', 'ECV-NMW', 'In Progress', 0, false, NULL, 80),

    (v_site_id, 'South Masonry Wall',
     'South acoustic masonry wall — block and mortar construction including capping',
     'Above Ground', 'ECV-SMW', 'In Progress', 0, false, NULL, 90),

    (v_site_id, 'Acoustic Fencing 2.4m',
     '2.4m acoustic close-boarded timber fence — posts, panels and capping rail to east boundary',
     'Above Ground', 'ECV-AF1', 'In Progress', 0, false, NULL, 100),

    (v_site_id, 'Acoustic Fencing 5.5m',
     '5.5m acoustic barrier fence — structural steel posts and acoustic panel infill to north/south elevations',
     'Above Ground', 'ECV-AF2', 'In Progress', 0, false, NULL, 110),

    (v_site_id, 'Palisade Security Fencing 2.4m',
     '2.4m palisade security fencing — steel pale panels, posts and anti-climb topping around site perimeter',
     'Above Ground', 'ECV-PF', 'In Progress', 0, false, NULL, 120);

END $$;
