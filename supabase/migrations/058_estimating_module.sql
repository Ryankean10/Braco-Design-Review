-- Add 'estimating' to every existing company's modules array
-- (safe to run multiple times — array_append only adds if not already present)
UPDATE public.companies
SET modules = array_append(modules, 'estimating')
WHERE NOT ('estimating' = ANY(modules));
