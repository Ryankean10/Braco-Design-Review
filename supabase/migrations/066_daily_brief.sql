-- Migration 066: Daily site brief

CREATE TABLE public.site_daily_briefs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id             uuid NOT NULL REFERENCES public.construction_sites(id) ON DELETE CASCADE,
  brief_date          date NOT NULL,
  planned_works       text,
  rams_notes          text,
  personnel_on_site   jsonb NOT NULL DEFAULT '[]',
  holiday_absences    jsonb NOT NULL DEFAULT '[]',
  third_parties       text,
  issues_carried_over jsonb NOT NULL DEFAULT '[]',
  weather             jsonb,
  hs_fact             text,
  ai_summary          text,
  status              text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent')),
  email_sent_at       timestamptz,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, brief_date)
);

ALTER TABLE public.site_daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal users can manage daily briefs"
  ON public.site_daily_briefs
  USING (
    EXISTS (
      SELECT 1 FROM public.construction_sites cs
      JOIN public.projects p ON p.id = cs.project_id
      WHERE cs.id = site_id
        AND (p.company_id = get_user_company_id() OR is_superadmin())
    )
  );
