-- Admin users table already exists in the database
-- This migration ensures the enum type exists and adds any missing indexes/policies

-- Create admin_role enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE admin_role AS ENUM ('super_admin', 'admin', 'moderator');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Ensure the table exists (should already exist)
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    role admin_role NOT NULL DEFAULT 'moderator'::admin_role,
    permissions JSONB NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE NULL,
    created_by UUID NULL,
    CONSTRAINT admin_users_pkey PRIMARY KEY (id),
    CONSTRAINT admin_users_user_id_key UNIQUE (user_id),
    CONSTRAINT admin_users_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
    CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users USING btree (is_active);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users USING btree (role);

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own admin status" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can read all admin records" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can insert admin records" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can update admin records" ON public.admin_users;
DROP POLICY IF EXISTS "Super admins can delete admin records" ON public.admin_users;

-- Create policies for admin_users table
-- Allow authenticated users to read their own admin status
CREATE POLICY "Users can read their own admin status"
    ON public.admin_users
    FOR SELECT
    USING (auth.uid() = user_id);

-- Allow admins to read all admin records
CREATE POLICY "Admins can read all admin records"
    ON public.admin_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND is_active = true
            AND role IN ('super_admin', 'admin')
        )
    );

-- Only super_admins can insert new admins
CREATE POLICY "Super admins can insert admin records"
    ON public.admin_users
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND is_active = true
            AND role = 'super_admin'
        )
    );

-- Only super_admins can update admin records
CREATE POLICY "Super admins can update admin records"
    ON public.admin_users
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND is_active = true
            AND role = 'super_admin'
        )
    );

-- Only super_admins can delete admin records
CREATE POLICY "Super admins can delete admin records"
    ON public.admin_users
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.admin_users
            WHERE user_id = auth.uid()
            AND is_active = true
            AND role = 'super_admin'
        )
    );

-- Ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT SELECT ON public.admin_users TO authenticated;
GRANT ALL ON public.admin_users TO service_role;

