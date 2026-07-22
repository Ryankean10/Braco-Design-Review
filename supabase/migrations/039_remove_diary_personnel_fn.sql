-- Helper function to strip a name from ai_personnel JSONB arrays in site_diaries
CREATE OR REPLACE FUNCTION public.remove_diary_personnel_name(p_site_id uuid, p_name text)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.site_diaries
  SET ai_personnel = (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(COALESCE(ai_personnel, '[]'::jsonb)) AS elem
    WHERE elem <> p_name
  )
  WHERE site_id = p_site_id
    AND ai_personnel IS NOT NULL
    AND ai_personnel @> to_jsonb(p_name);
$$;
