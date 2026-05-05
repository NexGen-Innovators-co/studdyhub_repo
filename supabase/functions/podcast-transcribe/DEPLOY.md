# Deploy Podcast Transcription Edge Function

## Prerequisites
- Supabase CLI installed (`npm install -g supabase`)
- Logged in to Supabase (`supabase login`)
- Project linked (`supabase link --project-ref YOUR_PROJECT_REF`)

## Deployment Steps

### 1. Set Environment Variable
You need to add your Gemini API key to Supabase:

```bash
# Set the Gemini API key as a secret
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. Deploy the Function

```bash
# Deploy the podcast-transcribe function
supabase functions deploy podcast-transcribe
```

### 3. Verify Deployment

After deployment, test the function:

```bash
# Get your function URL
supabase functions list

# Test with curl (replace with actual values)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/podcast-transcribe \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "file_url": "https://your-audio-url.webm",
    "title": "Test Podcast",
    "duration": 60
  }'
```

## Alternative: Manual Deployment via Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Functions** in the left sidebar
3. Click **Create a new function**
4. Name it: `podcast-transcribe`
5. Copy the contents of `supabase/functions/podcast-transcribe/index.ts`
6. Paste into the function editor
7. Go to **Settings** → **Secrets**
8. Add secret: `GEMINI_API_KEY` with your Gemini API key
9. Deploy the function

## Troubleshooting

### If you get authentication errors:
```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

### If GEMINI_API_KEY is not found:
```bash
# List all secrets
supabase secrets list

# Set the secret again
supabase secrets set GEMINI_API_KEY=your_key_here
```

### To view function logs:
```bash
supabase functions logs podcast-transcribe
```

## Testing

Once deployed, end a live podcast stream. The system will:
1. Upload audio to storage
2. Call `podcast-transcribe` function
3. Return transcript, summary, and formatted script
4. Save to database

Check the browser console for detailed logs during transcription.
