-- ============================================================
-- Platform Update: AI Service Reliability Improvements
-- Run this in the Supabase SQL Editor to create the update.
-- Replace YOUR_ADMIN_USER_ID with your actual admin UUID.
-- ============================================================

INSERT INTO public.platform_updates (
  title,
  summary,
  content,
  update_type,
  priority,
  version_tag,
  status,
  published_at,
  created_by,
  updated_by
) VALUES (
  'AI Service Reliability Improvements — Scheduled Maintenance',

  'We are rolling out major reliability upgrades to all AI-powered features. Some services may experience brief intermittent delays as changes propagate. No action is required on your end.',

  E'## 🔧 What''s Happening\n\nWe''ve identified intermittent disruptions affecting AI-powered features across StuddyHub caused by upstream provider quota limits and deprecated model endpoints. We are actively deploying fixes to **all AI services** to ensure uninterrupted performance.\n\n---\n\n## 🛠️ What We''re Doing\n\n### 1. Multi-Model Fallback Chain\nAll AI functions now automatically switch between **5 different AI models** if one is overloaded or unavailable. This means if one model hits a rate limit, your request seamlessly retries on the next available model — no errors, no waiting.\n\n### 2. OpenRouter Backup Gateway\nAs an additional safety net, we''ve added a **secondary AI provider** (OpenRouter) that activates when all primary models are exhausted. This provides an extra layer of protection against service outages.\n\n### 3. Deprecated Model Cleanup\nWe''ve removed all references to discontinued AI model versions that were causing intermittent 404 errors and replaced them with current, supported models.\n\n### 4. Enhanced Error Logging\nA new **system-wide error logging** infrastructure has been deployed across all edge functions, allowing us to detect and resolve issues faster.\n\n---\n\n## ⚡ Services Affected\n\nThe following features are receiving these upgrades and may experience **brief delays (a few seconds)** during the rollout:\n\n| Service | Status |\n|---|---|\n| 💬 AI Chat (StuddyHub Assistant) | ✅ Updated |\n| 📝 Note Generation from Documents | ✅ Updated |\n| 🃏 Flashcard Generation | ✅ Updated |\n| 📊 Quiz Generation | ✅ Updated |\n| 📋 Summary Generation | ✅ Updated |\n| 🎙️ Podcast Generation | ✅ Updated |\n| 📈 Dashboard Insights | ✅ Updated |\n| ✏️ Inline Content Editor (AI) | ✅ Updated |\n| 🔀 Diagram Fixer | ✅ Updated |\n| 📄 Document Processing & Extraction | ✅ Updated |\n| 🖼️ Image Analysis | ✅ Updated |\n| 🎵 Audio Transcription & Processing | ✅ Updated |\n| 🔍 Document Structure Analysis | ✅ Updated |\n| 🛡️ Content Moderation | ✅ Updated |\n| 📱 Social Post Creation | ✅ Updated |\n| 🔐 Admin AI Insights | ✅ Updated |\n\n---\n\n## 👤 What You Need To Do\n\n**Nothing!** All changes are server-side and automatic. You should notice **fewer errors** and **faster recovery** when AI services are under heavy load.\n\nIf you do encounter an error, simply retry after a few seconds — the fallback system will route your request to an available model.\n\n---\n\n## 📅 Timeline\n\n- **Started:** February 23, 2026\n- **Expected Completion:** All services are now updated and live\n- **Monitoring:** We will continue monitoring system performance over the next 48 hours\n\n---\n\nThank you for your patience. These improvements make StuddyHub significantly more resilient and ensure a smoother experience for everyone. 💙',

  'maintenance',
  'high',
  'v2.6.1',
  'published',
  now(),

  -- ⚠️ REPLACE with your admin user UUID
  (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1),
  (SELECT id FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin' LIMIT 1)
);
