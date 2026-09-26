-- 077: Storage bucket for personnel credential certificates
--
-- The certificate upload API (app/api/team/credentials/[id]/certificate) writes
-- to `person-certificates`, but the bucket was never created by a migration.
-- Private bucket; all access goes through the API using the service-role key,
-- after the person_certificates / person_credentials RLS checks.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('person-certificates', 'person-certificates', false, 20971520)  -- 20 MB per file
ON CONFLICT (id) DO NOTHING;
