# Content Moderation Setup Instructions

## ✅ Edge Function Deployed
The `content-moderation` edge function has been successfully deployed to Supabase.

## 📋 Database Setup Required

You need to run the following SQL in your Supabase SQL Editor to create the necessary tables:

### 1. Open Supabase Dashboard
- Go to: https://supabase.com/dashboard/project/kegsrvnywshxyucgjxml
- Navigate to: SQL Editor

### 2. Run This SQL

```sql
-- Create content moderation log table
CREATE TABLE IF NOT EXISTS public.content_moderation_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content_preview TEXT NOT NULL,
    content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment', 'document')),
    decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'flagged')),
    reason TEXT,
    confidence FLOAT,
    ai_analysis JSONB,
    educational_score FLOAT,
    category TEXT,
    topics TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_content_moderation_log_user_id ON public.content_moderation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_log_decision ON public.content_moderation_log(decision);
CREATE INDEX IF NOT EXISTS idx_content_moderation_log_created_at ON public.content_moderation_log(created_at);

-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default moderation settings
INSERT INTO public.system_settings (key, value, description)
VALUES (
    'content_moderation',
    '{
        "enabled": true,
        "strictness": "medium",
        "allowedCategories": [
            "Science", "Mathematics", "Technology", "Engineering",
            "History", "Literature", "Language Learning", "Arts",
            "Business", "Economics", "Health", "Medicine",
            "Philosophy", "Psychology", "Social Sciences",
            "Study Tips", "Exam Preparation", "Career Guidance"
        ],
        "blockedKeywords": [
            "spam", "advertisement", "buy now", "click here",
            "limited offer", "act now", "free money"
        ],
        "minEducationalScore": 0.6
    }'::jsonb,
    'Content moderation settings'
)
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.content_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Policies for content_moderation_log
CREATE POLICY "Users view own logs" ON public.content_moderation_log
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins view all logs" ON public.content_moderation_log
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Service role insert logs" ON public.content_moderation_log
FOR INSERT WITH CHECK (true);

-- Policies for system_settings
CREATE POLICY "Admins view settings" ON public.system_settings
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
);

CREATE POLICY "Super admins update settings" ON public.system_settings
FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid() AND role = 'super_admin')
);
```

### 3. Test the Function

After running the SQL, you can test with:
```bash
node scripts\test-content-moderation.js
```

## 🔧 How It Works

1. **User creates content** → Frontend calls content-moderation function
2. **AI analyzes** → Gemini checks if content is educational
3. **Decision made** → Approved/Rejected based on educational value
4. **Logged** → All decisions saved to content_moderation_log
5. **Feedback** → User sees why content was rejected with suggestions

## 📊 Features

- **AI-Powered**: Uses Gemini 1.5 Flash for intelligent analysis
- **Educational Focus**: Ensures platform stays focused on learning
- **Spam Detection**: Blocks promotional and spam content
- **Configurable**: Adjustable strictness levels (low/medium/high)
- **User-Friendly**: Provides helpful suggestions for rejected content
- **Admin Analytics**: Track moderation decisions and patterns

## 🎯 Next Steps

Once database tables are created, integrate with frontend:
- Call moderation API before creating posts
- Show loading state during validation
- Display rejection feedback with suggestions
- Track user's moderation history
