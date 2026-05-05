# Google OAuth Setup Guide

## ✅ Code Changes Completed

The "Continue with Google" button is now active on both Sign In and Sign Up tabs.

## 📋 Supabase Configuration Steps

### Step 1: Get Google OAuth Credentials

1. **Go to Google Cloud Console:**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project:**
   - Click on the project dropdown (top-left)
   - Create a new project or select existing one

3. **Enable Google+ API:**
   - Go to "APIs & Services" → "Library"
   - Search for "Google+ API"
   - Click "Enable"

4. **Create OAuth Credentials:**
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - If prompted, configure OAuth consent screen first:
     - User Type: External
     - App name: "StuddyHub AI"
     - User support email: Your email
     - Developer contact: Your email
     - Add scopes: email, profile, openid
     - Add test users if in development
     - Save and continue

5. **Configure OAuth Client:**
   - Application type: **Web application**
   - Name: "StuddyHub AI"
   - Authorized JavaScript origins:
     - `https://kegsrvnywshxyucgjxml.supabase.co`
     - `http://localhost:5173` (for local development)
   - Authorized redirect URIs:
     - `https://kegsrvnywshxyucgjxml.supabase.co/auth/v1/callback`
     - `http://localhost:5173/auth/callback` (for local development)
   - Click "CREATE"

6. **Copy Credentials:**
   - You'll get a **Client ID** and **Client Secret**
   - Keep these for the next step

### Step 2: Configure Supabase

1. **Go to Supabase Dashboard:**
   - Visit: https://supabase.com/dashboard/project/kegsrvnywshxyucgjxml

2. **Navigate to Authentication:**
   - Click "Authentication" in left sidebar
   - Click "Providers"
   - Find "Google" in the list

3. **Enable Google Provider:**
   - Toggle "Google Enabled" to ON
   - Paste your **Client ID** from Google
   - Paste your **Client Secret** from Google
   - Click "Save"

### Step 3: Add Authorized Domains

1. **In Supabase Authentication Settings:**
   - Go to "Authentication" → "URL Configuration"
   - Add your production domain:
     - `https://yourdomain.com`
   - Add localhost for development:
     - `http://localhost:5173`
   - Save changes

### Step 4: Test the Integration

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Navigate to the Auth page:**
   - Go to http://localhost:5173/auth

3. **Click "Continue with Google":**
   - Should redirect to Google sign-in
   - Select your Google account
   - Grant permissions
   - Should redirect back to your app at `/dashboard`

4. **Check the user was created:**
   - Go to Supabase Dashboard → Authentication → Users
   - You should see your user with Google provider

## 🔧 Production Deployment

### Update Google Cloud Console:

Add your production URLs:
- **Authorized JavaScript origins:**
  - `https://yourdomain.com`
  
- **Authorized redirect URIs:**
  - `https://yourdomain.com/auth/callback`

### Update Supabase:

- Go to Authentication → URL Configuration
- Add production site URL
- Ensure redirect URLs are configured

## 🎯 How It Works

1. User clicks "Continue with Google"
2. App calls `supabase.auth.signInWithOAuth({ provider: 'google' })`
3. User is redirected to Google sign-in
4. After successful sign-in, Google redirects to Supabase callback URL
5. Supabase creates/updates user in database
6. User is redirected to `/dashboard` in your app
7. Session is automatically established

## 🔐 Security Notes

- Client Secret should be kept confidential
- Never commit OAuth credentials to Git
- Use environment variables for sensitive data
- Enable email verification in Supabase if needed
- Set up proper redirect URL validation

## 📱 Mobile App Considerations

For mobile apps, you'll need to:
1. Use deep links for redirect URIs
2. Configure platform-specific OAuth flows
3. Update Google Cloud Console with mobile redirect URIs

## 🐛 Troubleshooting

**Error: "redirect_uri_mismatch"**
- Check that redirect URI in Google Console exactly matches Supabase callback URL
- Ensure no trailing slashes

**Error: "invalid_client"**
- Verify Client ID and Client Secret are correct
- Check they're properly saved in Supabase

**User redirected but not logged in:**
- Check browser console for errors
- Verify site URL in Supabase matches your domain
- Check redirect URL configuration

**Google consent screen not working:**
- Make sure Google+ API is enabled
- Verify OAuth consent screen is configured
- Add your email as test user if in development

## ✅ Next Steps

After Google OAuth is working:
- Add profile creation on first Google sign-in
- Sync user data from Google (name, avatar)
- Implement account linking (if user exists with same email)
- Add other providers (GitHub, Discord, etc.)

---

**Current Status:** Code is ready. Just need to configure Google Cloud Console and Supabase Dashboard.
