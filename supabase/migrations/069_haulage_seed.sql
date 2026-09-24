-- Haulage test seed data for Scotplant
do $$
declare
  v_company_id uuid;
  v_driver1_id uuid;
  v_driver2_id uuid;
begin
  select id into v_company_id from public.companies where slug = 'scotplant' limit 1;
  if v_company_id is null then raise exception 'Scotplant company not found'; end if;

  -- Vehicles
  insert into public.haulage_vehicles (company_id, name, reg, category, notes) values
    (v_company_id, 'Volvo FH16 — Flatbed 1', 'SY21 AAA', 'flatbed', 'Test vehicle placeholder'),
    (v_company_id, 'DAF XF — Tipper 1',     'SY21 BBB', 'tipper',  'Test vehicle placeholder'),
    (v_company_id, 'Trailer 1 — Flatbed',    'T-001',    'trailer', 'Test trailer placeholder'),
    (v_company_id, 'Trailer 2 — Low Loader', 'T-002',    'trailer', 'Test trailer placeholder')
  on conflict do nothing;

  -- Drivers (insert into people table)
  insert into public.people (company_id, name, email, phone, role, discipline, company, is_active)
  values (v_company_id, 'Test Driver 1', 'driver1@scotplant.com', '07700 000001', 'operative', 'Haulage', 'Scotplant', true)
  returning id into v_driver1_id;

  insert into public.people (company_id, name, email, phone, role, discipline, company, is_active)
  values (v_company_id, 'Test Driver 2', 'driver2@scotplant.com', '07700 000002', 'operative', 'Haulage', 'Scotplant', true)
  returning id into v_driver2_id;

end $$;
