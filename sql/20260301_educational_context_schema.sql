-- ============================================================
-- Educational Context Schema
-- From: EDUCATIONAL_CONTEXT_ARCHITECTURE.md
-- ============================================================

-- ─── Countries ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code               text NOT NULL UNIQUE,
    name               text NOT NULL,
    flag_emoji         text,
    official_languages text[] DEFAULT '{}',
    metadata           jsonb DEFAULT '{}',
    is_active          boolean DEFAULT true,
    sort_order         integer DEFAULT 0,
    created_at         timestamptz DEFAULT now()
);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active countries"
    ON countries FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage countries"
    ON countries FOR ALL
    USING (is_admin());

-- ─── Education Levels ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS education_levels (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id             uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    code                   text NOT NULL UNIQUE,
    name                   text NOT NULL,
    short_name             text,
    category               text NOT NULL CHECK (category IN (
                               'pre_primary', 'primary', 'lower_secondary',
                               'upper_secondary', 'tertiary', 'postgraduate'
                           )),
    sort_order             integer DEFAULT 0,
    typical_start_age      integer,
    typical_duration_years integer,
    metadata               jsonb DEFAULT '{}',
    is_active              boolean DEFAULT true,
    created_at             timestamptz DEFAULT now()
);

CREATE INDEX idx_education_levels_country ON education_levels(country_id);

ALTER TABLE education_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active education levels"
    ON education_levels FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage education levels"
    ON education_levels FOR ALL
    USING (is_admin());

-- ─── Curricula ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS curricula (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    country_id         uuid NOT NULL REFERENCES countries(id) ON DELETE CASCADE,
    education_level_id uuid NOT NULL REFERENCES education_levels(id) ON DELETE CASCADE,
    code               text NOT NULL UNIQUE,
    name               text NOT NULL,
    description        text,
    governing_body     text,
    metadata           jsonb DEFAULT '{}',
    is_active          boolean DEFAULT true,
    created_at         timestamptz DEFAULT now()
);

CREATE INDEX idx_curricula_country_level ON curricula(country_id, education_level_id);

ALTER TABLE curricula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active curricula"
    ON curricula FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage curricula"
    ON curricula FOR ALL
    USING (is_admin());

-- ─── Examinations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS examinations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id  uuid NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    code           text NOT NULL UNIQUE,
    name           text NOT NULL,
    typical_date   date,
    recurrence     text DEFAULT 'annual' CHECK (recurrence IN (
                       'annual', 'biannual', 'quarterly', 'on_demand'
                   )),
    metadata       jsonb DEFAULT '{}',
    is_active      boolean DEFAULT true,
    created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_examinations_curriculum ON examinations(curriculum_id);

ALTER TABLE examinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active examinations"
    ON examinations FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage examinations"
    ON examinations FOR ALL
    USING (is_admin());

-- ─── Subjects ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subjects (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id  uuid NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    code           text NOT NULL,
    name           text NOT NULL,
    category       text DEFAULT 'core' CHECK (category IN ('core', 'elective')),
    sort_order     integer DEFAULT 0,
    metadata       jsonb DEFAULT '{}',
    is_active      boolean DEFAULT true,
    created_at     timestamptz DEFAULT now(),
    UNIQUE(curriculum_id, code)
);

CREATE INDEX idx_subjects_curriculum ON subjects(curriculum_id);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active subjects"
    ON subjects FOR SELECT
    USING (is_active = true);

CREATE POLICY "Admins can manage subjects"
    ON subjects FOR ALL
    USING (is_admin());

-- ─── User Education Profiles ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_education_profiles (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    country_id             uuid REFERENCES countries(id),
    education_level_id     uuid REFERENCES education_levels(id),
    curriculum_id          uuid REFERENCES curricula(id),
    target_examination_id  uuid REFERENCES examinations(id),
    institution_name       text,
    year_or_grade          text,
    expected_completion    date,
    goals                  jsonb DEFAULT '[]',
    metadata               jsonb DEFAULT '{}',
    created_at             timestamptz DEFAULT now(),
    updated_at             timestamptz DEFAULT now()
);

ALTER TABLE user_education_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own education profile"
    ON user_education_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own education profile"
    ON user_education_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own education profile"
    ON user_education_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all education profiles"
    ON user_education_profiles FOR SELECT
    USING (is_admin());

-- ─── User Subjects ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_subjects (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_education_profile_id uuid NOT NULL REFERENCES user_education_profiles(id) ON DELETE CASCADE,
    subject_id                uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    is_primary                boolean DEFAULT false,
    created_at                timestamptz DEFAULT now(),
    UNIQUE(user_education_profile_id, subject_id)
);

CREATE INDEX idx_user_subjects_profile ON user_subjects(user_education_profile_id);

ALTER TABLE user_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subjects"
    ON user_subjects FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_education_profiles uep
            WHERE uep.id = user_education_profile_id
              AND uep.user_id = auth.uid()
        )
    );

-- ─── RPC: Get full education framework for a country ──────────
CREATE OR REPLACE FUNCTION get_education_framework(p_country_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'country', jsonb_build_object(
            'id', c.id,
            'code', c.code,
            'name', c.name,
            'flag_emoji', c.flag_emoji
        ),
        'education_levels', COALESCE((
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', el.id,
                    'code', el.code,
                    'name', el.name,
                    'short_name', el.short_name,
                    'category', el.category,
                    'curricula', COALESCE((
                        SELECT jsonb_agg(
                            jsonb_build_object(
                                'id', cur.id,
                                'code', cur.code,
                                'name', cur.name,
                                'governing_body', cur.governing_body,
                                'examinations', COALESCE((
                                    SELECT jsonb_agg(
                                        jsonb_build_object(
                                            'id', ex.id,
                                            'code', ex.code,
                                            'name', ex.name,
                                            'typical_date', ex.typical_date
                                        ) ORDER BY ex.typical_date
                                    )
                                    FROM examinations ex
                                    WHERE ex.curriculum_id = cur.id AND ex.is_active
                                ), '[]'::jsonb),
                                'subjects', COALESCE((
                                    SELECT jsonb_agg(
                                        jsonb_build_object(
                                            'id', s.id,
                                            'code', s.code,
                                            'name', s.name,
                                            'category', s.category
                                        ) ORDER BY s.sort_order
                                    )
                                    FROM subjects s
                                    WHERE s.curriculum_id = cur.id AND s.is_active
                                ), '[]'::jsonb)
                            ) ORDER BY cur.name
                        )
                        FROM curricula cur
                        WHERE cur.education_level_id = el.id AND cur.is_active
                    ), '[]'::jsonb)
                ) ORDER BY el.sort_order
            )
            FROM education_levels el
            WHERE el.country_id = c.id AND el.is_active
        ), '[]'::jsonb)
    ) INTO result
    FROM countries c
    WHERE c.code = p_country_code AND c.is_active;

    RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- ─── RPC: Get active countries list ───────────────────────────
CREATE OR REPLACE FUNCTION get_active_countries()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'id', c.id,
                'code', c.code,
                'name', c.name,
                'flag_emoji', c.flag_emoji
            ) ORDER BY c.sort_order, c.name
        ),
        '[]'::jsonb
    )
    FROM countries c
    WHERE c.is_active;
$$;

-- ─── Add user_role + role_verified_at to profiles ─────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'user_role'
    ) THEN
        ALTER TABLE profiles
            ADD COLUMN user_role text NOT NULL DEFAULT 'student'
                CHECK (user_role IN ('student', 'school_admin', 'tutor_affiliated', 'tutor_independent'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'role_verified_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role_verified_at timestamptz;
    END IF;
END $$;
