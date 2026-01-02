-- Enable RLS
ALTER TABLE notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON notification_subscriptions;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON notification_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON notification_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON notification_subscriptions;

-- Policy for INSERT
CREATE POLICY "Users can insert their own subscriptions"
ON notification_subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy for SELECT
CREATE POLICY "Users can view their own subscriptions"
ON notification_subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for UPDATE
CREATE POLICY "Users can update their own subscriptions"
ON notification_subscriptions
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy for DELETE
CREATE POLICY "Users can delete their own subscriptions"
ON notification_subscriptions
FOR DELETE
USING (auth.uid() = user_id);
