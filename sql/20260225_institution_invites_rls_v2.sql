-- ============================================================
-- Fix: RLS policies for institution_invites (standalone version)
--
-- This version does NOT depend on is_institution_member() or
-- is_admin() helper functions. It uses direct subqueries instead.
-- Safe to re-run — drops existing policies first.
-- ============================================================

-- Ensure RLS is on
ALTER TABLE institution_invites ENABLE ROW LEVEL SECURITY;

-- Drop ALL possible policy names (from both v1 and v2)
DROP POLICY IF EXISTS "invites_select_admin_or_recipient" ON institution_invites;
DROP POLICY IF EXISTS "invites_insert_admin" ON institution_invites;
DROP POLICY IF EXISTS "invites_update_admin" ON institution_invites;
DROP POLICY IF EXISTS "invites_delete_admin" ON institution_invites;
DROP POLICY IF EXISTS "institution_invites_select_members" ON institution_invites;

-- SELECT: institution owners/admins can see invites, recipients can see their own
CREATE POLICY "invites_select_admin_or_recipient" ON institution_invites
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM institution_members im
            WHERE im.user_id = auth.uid()
              AND im.institution_id = institution_invites.institution_id
              AND im.status = 'active'
              AND im.role IN ('owner', 'admin')
        )
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.user_role = 'admin'
        )
    );

-- INSERT: institution owners/admins can create invites
CREATE POLICY "invites_insert_admin" ON institution_invites
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM institution_members im
            WHERE im.user_id = auth.uid()
              AND im.institution_id = institution_invites.institution_id
              AND im.status = 'active'
              AND im.role IN ('owner', 'admin')
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.user_role = 'admin'
        )
    );

-- UPDATE: institution owners/admins can update (revoke), recipients can update their own
CREATE POLICY "invites_update_admin" ON institution_invites
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM institution_members im
            WHERE im.user_id = auth.uid()
              AND im.institution_id = institution_invites.institution_id
              AND im.status = 'active'
              AND im.role IN ('owner', 'admin')
        )
        OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.user_role = 'admin'
        )
    );

-- DELETE: institution owners/admins can delete invites
CREATE POLICY "invites_delete_admin" ON institution_invites
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM institution_members im
            WHERE im.user_id = auth.uid()
              AND im.institution_id = institution_invites.institution_id
              AND im.status = 'active'
              AND im.role IN ('owner', 'admin')
        )
        OR EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.id = auth.uid()
              AND p.user_role = 'admin'
        )
    );
