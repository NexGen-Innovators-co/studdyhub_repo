# 🚀 StuddyHub Deployment Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Database Setup](#database-setup)
- [Edge Functions Deployment](#edge-functions-deployment)
- [Frontend Deployment](#frontend-deployment)
- [Domain Configuration](#domain-configuration)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring & Analytics](#monitoring--analytics)
- [Security Checklist](#security-checklist)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

Before deploying StuddyHub, ensure you have:

### Required Accounts
- ✅ [Vercel](https://vercel.com) account (recommended) or other hosting
- ✅ [Supabase](https://supabase.com) project (Production)
- ✅ [Google Cloud](https://console.cloud.google.com) account (for Gemini API)
- ✅ [Paystack](https://paystack.com) account (for payments)
- ✅ GitHub/GitLab repository

### Required Tools
```bash
Node.js 18.x or higher
npm or yarn or bun
Supabase CLI
Git
```

### Install Supabase CLI
```bash
npm install -g supabase
# or
brew install supabase/tap/supabase
```

---

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/studdyhub_repo.git
cd studdyhub_repo
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Create `.env.production` file:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key

# Google Gemini AI
VITE_GEMINI_API_KEY=your_production_gemini_key

# App Configuration
VITE_APP_URL=https://studdyhub.com
VITE_APP_NAME=StuddyHub
VITE_APP_ENV=production

# Analytics
VITE_ANALYTICS_ID=your_vercel_analytics_id

# Paystack
VITE_PAYSTACK_PUBLIC_KEY=pk_live_xxxxx

# Optional: Sentry (Error Tracking)
VITE_SENTRY_DSN=your_sentry_dsn
```

### 4. Secure Environment Variables

**Never commit `.env` files to version control!**

```bash
# .gitignore should include:
.env
.env.local
.env.production
.env.*.local
```

---

## Database Setup

### 1. Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Choose organization
4. Set project name: "StuddyHub Production"
5. Generate strong database password (save it securely)
6. Choose region (closest to your users)
7. Wait for project to be ready (~2 minutes)

### 2. Link Local Project

```bash
# Login to Supabase
supabase login

# Link to production project
supabase link --project-ref your-project-ref
```

### 3. Run Migrations

```bash
# Push all migrations to production
supabase db push

# Or run migrations individually
supabase db push --file supabase/migrations/001_initial_schema.sql
```

#### AI Feed Migration

The AI-powered feed system requires a dedicated migration:

```bash
# Run the AI feed migration
# File: sql/20260215_ai_feed_columns.sql
# This adds:
#   - ai_categories, ai_sentiment, ai_quality_score columns to social_posts
#   - ai_preferred_categories, ai_preferred_authors, ai_profile_updated_at to social_users
#   - social_user_signals table (with RLS)
#   - 6 trigger functions for automatic signal recording
```

Run it via the Supabase SQL Editor or `psql` against the production database.

### 4. Verify Database Schema

```bash
# Check database status
supabase db diff

# Verify tables
supabase db list
```

### 5. Enable Row Level Security (RLS)

All tables should have RLS enabled. Verify:

```sql
-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- All tables should have rowsecurity = true
```

### 6. Create Database Indexes

```sql
-- Create performance indexes
CREATE INDEX CONCURRENTLY idx_notes_user_created 
  ON notes(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_documents_user_created 
  ON documents(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY idx_messages_user_created 
  ON ai_messages(user_id, created_at DESC);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY idx_notes_search 
  ON notes USING GIN(to_tsvector('english', content));

CREATE INDEX CONCURRENTLY idx_documents_search 
  ON documents USING GIN(to_tsvector('english', content));
```

### 7. Set Up Storage Buckets

```bash
# Create storage buckets
supabase storage create documents --public
supabase storage create recordings --public
supabase storage create avatars --public
supabase storage create media --public

# Set up CORS
supabase storage update documents --cors-allowed-origins "https://studdyhub.com"
```

### 8. Configure Storage Policies

```sql
-- Allow users to upload their own files
CREATE POLICY "Users can upload own files"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to read own files
CREATE POLICY "Users can read own files"
  ON storage.objects FOR SELECT
  USING (auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete own files
CREATE POLICY "Users can delete own files"
  ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);
```

---

## Edge Functions Deployment

### 1. Configure Edge Functions

Each function needs environment variables. Create `supabase/functions/.env`:

```env
GEMINI_API_KEY=your_production_key
PAYSTACK_SECRET_KEY=sk_live_xxxxx
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Deploy All Functions

```bash
# Deploy all functions at once
supabase functions deploy

# Or deploy individually
supabase functions deploy gemini-chat
supabase functions deploy document-extractor
supabase functions deploy gemini-audio-processor
# ... etc
```

#### AI Feed Functions

Deploy the AI feed edge functions (after running the AI feed migration):

```bash
# AI categorization service
supabase functions deploy ai-categorize-post --no-verify-jwt

# AI ranking service
supabase functions deploy ai-rank-feed --no-verify-jwt

# Updated social functions with AI integration
supabase functions deploy get-social-feed --no-verify-jwt
supabase functions deploy get-suggested-users --no-verify-jwt
supabase functions deploy create-social-post --no-verify-jwt
```

> **Note**: These functions require the `GEMINI_API_KEY` secret to be set (see step 4 below). The shared utility `utils/gemini.ts` is automatically bundled with each function.

### 3. Verify Deployment

```bash
# List deployed functions
supabase functions list

# Test a function
curl -i --location --request POST \
  'https://your-project.supabase.co/functions/v1/gemini-chat' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"message":"test"}'
```

### 4. Set Function Secrets

```bash
# Set secrets for functions
supabase secrets set GEMINI_API_KEY=your_key
supabase secrets set PAYSTACK_SECRET_KEY=your_key

# Verify secrets
supabase secrets list
```

### 5. Configure Function Limits

```toml
# supabase/functions/gemini-chat/deno.json
{
  "memory": 512,
  "timeout": 30,
  "region": "us-east-1"
}
```

---

## Frontend Deployment

### Option 1: Vercel (Recommended)

#### 1. Install Vercel CLI

```bash
npm install -g vercel
```

#### 2. Login to Vercel

```bash
vercel login
```

#### 3. Deploy

```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

#### 4. Configure Vercel Project

In Vercel Dashboard:

1. Go to Project Settings
2. **Environment Variables**
   - Add all variables from `.env.production`
   - Ensure they're set for "Production" environment

3. **Build Settings**
   ```
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Domains**
   - Add custom domain: `studdyhub.com`
   - Add `www.studdyhub.com` (redirect to main)

5. **Functions** (Optional for API routes)
   - Region: Same as Supabase
   - Memory: 1024MB
   - Timeout: 10s

#### 5. Automatic Deployments

Connect GitHub repository:
- Push to `main` branch = Production deployment
- Push to `develop` branch = Preview deployment
- Pull requests = Preview deployment

### Option 2: Self-Hosted (Docker)

#### 1. Create Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 2. Create nginx.conf

```nginx
server {
    listen 80;
    server_name studdyhub.com;
    root /usr/share/nginx/html;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### 3. Build and Run

```bash
# Build image
docker build -t studdyhub:latest .

# Run container
docker run -d -p 80:80 --name studdyhub studdyhub:latest
```

### Option 3: Netlify

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

**netlify.toml**:
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## Domain Configuration

### 1. DNS Settings

Point your domain to Vercel:

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

### 2. SSL Certificate

Vercel automatically provisions SSL certificates via Let's Encrypt.

Manual setup (if self-hosting):

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d studdyhub.com -d www.studdyhub.com

# Auto-renewal
sudo certbot renew --dry-run
```

### 3. Update Supabase Auth

In Supabase Dashboard > Authentication > URL Configuration:

```
Site URL: https://studdyhub.com
Redirect URLs:
  - https://studdyhub.com/auth/callback
  - https://studdyhub.com/auth/reset-password
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}

  deploy-database:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      
      - name: Deploy database migrations
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-functions:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
      
      - name: Deploy edge functions
        run: |
          supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
          supabase functions deploy
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

  deploy-frontend:
    needs: [test, deploy-database, deploy-functions]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Required GitHub Secrets

Add in GitHub Settings > Secrets and variables > Actions:

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_GEMINI_API_KEY
VITE_PAYSTACK_PUBLIC_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

---

## Monitoring & Analytics

### 1. Vercel Analytics

Automatically enabled for Vercel deployments.

View metrics:
- Page views
- Unique visitors
- Top pages
- Performance scores

### 2. Supabase Monitoring

Dashboard metrics:
- Database queries
- API requests
- Storage usage
- Active connections
- Error rates

### 3. Error Tracking (Sentry)

Install Sentry:

```bash
npm install @sentry/react @sentry/tracing
```

Configure:

```typescript
// src/main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
    new Sentry.Replay()
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});
```

### 4. Uptime Monitoring

Use services like:
- [UptimeRobot](https://uptimerobot.com) (free)
- [Pingdom](https://www.pingdom.com)
- [StatusCake](https://www.statuscake.com)

Monitor:
- https://studdyhub.com (main site)
- https://your-project.supabase.co/functions/v1/health (edge functions)

### 5. Log Aggregation

Supabase logs available in Dashboard > Logs

For advanced logging:
- LogRocket
- Datadog
- New Relic

---

## Security Checklist

### Pre-Deployment

- [ ] All environment variables are set
- [ ] No secrets in code/commits
- [ ] RLS policies enabled on all tables
- [ ] CORS configured correctly
- [ ] Rate limiting configured
- [ ] Input validation in place
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] HTTPS enforced
- [ ] Security headers configured

### Post-Deployment

- [ ] Test authentication flow
- [ ] Verify RLS policies working
- [ ] Test file upload limits
- [ ] Verify API rate limits
- [ ] Check error handling
- [ ] Test payment flow
- [ ] Verify email delivery
- [ ] Check SSL certificate
- [ ] Test all critical paths
- [ ] Monitor error rates

### Security Headers

Ensure these headers are set:

```
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'...
```

---

## Troubleshooting

### Common Issues

#### Build Failures

**Issue**: Build fails with TypeScript errors
```bash
# Solution: Check types
npm run type-check

# Fix common issues
npm run lint -- --fix
```

**Issue**: Missing environment variables
```bash
# Solution: Verify all required env vars
cat .env.production | grep VITE_
```

#### Database Issues

**Issue**: Migration fails
```bash
# Check migration status
supabase db diff

# Reset if needed (WARNING: data loss)
supabase db reset

# Re-run migrations
supabase db push
```

**Issue**: RLS blocks queries
```sql
-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'notes';

-- Test policy
SET ROLE authenticated;
SELECT * FROM notes WHERE user_id = 'test-user-id';
```

#### Function Issues

**Issue**: Edge function timeouts
```bash
# Check function logs
supabase functions logs gemini-chat

# Increase timeout in deno.json
```

**Issue**: Function not found
```bash
# Verify deployment
supabase functions list

# Redeploy
supabase functions deploy gemini-chat
```

#### Frontend Issues

**Issue**: 404 on page refresh
```
# Solution: Configure routing
# Vercel: Add vercel.json with rewrites
# Nginx: Configure try_files
```

**Issue**: CORS errors
```
# Check Supabase CORS settings
# Verify API URL matches frontend URL
```

### Debug Mode

Enable verbose logging:

```env
# .env.production
VITE_LOG_LEVEL=debug
```

---

## Rollback Procedures

### Frontend Rollback (Vercel)

```bash
# List recent deployments
vercel list

# Promote previous deployment
vercel promote [deployment-url]

# Or via dashboard
# Deployments > Select previous > Promote to Production
```

### Database Rollback

**Option 1: Revert Migration**
```bash
# Create down migration
supabase migration new revert_feature_x

# Write SQL to undo changes
# Run migration
supabase db push
```

**Option 2: Point-in-Time Recovery**
```bash
# Supabase Dashboard > Database > Backups
# Select backup point
# Restore (this creates new project)
```

### Edge Functions Rollback

```bash
# Deploy previous version
git checkout [previous-commit]
supabase functions deploy

# Or keep version tags
git tag v1.0.0
supabase functions deploy --version v1.0.0
```

---

## Production Checklist

### Before Launch

- [ ] All tests passing
- [ ] Performance testing done
- [ ] Security audit completed
- [ ] Backup strategy in place
- [ ] Monitoring configured
- [ ] Error tracking set up
- [ ] Domain configured
- [ ] SSL certificate valid
- [ ] Email service configured
- [ ] Payment system tested
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] SEO optimized
- [ ] Analytics configured
- [ ] Team access configured

### Launch Day

- [ ] Deploy to production
- [ ] Verify all systems operational
- [ ] Test critical user flows
- [ ] Monitor error rates
- [ ] Check analytics tracking
- [ ] Verify payment processing
- [ ] Test email delivery
- [ ] Monitor performance
- [ ] Be ready for rapid response

### Post-Launch

- [ ] Monitor for 24-48 hours
- [ ] Address any issues immediately
- [ ] Collect user feedback
- [ ] Review analytics
- [ ] Check error logs
- [ ] Verify backups working
- [ ] Document any issues
- [ ] Plan improvements

---

## Maintenance

### Regular Tasks

**Daily**
- Check error logs
- Monitor uptime
- Review user feedback

**Weekly**
- Review analytics
- Check security alerts
- Update dependencies (patch versions)
- Review database performance

**Monthly**
- Security audit
- Performance review
- Backup verification
- Cost analysis
- Update documentation

**Quarterly**
- Major dependency updates
- Feature reviews
- Security penetration testing
- Disaster recovery drill

---

## Support

For deployment issues:
- 📧 Email: devops@studdyhub.com
- 💬 Discord: [Join server](https://discord.gg/studdyhub)
- 📚 Docs: [docs/](.)

---

**Happy Deploying! 🚀**
