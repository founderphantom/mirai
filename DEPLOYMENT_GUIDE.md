# AIRI Authentication System - Deployment Guide

This guide will walk you through deploying the AIRI authentication system with Supabase and Google OAuth.

## Prerequisites

- Node.js 18+ and pnpm installed
- Supabase account (free tier works)
- Google Cloud Console account (for OAuth)
- Vercel, Netlify, or similar hosting account

## Step 1: Set Up Supabase Project

### 1.1 Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click "New Project"
3. Configure:
   - **Project name**: airi-saas
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier is fine for development

### 1.2 Get Supabase Credentials

Once created, go to Project Settings > API:
- Copy **Project URL** (looks like: `https://xxxxx.supabase.co`)
- Copy **anon public** key (safe for client-side)

## Step 2: Configure Google OAuth

### 2.1 Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable "Google+ API" in API Library

### 2.2 Create OAuth 2.0 Credentials

1. Go to APIs & Services > Credentials
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Configure OAuth consent screen first:
   - User Type: External
   - App name: AIRI
   - Support email: Your email
   - Authorized domains: Add your domain (e.g., `airi-saas.com`)
   - Save and continue through scopes (email and profile are default)

4. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Name: AIRI Web Client
   - Authorized JavaScript origins:
     - `http://localhost:5173` (development)
     - `https://your-domain.com` (production)
   - Authorized redirect URIs:
     - `http://localhost:5173/auth/callback`
     - `https://xxxxx.supabase.co/auth/v1/callback`
     - `https://your-domain.com/auth/callback`

5. Save and copy:
   - **Client ID**
   - **Client Secret**

### 2.3 Configure Supabase OAuth

1. In Supabase Dashboard, go to Authentication > Providers
2. Enable Google provider
3. Enter your Google OAuth credentials:
   - Client ID (from Google)
   - Client Secret (from Google)
4. Copy the **Callback URL** shown (add this to Google OAuth if not already)
5. Save

## Step 3: Configure Environment Variables

### 3.1 Create Local Environment File

```bash
cd apps/stage-web
cp .env.example .env
```

### 3.2 Update .env with Your Values

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your_anon_key

# OAuth Redirect URL
VITE_APP_URL=http://localhost:5173

# Optional: Enable debug mode
VITE_DEBUG=true
```

## Step 4: Build and Test Locally

### 4.1 Install Dependencies

```bash
# From project root
pnpm install
```

### 4.2 Run Development Server

```bash
# From project root
pnpm dev:web

# Or from apps/stage-web
cd apps/stage-web
pnpm dev
```

### 4.3 Test Authentication Flow

1. Open http://localhost:5173
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify redirect to dashboard

### 4.4 Test Other Features

- Email/password registration
- Password reset flow
- Protected routes
- Logout functionality

## Step 5: Deploy to Production

### Option A: Deploy to Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. From apps/stage-web directory:
```bash
vercel
```

3. Follow prompts:
   - Link to existing project or create new
   - Set framework preset: Vite
   - Build command: `pnpm build`
   - Output directory: `dist`

4. Set environment variables in Vercel:
   - Go to Project Settings > Environment Variables
   - Add all variables from .env with production values:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `VITE_APP_URL` (set to your production URL)

5. Deploy:
```bash
vercel --prod
```

### Option B: Deploy to Netlify

1. Build the project:
```bash
cd apps/stage-web
pnpm build
```

2. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

3. Deploy:
```bash
netlify deploy --dir=dist --prod
```

4. Set environment variables in Netlify:
   - Go to Site Settings > Environment Variables
   - Add same variables as above

### Option C: Deploy to Custom Server

1. Build the project:
```bash
cd apps/stage-web
pnpm build
```

2. The `dist` folder contains static files
3. Serve with any static file server (nginx, Apache, etc.)
4. Ensure environment variables are set on server

## Step 6: Post-Deployment Configuration

### 6.1 Update OAuth Redirect URLs

1. In Google Cloud Console, add production URLs:
   - Authorized JavaScript origins: `https://your-domain.com`
   - Authorized redirect URIs: `https://your-domain.com/auth/callback`

2. In Supabase Dashboard:
   - Go to Authentication > URL Configuration
   - Add site URL: `https://your-domain.com`
   - Add redirect URLs: `https://your-domain.com/auth/callback`

### 6.2 Configure Supabase Security

1. Enable Row Level Security (RLS) on all tables
2. Set up auth policies as needed
3. Configure rate limiting in Authentication > Settings

### 6.3 Set Up Monitoring

1. Supabase Dashboard provides:
   - Auth logs
   - Database metrics
   - API usage

2. Consider adding:
   - Sentry for error tracking
   - Analytics (Google Analytics, Plausible, etc.)
   - Uptime monitoring

## Step 7: Testing Production

### Checklist:
- [ ] Google OAuth login works
- [ ] Email/password registration works
- [ ] Password reset emails are received
- [ ] Protected routes redirect to login
- [ ] Logout clears session
- [ ] Mobile responsive design works
- [ ] Dark mode toggles correctly
- [ ] Forms show proper validation
- [ ] Loading states appear
- [ ] Error messages display

## Troubleshooting

### Common Issues:

**1. OAuth redirect mismatch error**
- Ensure redirect URLs match exactly in Google Console and Supabase
- Check for trailing slashes
- Verify protocol (http vs https)

**2. Supabase connection error**
- Verify environment variables are set
- Check Supabase project is active
- Ensure anon key is correct

**3. Build failures**
- Clear node_modules and reinstall: `pnpm clean && pnpm install`
- Check Node version (18+ required)
- Verify all environment variables are set

**4. Email not sending**
- Supabase free tier has email limits
- Check spam folder
- Configure custom SMTP in Supabase for production

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL | `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGc...` |
| `VITE_APP_URL` | Your application URL | `https://airi-saas.com` |
| `VITE_DEBUG` | Enable debug logging | `false` |

## Security Checklist

- [ ] Environment variables not committed to git
- [ ] Supabase RLS enabled on all tables
- [ ] Rate limiting configured
- [ ] HTTPS enforced in production
- [ ] Content Security Policy headers set
- [ ] CORS configured properly

## Next Steps

1. Set up database tables for your application
2. Implement user profile management
3. Add additional OAuth providers (Discord, GitHub)
4. Configure email templates in Supabase
5. Set up CI/CD pipeline
6. Implement monitoring and analytics

## Support

- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev)
- [Vue.js Documentation](https://vuejs.org)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)