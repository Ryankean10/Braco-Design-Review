-- Allow RFIs/TQs to be scoped to a construction site
alter table rfis_tqs
  add column if not exists site_id uuid references construction_sites(id) on delete cascade;

create index if not exists rfis_tqs_site_id_idx on rfis_tqs(site_id);

-- Update select RLS to also allow company members to see site-scoped records
-- (existing policy already covers company_id match; site records carry company_id too)
