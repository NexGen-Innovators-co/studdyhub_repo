-- ============================================================
-- Educator Platform: Institution Tables & RBAC
-- From: EDUCATOR_PLATFORM_ARCHITECTURE.md
-- ============================================================

-- ─── Institutions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS institutions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                text NOT NULL,
    slug                text NOT NULL UNIQUE,
    type                text NOT NULL DEFAULT 'school'
                        CHECK (type IN ('school', 'university', 'tutoring_center', 'online_academy')),
    country_id          uuid REFERENCES countries(id),
    education_level_id  uuid REFERENCES education_levels(id),
    address             text,
    city                text,
    region              text,
    website             text,
    logo_url            text,
    description         text,
    verification_status text NOT NULL DEFAULT 'unverified'
                        CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
    verified_by         uuid REFERENCES admin_users(id),
    verified_at         timestamptz,
    settings            jsonb DEFAULT '{}'::jsonb,
    metadata            jsonb DEFAULT '{}'::jsonb,
    is_active           boolean DEFAULT true,
    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_institutions_country ON institutions(country_id);
CREATE INDEX idx_institutions_slug ON institutions(slug);
CREATE INDEX idx_institutions_type ON institutions(type);
CREATE INDEX idx_institutions_verification ON institutions(verification_status);

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

-- ─── Institution Members ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS institution_members (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role            text NOT NULL DEFAULT 'student'
                    CHECK (role IN ('owner', 'admin', 'educator', 'student')),
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('invited', 'pending', 'active', 'suspended', 'removed')),
    title           text,
    department      text,
    invited_by      uuid REFERENCES auth.users(id),
    invite_code     text,
    joined_at       timestamptz,
    created_at      timestamptz DEFAULT now(),
    updated_at      timestamptz DEFAULT now(),
    UNIQUE(institution_id, user_id)
);

CREATE INDEX idx_inst_members_user ON institution_members(user_id);
CREATE INDEX idx_inst_members_institution ON institution_members(institution_id);
CREATE INDEX idx_inst_members_role ON institution_members(role);
CREATE INDEX idx_inst_members_active ON institution_members(status) WHERE status = 'active';

ALTER TABLE institution_members ENABLE ROW LEVEL SECURITY;

-- ─── Institution Invites ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS institution_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  uuid NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    email           text NOT NULL,
    role            text NOT NULL DEFAULT 'educator'
                    CHECK (role IN ('educator', 'student')),
    invited_by      uuid NOT NULL REFERENCES auth.users(id),
    status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at      timestamptz DEFAULT (now() + interval '7 days'),
    created_at      timestamptz DEFAULT now(),
    UNIQUE(institution_id, email, status)
);

CREATE INDEX idx_inst_invites_token ON institution_invites(token);
CREATE INDEX idx_inst_invites_email ON institution_invites(email);

ALTER TABLE institution_invites ENABLE ROW LEVEL SECURITY;

-- ─── Add institution_id, created_by, visibility, is_published to courses ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'courses' AND column_name = 'institution_id'
    ) THEN
        ALTER TABLE courses
            ADD COLUMN institution_id uuid REFERENCES institutions(id),
            ADD COLUMN created_by uuid REFERENCES auth.users(id),
            ADD COLUMN visibility text NOT NULL DEFAULT 'public'
                CHECK (visibility IN ('institution', 'public', 'unlisted')),
            ADD COLUMN is_published boolean DEFAULT true;

        CREATE INDEX IF NOT EXISTS idx_courses_institution ON courses(institution_id);
        CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);
        CREATE INDEX IF NOT EXISTS idx_courses_visibility ON courses(visibility);
    END IF;
END $$;

-- ─── Helper: Check institution membership with minimum role ───
CREATE OR REPLACE FUNCTION is_institution_member(
    _user_id uuid,
    _institution_id uuid,
    _min_role text DEFAULT 'student'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _role_rank integer;
    _user_rank integer;
BEGIN
    _role_rank := CASE _min_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'educator' THEN 2
        WHEN 'student' THEN 1
        ELSE 0
    END;

    SELECT CASE im.role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'educator' THEN 2
        WHEN 'student' THEN 1
        ELSE 0
    END INTO _user_rank
    FROM institution_members im
    WHERE im.user_id = _user_id
      AND im.institution_id = _institution_id
      AND im.status = 'active';

    RETURN COALESCE(_user_rank >= _role_rank, false);
END;
$$;

-- ─── Helper: Check if user is an educator anywhere ────────────
CREATE OR REPLACE FUNCTION is_educator(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM institution_members im
        WHERE im.user_id = _user_id
          AND im.role IN ('owner', 'admin', 'educator')
          AND im.status = 'active'
    );
END;
$$;

-- ─── Helper: Get all institution IDs for a user ───────────────
CREATE OR REPLACE FUNCTION user_institution_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT institution_id
    FROM institution_members
    WHERE user_id = _user_id AND status = 'active';
$$;

-- ─── RLS: institutions ────────────────────────────────────────
CREATE POLICY "institutions_select_active" ON institutions
    FOR SELECT USING (
        is_active = true
        OR is_institution_member(auth.uid(), id, 'admin')
        OR is_admin()
    );

CREATE POLICY "institutions_insert_authenticated" ON institutions
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

CREATE POLICY "institutions_update_admin" ON institutions
    FOR UPDATE USING (
        is_institution_member(auth.uid(), id, 'admin')
    ) WITH CHECK (
        is_institution_member(auth.uid(), id, 'admin')
    );

-- ─── RLS: institution_members ─────────────────────────────────
CREATE POLICY "members_select_same_institution" ON institution_members
    FOR SELECT USING (
        institution_id IN (SELECT user_institution_ids(auth.uid()))
        OR user_id = auth.uid()
        OR is_admin()
    );

CREATE POLICY "members_insert_admin_or_self" ON institution_members
    FOR INSERT WITH CHECK (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR user_id = auth.uid()
    );

CREATE POLICY "members_update_admin" ON institution_members
    FOR UPDATE USING (
        is_institution_member(auth.uid(), institution_id, 'admin')
    ) WITH CHECK (
        is_institution_member(auth.uid(), institution_id, 'admin')
    );

CREATE POLICY "members_delete_owner_or_self" ON institution_members
    FOR DELETE USING (
        user_id = auth.uid()
        OR is_institution_member(auth.uid(), institution_id, 'owner')
    );

-- ─── RLS: institution_invites ─────────────────────────────────
CREATE POLICY "invites_select_admin_or_recipient" ON institution_invites
    FOR SELECT USING (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR is_admin()
    );

CREATE POLICY "invites_insert_admin" ON institution_invites
    FOR INSERT WITH CHECK (
        is_institution_member(auth.uid(), institution_id, 'admin')
    );

CREATE POLICY "invites_update_admin" ON institution_invites
    FOR UPDATE USING (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- ─── Trigger: sync institution to education profile ───────────
CREATE OR REPLACE FUNCTION sync_institution_to_education_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.status = 'active' THEN
        INSERT INTO user_education_profiles (user_id, institution_name, country_id)
        SELECT NEW.user_id, i.name, i.country_id
        FROM institutions i WHERE i.id = NEW.institution_id
        ON CONFLICT (user_id) DO UPDATE SET
            institution_name = EXCLUDED.institution_name;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_institution_education
    AFTER INSERT OR UPDATE ON institution_members
    FOR EACH ROW
    EXECUTE FUNCTION sync_institution_to_education_profile();
