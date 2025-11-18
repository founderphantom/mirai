# Polar Setup Guide - Mirai MVP

**Date:** 2025-10-16
**Status:** Implementation Phase

This guide walks through setting up Polar payment integration for Mirai MVP, including product configuration, pricing tiers, and integration steps.

---

## Table of Contents

1. [Overview](#overview)
2. [Polar Account Setup](#polar-account-setup)
3. [Product Configuration](#product-configuration)
4. [Environment Configuration](#environment-configuration)
5. [Integration Checklist](#integration-checklist)
6. [Testing](#testing)

---

## Overview

Mirai uses Polar as our Merchant of Record for:
- ✅ Global tax compliance (VAT, GST, sales tax)
- ✅ Subscription management
- ✅ Usage-based billing (voice minutes)
- ✅ Customer portal
- ✅ Payment processing

### Pricing Structure

| Tier     | Price               | Voice Minutes | Characters | Features |
|----------|---------------------|---------------|------------|----------|
| **Free** | $0/month            | 20 minutes | preset character | Basic features, limited voice |
| **Pro**  | $9/month $89/year   | 500 minutes | preset characters + marketplace access | Full features, priority support |
| **Max**  | $24/month $229/year | Unlimited | Unlimited | Custom integration + clone voices, SLA |

---

## Polar Account Setup

### 1. Create Polar Account

1. Visit https://polar.sh (production) or https://sandbox.polar.sh (testing)
2. Sign up with your email
3. Verify email address
4. Create organization: "Phantom Systems Inc" or "Mirai"

### 2. Get Access Credentials

**Organization Access Token:**
1. Navigate to Settings → API & Integrations
2. Click "Create Access Token"
3. Name: "Mirai API Gateway - Production"
4. Copy token and save securely

**Organization ID:**
1. Navigate to Settings → Organization
2. Copy "Organization ID" from URL or settings page

**Webhook Secret:**
1. Navigate to Settings → Webhooks
2. Click "Create Webhook"
3. URL: `https://mirai-api-gateway.founder-968.workers.dev/api/webhooks/polar`
4. Events: Select all subscription and payment events
5. Copy webhook secret

---

## Product Configuration

### Step 1: Create Products in Polar Dashboard

#### Product 1: Pro Monthly Subscription

1. Navigate to **Products** → **Create Product**
2. Fill in details:

```yaml
Name: Mirai Pro - Monthly
Description: |
  Full access to Mirai AI voice chat platform

  ✨ Features:
  - 500 voice minutes per month
  - Create up to 10 AI characters
  - Advanced character customization
  - Priority support
  - Early access to new features

  Perfect for individuals and small teams.

Billing Cycle: Monthly subscription
Pricing Type: Fixed price
Price: $19.00 USD

Trial Period: 7 days (optional but recommended)

Media:
  - Upload Mirai Pro product image (1200x630px)

Benefits:
  - Credits: 500 voice minutes (link to voice_minutes meter)
  - Custom: Pro tier access
```

3. Click **Create Product**
4. **IMPORTANT:** Copy the Product ID (e.g., `prod_xxxxxxxxxxxxx`)

#### Product 2: Pro Yearly Subscription (Optional - 20% discount)

```yaml
Name: Mirai Pro - Yearly
Description: Save 20% with annual billing

Billing Cycle: Yearly subscription
Pricing Type: Fixed price
Price: $182.40 USD (20% off $228)

Trial Period: 14 days

Benefits: Same as monthly
```

#### Product 3: Enterprise (Custom Pricing)

```yaml
Name: Mirai Enterprise
Description: |
  Custom solution for large organizations

  ✨ Features:
  - Unlimited voice minutes
  - Unlimited characters
  - Custom integrations
  - Dedicated support
  - SLA guarantee
  - SSO/SAML

  Contact us for pricing.

Billing Cycle: Monthly subscription
Pricing Type: Custom (contact sales)
Price: Contact for quote

Benefits:
  - Custom: Enterprise tier access
  - Custom: Dedicated account manager
```

---

### Step 2: Configure Usage Meters

Polar usage meters enable usage-based billing for voice minutes.

1. Navigate to **Products** → **Meters** → **Create Meter**

```yaml
Meter 1: Voice Minutes

Name: voice_minutes
Display Name: Voice Call Minutes
Description: Tracks voice conversation time in minutes
Type: Counter (increments only)
Reset Period: Monthly (resets at billing cycle)
Unit: minutes

# Link to Pro product benefit
```

---

### Step 3: Record Product IDs

After creating products, record their IDs:

```bash
# Add to .env file
POLAR_FREE_PRODUCT_ID=prod_free_xxxxxxxxxxxxx       # If you create a free tier product
POLAR_PRO_MONTHLY_ID=prod_pro_monthly_xxxxxxxxxxxxx
POLAR_PRO_YEARLY_ID=prod_pro_yearly_xxxxxxxxxxxxx
POLAR_ENTERPRISE_ID=prod_enterprise_xxxxxxxxxxxxx
```

---

## Environment Configuration

### 1. Cloudflare Secrets

Set these secrets in Cloudflare (never commit to git):

```bash
# For production
wrangler secret put POLAR_ACCESS_TOKEN
wrangler secret put POLAR_WEBHOOK_SECRET

# For staging/development
wrangler secret put POLAR_ACCESS_TOKEN --env staging
wrangler secret put POLAR_WEBHOOK_SECRET --env staging
```

### 2. wrangler.toml Configuration

Add to `apps/workers/api-gateway/wrangler.toml`:

```toml
[vars]
POLAR_ORGANIZATION_ID = "your_org_id_here"
POLAR_PRO_MONTHLY_ID = "prod_xxxxxxxxxxxxx"
POLAR_PRO_YEARLY_ID = "prod_yyyyyyyyyyy"
POLAR_ENTERPRISE_ID = "prod_zzzzzzzzzzz"

[env.staging]
vars = { POLAR_ORGANIZATION_ID = "sandbox_org_id" }

[env.production]
vars = { POLAR_ORGANIZATION_ID = "production_org_id" }
```

### 3. Frontend Environment Variables

Add to `apps/stage-web/.env`:

```bash
# Public variables (safe to expose)
VITE_POLAR_ORGANIZATION_ID=your_org_id
VITE_PRO_MONTHLY_PRODUCT_ID=prod_xxxxxxxxxxxxx
VITE_PRO_YEARLY_PRODUCT_ID=prod_yyyyyyyyyyy

# API Gateway URL
VITE_API_URL=https://mirai-api-gateway.founder-968.workers.dev
```

---

## Integration Checklist

### Backend (API Gateway)

- [x] Polar SDK configured in auth.ts:300
- [ ] Payment routes created (`/api/payments/*`)
  - [ ] `POST /api/payments/checkout` - Create checkout session
  - [ ] `GET /api/payments/portal` - Customer portal access
  - [ ] `GET /api/payments/subscription` - Get subscription status
  - [ ] `POST /api/payments/usage` - Report usage events
- [ ] Webhook handlers implemented
  - [x] `subscription.created`
  - [x] `subscription.updated`
  - [x] `subscription.canceled`
  - [ ] `subscription.revoked`
  - [ ] `order.created`
  - [ ] `benefit.granted`
  - [ ] `benefit.revoked`
- [ ] Subscription middleware for tier-based access
- [ ] Usage tracking service for voice minutes
- [ ] Database schema updated with all Polar fields

### Frontend (stage-web)

- [ ] Pricing page component
- [ ] Checkout flow integration
- [ ] Customer portal button
- [ ] Subscription status display
- [ ] Usage meter display (voice minutes remaining)
- [ ] Upgrade/downgrade flow

### Database

- [x] Subscriptions table created
- [x] Usage events table created
- [ ] Apply migrations to D1
- [ ] Add indexes for performance

### Testing

- [ ] Sandbox environment configured
- [ ] Test credit card: 4242 4242 4242 4242
- [ ] End-to-end checkout flow tested
- [ ] Webhook delivery verified
- [ ] Subscription lifecycle tested (trial → active → canceled)
- [ ] Usage tracking tested
- [ ] Customer portal tested

---

## Testing

### Sandbox Testing Checklist

**Prerequisites:**
- Create sandbox account at https://sandbox.polar.sh/start
- Create test products in sandbox
- Configure sandbox webhook URL
- Set `POLAR_ACCESS_TOKEN` to sandbox token

**Test Scenarios:**

1. **Free Tier User**
   - Sign up without subscription
   - Verify tier = 'free'
   - Verify no voice access

2. **Pro Subscription Flow**
   - Create checkout session for Pro monthly
   - Complete payment with test card (4242 4242 4242 4242)
   - Verify webhook received
   - Verify user upgraded to 'pro' tier
   - Verify voice minutes credited (500)

3. **Trial Period**
   - Start Pro trial
   - Verify immediate access
   - Verify no charge during trial
   - Cancel during trial
   - Verify downgrade to free

4. **Usage Tracking**
   - Use 100 voice minutes
   - Verify usage event recorded in DB
   - Verify Polar meter updated
   - Check usage display in customer portal

5. **Subscription Management**
   - Open customer portal
   - Change payment method
   - Update billing address
   - Cancel subscription
   - Verify cancellation at period end

6. **Upgrade/Downgrade**
   - Upgrade from Pro Monthly to Pro Yearly
   - Verify proration calculated
   - Downgrade to Free
   - Verify benefits revoked

---

## Production Deployment

### Pre-Launch Checklist

- [ ] All products created in production Polar
- [ ] Webhook URL configured to production API gateway
- [ ] All secrets set in Cloudflare Workers
- [ ] Database migrations applied to production D1
- [ ] End-to-end testing completed in sandbox
- [ ] Pricing page live on website
- [ ] Legal: Terms of Service updated with subscription terms
- [ ] Legal: Privacy Policy updated with payment processor info
- [ ] Support: Refund policy defined
- [ ] Support: Cancellation process documented
- [ ] Monitoring: Webhook failure alerts configured
- [ ] Monitoring: Payment error tracking enabled

### Launch Day

1. Deploy API gateway with payment routes
2. Deploy frontend with pricing page
3. Announce on social media / email list
4. Monitor webhook logs for errors
5. Monitor Cloudflare logs for API errors
6. Check Polar dashboard for first subscriptions

### Post-Launch Monitoring

- [ ] Daily: Check webhook delivery rate
- [ ] Daily: Monitor failed payments
- [ ] Weekly: Review subscription metrics
- [ ] Weekly: Check usage meter accuracy
- [ ] Monthly: Reconcile revenue with Polar dashboard
- [ ] Monthly: Review churn rate and cancellation reasons

---

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook URL in Polar dashboard
2. Verify webhook secret matches `POLAR_WEBHOOK_SECRET`
3. Check Cloudflare logs for 4xx/5xx errors
4. Test webhook manually from Polar dashboard
5. Verify CORS settings don't block webhook requests

### Subscription Not Updating User

1. Check webhook handler logs
2. Verify user exists in database
3. Verify `polarCustomerId` matches
4. Check database write permissions
5. Review transaction rollback errors

### Usage Meter Not Updating

1. Verify meter ID matches product benefit
2. Check usage event API call succeeds
3. Verify Polar API token has usage write permission
4. Check rate limiting on Polar API
5. Review usage ingestion queue

### Customer Portal Not Opening

1. Verify user has `polarCustomerId`
2. Check Polar API token is valid
3. Verify customer exists in Polar
4. Check redirect URL is whitelisted
5. Review CORS configuration

---

## Support Resources

- **Polar Documentation:** https://polar.sh/docs
- **Polar Discord:** https://discord.gg/polar
- **Polar Support:** support@polar.sh
- **API Status:** https://status.polar.sh

---

**Maintained by:** Phantom Systems Inc
**Last Updated:** 2025-10-16
