# StuddyHub AI - API Keys Reference Guide

This document lists all the AI APIs used in StuddyHub and where to get your API keys.

---

## 1. **Google Gemini API** ⭐ (Primary)
**Status:** Primary planning model  
**Environment Variable:** `GEMINI_API_KEY`

### Get Your API Key:
- **Console:** https://ai.google.dev/
- **API Keys Page:** https://ai.google.dev/tutorials/setup
- **Free Tier:** Yes (with daily quota limits)
- **Pricing:** https://ai.google.dev/pricing
- **Documentation:** https://ai.google.dev/docs

### Setup Steps:
1. Go to https://ai.google.dev/
2. Click "Get API Key" 
3. Select or create a Google Cloud project
4. Enable the Generative Language API
5. Copy your API key and set `GEMINI_API_KEY` env variable

---

## 2. **Groq API** (Fast Inference Fallback)
**Status:** Fallback provider for when Gemini is rate-limited  
**Environment Variable:** `GROQ_API_KEY`

### Get Your API Key:
- **Console:** https://console.groq.com/
- **API Keys Page:** https://console.groq.com/keys
- **Free Tier:** Yes (6,000 TPM org-wide, per model quotas vary)
- **Pricing:** https://console.groq.com/pricing
- **Documentation:** https://console.groq.com/docs

### Supported Models:
- `openai/gpt-oss-120b`
- `openai/gpt-oss-20b`
- `llama-3.3-70b-versatile`
- `qwen/qwen3.6-27b`
- `groq/compound`
- `llama-3.1-8b-instant`

### Setup Steps:
1. Sign up at https://console.groq.com/
2. Go to API Keys page
3. Create a new API key
4. Copy the key (starts with `gsk_`)
5. Set `GROQ_API_KEY` env variable

---

## 3. **xAI (Grok) API** (Fallback)
**Status:** Fallback provider  
**Environment Variables:** `XAI_API_KEY` or `GROK_API_KEY` or `GROK_API_TOKEN`

### Get Your API Key:
- **Console:** https://console.x.ai/
- **Teams Page:** https://console.x.ai/team
- **Free Tier:** Limited (new teams need to purchase credits)
- **Pricing:** https://console.x.ai/billing
- **Documentation:** https://docs.x.ai/

### Supported Models:
- `grok-3`
- `grok-3-mini`

### Setup Steps:
1. Sign up at https://console.x.ai/
2. Create or select a team
3. Go to API Keys section
4. Create new API key (starts with `xai-`)
5. Set `XAI_API_KEY` env variable

---

## 4. **SambaNova Cloud API** (Fallback)
**Status:** Fallback provider with separate daily quota  
**Environment Variable:** `SAMBANOVA_API_KEY`

### Get Your API Key:
- **Console:** https://cloud.sambanova.ai
- **API Keys Page:** https://cloud.sambanova.ai/account/api-keys
- **Free Tier:** Yes (200K tokens/day per model)
- **Pricing:** https://cloud.sambanova.ai/pricing
- **Documentation:** https://docs.sambanova.ai/

### Supported Models:
- `Meta-Llama-3.3-70B-Instruct`
- `DeepSeek-V3.1`
- `gpt-oss-120b`

### Setup Steps:
1. Go to https://cloud.sambanova.ai
2. Sign up or log in
3. Navigate to API Keys in account settings
4. Generate a new API key
5. Set `SAMBANOVA_API_KEY` env variable

---

## 5. **HuggingFace Inference API** (Fallback)
**Status:** Fallback provider  
**Environment Variables:** `HF_API_TOKEN` or `HUGGINGFACE_API_KEY` or `HF_API_KEY` or `HUGGING_FACE_API_KEY`

### Get Your API Key:
- **Hub:** https://huggingface.co/
- **Settings/Tokens:** https://huggingface.co/settings/tokens
- **Free Tier:** Yes (with limitations)
- **Pricing:** https://huggingface.co/pricing
- **Documentation:** https://huggingface.co/docs/hub/security-tokens

### Supported Models:
- `Qwen/Qwen2.5-7B-Instruct`
- `Qwen/Qwen2.5-Coder-32B-Instruct`
- `meta-llama/Llama-3.3-70B-Instruct`
- `deepseek-ai/DeepSeek-R1`

### Setup Steps:
1. Create account at https://huggingface.co/
2. Go to Settings → Access Tokens
3. Create a new token with "read" or "write" access
4. Copy the token
5. Set `HF_API_TOKEN` env variable

---

## 6. **OpenRouter API** (Fallback)
**Status:** Fallback provider - aggregates multiple models  
**Environment Variable:** `OPENROUTER_API_KEY`

### Get Your API Key:
- **Console:** https://openrouter.ai/
- **API Keys:** https://openrouter.ai/keys
- **Free Tier:** Yes (free model access via :free suffix)
- **Pricing:** https://openrouter.ai/pricing
- **Documentation:** https://openrouter.ai/docs

### Supported Free Models:
- `nvidia/nemotron-3-ultra-550b-a55b:free`
- `inclusionai/ling-3.0-flash:free`
- `google/gemma-4-31b-it:free`
- `poolside/laguna-s-2.1:free`
- `openrouter/free`

### Setup Steps:
1. Sign up at https://openrouter.ai/
2. Go to API Keys section
3. Create new API key
4. Copy the key
5. Set `OPENROUTER_API_KEY` env variable

---

## 7. **Supabase** (Backend Database)
**Status:** Required for data persistence  
**Environment Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Get Your Credentials:
- **Console:** https://supabase.com/
- **Projects:** https://supabase.com/dashboard/projects
- **API Keys:** In project settings → API
- **Free Tier:** Yes (with usage limits)
- **Pricing:** https://supabase.com/pricing
- **Documentation:** https://supabase.com/docs

### Setup Steps:
1. Go to https://supabase.com/
2. Create a new project
3. Go to Project Settings → API
4. Copy your Project URL and Service Role key
5. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env variables

---

## 🔑 Environment Variables Summary

Create a `.env.local` file in your Supabase functions directory with:

```bash
# Required
GEMINI_API_KEY=your_gemini_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key

# Recommended (fallback providers)
GROQ_API_KEY=your_groq_key
XAI_API_KEY=your_xai_key
SAMBANOVA_API_KEY=your_sambanova_key
HF_API_TOKEN=your_huggingface_token
OPENROUTER_API_KEY=your_openrouter_key
```

---

## 🔄 Provider Fallback Order

When a provider is rate-limited or fails, the system tries providers in this order:

1. **Gemini** (Primary - Google)
2. **xAI (Grok)** (Fast, low-latency fallback)
3. **Groq** (Fast inference, good for coding)
4. **SambaNova** (Open-weight models, separate quota)
5. **HuggingFace** (Community models)
6. **OpenRouter** (Model aggregator)

---

## 💡 Usage Tips

### For Development:
- Start with **Gemini Free Tier** (good for testing)
- Add **Groq** as backup (very fast)
- Both have generous free quotas

### For Production:
- Use **Gemini** as primary (most capable)
- Set up **Groq, SambaNova, OpenRouter** as fallbacks
- This ensures 99.9% uptime with automatic failover

### Cost Optimization:
- **Groq Free:** 6,000 tokens per minute (shared org-wide)
- **SambaNova Free:** 200K tokens/day per model (separate!)
- **OpenRouter Free:** Limited but useful for quick tests
- **Gemini:** Pay-as-you-go after free credits

---

## 🆘 Troubleshooting

### "Rate limit exceeded" / 429 errors
- Check if quota is exhausted
- System automatically falls back to next provider
- Consider adding more providers or upgrading to paid tier

### "No valid API key found" / Empty key errors
- Verify environment variables are set correctly
- Check `SUPABASE_URL` format (should include region)
- Restart functions after updating env variables

### Test Your Keys
```bash
# Test Gemini
curl -X POST "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'

# Test Groq
curl -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"Hello"}]}'
```

---

**Last Updated:** August 13, 2026  
**For more help:** See [API Documentation Links](#api-keys-reference-guide) above
