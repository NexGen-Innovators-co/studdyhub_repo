-- Remove duplicate policies that were causing confusion
-- We will keep the "their own" versions and drop the "own" versions

DROP POLICY IF EXISTS "Users can delete own subscriptions" ON notification_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON notification_subscriptions;
DROP POLICY IF EXISTS "Users can view own subscriptions" ON notification_subscriptions;

-- The following policies should remain (created by previous migration):
-- "Users can delete their own subscriptions"
-- "Users can insert their own subscriptions"
-- "Users can update their own subscriptions"
-- "Users can view their own subscriptions"
