-- Persist the AI agent's step-by-step thinking ("reasoning process") as a SEPARATE
-- column on chat_messages, so clients can replay it in their thinking panel without
-- ever embedding the steps in the message content itself.
--
-- Background: the edge function streams thinking_step events live over SSE and the
-- mobile/web clients render them in real time. This column lets the steps survive a
-- refresh / re-open (history replay) without polluting content, and keeps web + mobile
-- on the same shared table clean.
ALTER TABLE public.chat_messages
    ADD COLUMN IF NOT EXISTS thinking_steps JSONB DEFAULT NULL;
