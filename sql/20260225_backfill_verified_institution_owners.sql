-- ============================================================
-- Backfill: Sync role verification for owners of already-verified institutions
--
-- Before the admin_verify_institution RPC existed, approving an
-- institution did NOT auto-approve the owner's educator role.
-- This migration retroactively fixes that for all institutions
-- that were verified before the upgrade.
-- ============================================================

-- 1. Update profiles: mark owners of verified institutions as role-verified
UPDATE profiles
SET
    role_verification_status = 'verified',
    role_verified_at = now(),
    role_rejection_reason = NULL,
    updated_at = now()
WHERE id IN (
    SELECT im.user_id
    FROM institution_members im
    JOIN institutions i ON i.id = im.institution_id
    WHERE i.verification_status = 'verified'
      AND im.role = 'owner'
      AND im.status = 'active'
)
AND role_verification_status IN ('pending', 'not_required');

-- 2. Also approve any pending role_verification_requests for those same owners
UPDATE role_verification_requests
SET
    status = 'approved',
    reviewed_at = now(),
    review_notes = 'Auto-approved: backfill for institution verified before upgrade',
    updated_at = now()
WHERE user_id IN (
    SELECT im.user_id
    FROM institution_members im
    JOIN institutions i ON i.id = im.institution_id
    WHERE i.verification_status = 'verified'
      AND im.role = 'owner'
      AND im.status = 'active'
)
AND status = 'pending';

-- 3. Also handle institution admins and educators (not just owners)
--    who are active members of verified institutions
UPDATE profiles
SET
    role_verification_status = 'verified',
    role_verified_at = now(),
    role_rejection_reason = NULL,
    updated_at = now()
WHERE id IN (
    SELECT im.user_id
    FROM institution_members im
    JOIN institutions i ON i.id = im.institution_id
    WHERE i.verification_status = 'verified'
      AND im.role IN ('owner', 'admin', 'educator')
      AND im.status = 'active'
)
AND role_verification_status IN ('pending', 'not_required');

UPDATE role_verification_requests
SET
    status = 'approved',
    reviewed_at = now(),
    review_notes = 'Auto-approved: backfill for verified institution member',
    updated_at = now()
WHERE user_id IN (
    SELECT im.user_id
    FROM institution_members im
    JOIN institutions i ON i.id = im.institution_id
    WHERE i.verification_status = 'verified'
      AND im.role IN ('owner', 'admin', 'educator')
      AND im.status = 'active'
)
AND status = 'pending';
