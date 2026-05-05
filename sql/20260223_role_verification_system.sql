-- ============================================================
-- Role Verification System
-- Adds pending/verified/rejected role approval workflow
-- Prevents self-assignment of educator roles
-- ============================================================

-- ─── 1. Add role_verification_status to profiles ───────────────
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'role_verification_status'
    ) THEN
        ALTER TABLE profiles
            ADD COLUMN role_verification_status text NOT NULL DEFAULT 'not_required'
            CHECK (role_verification_status IN (
                'not_required',   -- students (no verification needed)
                'pending',        -- awaiting admin review
                'verified',       -- admin approved
                'rejected'        -- admin rejected
            ));

        -- Backfill: existing educator roles that already have role_verified_at → mark as verified
        UPDATE profiles
        SET role_verification_status = 'verified'
        WHERE user_role IN ('school_admin', 'tutor_affiliated', 'tutor_independent')
          AND role_verified_at IS NOT NULL;

        -- Existing educator roles without verification → mark pending
        UPDATE profiles
        SET role_verification_status = 'pending'
        WHERE user_role IN ('school_admin', 'tutor_affiliated', 'tutor_independent')
          AND role_verified_at IS NULL;
    END IF;

    -- Add verified_by to track which admin approved/rejected
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'role_verified_by'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role_verified_by uuid REFERENCES auth.users(id);
    END IF;

    -- Add rejection reason
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'role_rejection_reason'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role_rejection_reason text;
    END IF;
END $$;

-- ─── 2. Role Verification Requests (document uploads + audit trail) ───
CREATE TABLE IF NOT EXISTS role_verification_requests (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    requested_role      text NOT NULL
                        CHECK (requested_role IN ('school_admin', 'tutor_affiliated', 'tutor_independent')),
    institution_id      uuid REFERENCES institutions(id) ON DELETE SET NULL,
    status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'approved', 'rejected')),

    -- Supporting documents (file paths in Supabase storage)
    documents           jsonb DEFAULT '[]'::jsonb,
    -- e.g. [{"name": "teaching_license.pdf", "path": "verification-docs/abc/...", "uploaded_at": "..."}]

    -- Additional info from the applicant
    qualifications      text,      -- free-text description of teaching qualifications
    years_experience    text,      -- "1-2", "3-5", "5-10", "10+"
    specializations     text[],    -- subject areas
    additional_notes    text,      -- any extra info

    -- Admin review
    reviewed_by         uuid REFERENCES auth.users(id),
    reviewed_at         timestamptz,
    review_notes        text,      -- admin's internal notes

    created_at          timestamptz DEFAULT now(),
    updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rvr_user_id ON role_verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_rvr_status ON role_verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_rvr_created_at ON role_verification_requests(created_at DESC);

ALTER TABLE role_verification_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY rvr_select_own ON role_verification_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own requests
CREATE POLICY rvr_insert_own ON role_verification_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own PENDING requests (add docs, edit info)
CREATE POLICY rvr_update_own ON role_verification_requests
    FOR UPDATE USING (
        auth.uid() = user_id AND status = 'pending'
    );

-- Admins can read all requests
CREATE POLICY rvr_select_admin ON role_verification_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
    );

-- Admins can update any request (approve/reject)
CREATE POLICY rvr_update_admin ON role_verification_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
    );

-- ─── 3. RLS hardening: prevent self-assignment of educator roles ───

-- Drop the old wide-open update policy
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;

-- New restricted update policy: users can update their own row,
-- BUT cannot change user_role to an educator role or self-set verification fields
CREATE POLICY profiles_update_own_restricted ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND (
            -- Allow if user_role hasn't changed (they can update other fields freely)
            user_role IS NOT DISTINCT FROM (SELECT p.user_role FROM profiles p WHERE p.id = auth.uid())
            -- OR allow setting to 'student' (downgrade is fine)
            OR user_role = 'student'
            -- OR allow if an admin is doing it (via service role — this won't match for normal users)
            -- Normal user self-updates that try to change user_role to educator will be blocked
        )
    );

-- Admin override: admins can update any profile (for approve/reject)
CREATE POLICY profiles_update_admin ON public.profiles
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true)
    );

-- ─── 4. Function: Admin approves a role verification request ───
CREATE OR REPLACE FUNCTION approve_role_request(
    _request_id uuid,
    _admin_id uuid,
    _review_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _req record;
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = _admin_id AND is_active = true) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Get the request
    SELECT * INTO _req FROM role_verification_requests WHERE id = _request_id AND status = 'pending';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    -- Update the request
    UPDATE role_verification_requests SET
        status = 'approved',
        reviewed_by = _admin_id,
        reviewed_at = now(),
        review_notes = _review_notes,
        updated_at = now()
    WHERE id = _request_id;

    -- Update the user's profile
    UPDATE profiles SET
        user_role = _req.requested_role,
        role_verification_status = 'verified',
        role_verified_at = now(),
        role_verified_by = _admin_id,
        role_rejection_reason = NULL,
        updated_at = now()
    WHERE id = _req.user_id;
END;
$$;

-- ─── 5. Function: Admin rejects a role verification request ───
CREATE OR REPLACE FUNCTION reject_role_request(
    _request_id uuid,
    _admin_id uuid,
    _reason text,
    _review_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _req record;
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = _admin_id AND is_active = true) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Get the request
    SELECT * INTO _req FROM role_verification_requests WHERE id = _request_id AND status = 'pending';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found or already processed';
    END IF;

    -- Update the request
    UPDATE role_verification_requests SET
        status = 'rejected',
        reviewed_by = _admin_id,
        reviewed_at = now(),
        review_notes = _review_notes,
        updated_at = now()
    WHERE id = _request_id;

    -- Reset user's role back to student & mark as rejected
    UPDATE profiles SET
        user_role = 'student',
        role_verification_status = 'rejected',
        role_verified_at = NULL,
        role_verified_by = _admin_id,
        role_rejection_reason = _reason,
        updated_at = now()
    WHERE id = _req.user_id;
END;
$$;

-- ─── 6. Function: Submit a role verification request ───
-- Called from the frontend after the user fills in the upgrade form.
-- Sets the user's role immediately but marks it as pending verification.
CREATE OR REPLACE FUNCTION submit_role_request(
    _user_id uuid,
    _requested_role text,
    _institution_id uuid DEFAULT NULL,
    _qualifications text DEFAULT NULL,
    _years_experience text DEFAULT NULL,
    _specializations text[] DEFAULT NULL,
    _additional_notes text DEFAULT NULL,
    _documents jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _request_id uuid;
BEGIN
    -- Validate role
    IF _requested_role NOT IN ('school_admin', 'tutor_affiliated', 'tutor_independent') THEN
        RAISE EXCEPTION 'Invalid role: %', _requested_role;
    END IF;

    -- Check no existing pending request
    IF EXISTS (
        SELECT 1 FROM role_verification_requests
        WHERE user_id = _user_id AND status = 'pending'
    ) THEN
        RAISE EXCEPTION 'You already have a pending verification request';
    END IF;

    -- Create the request
    INSERT INTO role_verification_requests (
        user_id, requested_role, institution_id,
        qualifications, years_experience, specializations,
        additional_notes, documents
    ) VALUES (
        _user_id, _requested_role, _institution_id,
        _qualifications, _years_experience, _specializations,
        _additional_notes, _documents
    ) RETURNING id INTO _request_id;

    -- Set the role on the profile but mark as pending
    UPDATE profiles SET
        user_role = _requested_role,
        role_verification_status = 'pending',
        role_verified_at = NULL,
        role_verified_by = NULL,
        role_rejection_reason = NULL,
        updated_at = now()
    WHERE id = _user_id;

    RETURN _request_id;
END;
$$;

-- ─── 7. Storage bucket for verification documents ───
-- Run this via Supabase Dashboard > Storage > Create bucket:
--   Name: verification-docs
--   Public: false (private)
--   Allowed MIME types: application/pdf, image/png, image/jpeg, image/webp
--   Max file size: 10MB
-- 
-- Then create these policies:
-- INSERT: auth.uid()::text = (storage.foldername(name))[1]
-- SELECT: auth.uid()::text = (storage.foldername(name))[1] OR EXISTS(SELECT 1 FROM admin_users WHERE user_id = auth.uid())
-- DELETE: auth.uid()::text = (storage.foldername(name))[1]

-- ─── 8. Index for admin queries ───
CREATE INDEX IF NOT EXISTS idx_profiles_verification
    ON profiles(role_verification_status)
    WHERE role_verification_status IN ('pending', 'rejected');
