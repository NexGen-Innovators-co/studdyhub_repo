-- ============================================================
-- Public Testimonials RPC
-- Returns approved testimonials with author profile data
-- (name + avatar). Uses SECURITY DEFINER to bypass profiles
-- RLS so anonymous visitors on the landing page can see
-- real names and avatars instead of "StuddyHub User".
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_approved_testimonials(p_limit int DEFAULT 20)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      at.content,
      at.rating,
      at.created_at,
      COALESCE(p.full_name, 'StuddyHub User') AS author_name,
      COALESCE(p.avatar_url, '')              AS author_avatar_url
    FROM public.app_testimonials at
    LEFT JOIN public.profiles p ON p.id = at.user_id
    WHERE at.is_approved = true
    ORDER BY at.created_at DESC
    LIMIT p_limit
  ) t;
$$;

-- Allow anonymous + authenticated callers to invoke
GRANT EXECUTE ON FUNCTION public.get_approved_testimonials(int) TO anon, authenticated;
