-- ============================================================
-- Fix: Add RLS policies for institution_invites table
--
-- The table has RLS enabled but the policies from the schema
-- migration (20260301_educator_platform_schema.sql) were not
-- applied, causing 403 Forbidden on all queries.
-- ============================================================

-- Ensure RLS is on
ALTER TABLE institution_invites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (safe re-run)
DROP POLICY IF EXISTS "invites_select_admin_or_recipient" ON institution_invites;
DROP POLICY IF EXISTS "invites_insert_admin" ON institution_invites;
DROP POLICY IF EXISTS "invites_update_admin" ON institution_invites;
DROP POLICY IF EXISTS "institution_invites_select_members" ON institution_invites;

-- SELECT: institution owners/admins can see invites, recipients can see their own
CREATE POLICY "invites_select_admin_or_recipient" ON institution_invites
    FOR SELECT USING (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR is_admin()
    );

-- INSERT: institution owners/admins can create invites
CREATE POLICY "invites_insert_admin" ON institution_invites
    FOR INSERT WITH CHECK (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR is_admin()
    );

-- UPDATE: institution owners/admins can update (revoke), recipients can update their own
CREATE POLICY "invites_update_admin" ON institution_invites
    FOR UPDATE USING (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR is_admin()
    );

-- DELETE: institution owners/admins can delete invites
CREATE POLICY "invites_delete_admin" ON institution_invites
    FOR DELETE USING (
        is_institution_member(auth.uid(), institution_id, 'admin')
        OR is_admin()
    );
