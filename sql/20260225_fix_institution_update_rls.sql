-- ============================================================
-- Fix: Allow superadmins to update institutions
-- The original institutions_update_admin policy only allowed
-- institution-level admins but not platform superadmins,
-- causing institution verification to silently fail.
-- ============================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "institutions_update_admin" ON institutions;

-- Recreate with superadmin access included
CREATE POLICY "institutions_update_admin" ON institutions
    FOR UPDATE USING (
        is_institution_member(auth.uid(), id, 'admin')
        OR is_admin()
    ) WITH CHECK (
        is_institution_member(auth.uid(), id, 'admin')
        OR is_admin()
    );

-- ─── RPC fallback: admin_verify_institution ───────────────────
-- SECURITY DEFINER so it bypasses RLS; validates the caller is a superadmin.
-- Also auto-approves the institution owner's role verification.
CREATE OR REPLACE FUNCTION admin_verify_institution(
    _institution_id uuid,
    _status text,
    _admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _owner_id uuid;
BEGIN
    -- Verify caller is a platform admin
    IF NOT EXISTS (SELECT 1 FROM admin_users WHERE user_id = _admin_id AND is_active = true) THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Validate status
    IF _status NOT IN ('unverified', 'pending', 'verified', 'rejected') THEN
        RAISE EXCEPTION 'Invalid status: %', _status;
    END IF;

    UPDATE institutions SET
        verification_status = _status,
        verified_at = CASE WHEN _status = 'verified' THEN now() ELSE verified_at END,
        updated_at = now()
    WHERE id = _institution_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Institution not found';
    END IF;

    -- When an institution is verified, auto-approve the owner's role verification
    IF _status = 'verified' THEN
        -- Find the institution owner
        SELECT user_id INTO _owner_id
        FROM institution_members
        WHERE institution_id = _institution_id AND role = 'owner' AND status = 'active'
        LIMIT 1;

        IF _owner_id IS NOT NULL THEN
            -- Update the owner's profile: mark role as verified
            UPDATE profiles SET
                role_verification_status = 'verified',
                role_verified_at = now(),
                role_verified_by = _admin_id,
                role_rejection_reason = NULL,
                updated_at = now()
            WHERE id = _owner_id
              AND role_verification_status IN ('pending', 'not_required');

            -- Also approve any pending role_verification_request for the owner
            UPDATE role_verification_requests SET
                status = 'approved',
                reviewed_by = _admin_id,
                reviewed_at = now(),
                review_notes = 'Auto-approved: institution verified by admin',
                updated_at = now()
            WHERE user_id = _owner_id AND status = 'pending';
        END IF;
    END IF;
END;
$$;
