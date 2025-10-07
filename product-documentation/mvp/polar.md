# Polar Payment Platform Documentation

**Documentation Compiled:** 2025-10-06
**Project:** Mirai MVP - SaaS Payment & Subscription System
**Version:** Latest from polar.sh
**Monorepo Setup:** pnpm + Drizzle ORM

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Products](#products)
4. [Benefits (Entitlements)](#benefits-entitlements)
5. [Checkout](#checkout)
   - [Checkout Links](#checkout-links)
   - [Embedded Checkout](#embedded-checkout)
   - [Checkout Session API](#checkout-session-api)
6. [Integration](#integration)
   - [Authentication](#authentication)
   - [Sandbox Environment](#sandbox-environment)
   - [Customer State](#customer-state)
7. [SDK Adapters](#sdk-adapters)
   - [Better Auth Adapter](#better-auth-adapter)
   - [Hono Adapter](#hono-adapter)
8. [Features](#features)
   - [Trials](#trials)
   - [Custom Fields](#custom-fields)
   - [Discounts](#discounts)
   - [Orders & Subscriptions](#orders--subscriptions)
   - [Refunds](#refunds)
   - [Analytics](#analytics)
   - [Customer Management](#customer-management)
   - [Customer Portal](#customer-portal)
9. [Integration with Mirai MVP](#integration-with-mirai-mvp)

---

## Introduction

### What is Polar?

Polar is an **open-source Merchant of Record platform** designed for developers. It provides comprehensive billing infrastructure with automated global tax compliance, enabling developers to focus on building products rather than managing payment complexities.

### Key Problems Solved

1. **Tax Compliance**: Handles international VAT, GST, and sales tax regulations automatically
2. **Complex Billing Infrastructure**: Provides out-of-the-box billing solutions
3. **Manual Access Delivery**: Automates product and benefit distribution
4. **High Processing Costs**: Offers lower transaction fees compared to traditional solutions

### Core Features

**Flexible Product Management**
- One-time purchases
- Subscriptions (monthly/yearly)
- Flexible pricing models (fixed, pay-what-you-want, free)

**Powerful Checkout Options**
- Checkout Links
- Embedded Checkout
- Checkout API for programmatic access

**Automated Benefits (Entitlements)**
- License key generation
- File downloads (up to 10GB)
- GitHub repository access
- Discord role assignments
- Custom benefits

**Global Merchant of Record**
- Worldwide tax compliance
- Automatic tax calculation and collection
- Support for major markets globally

### Integration Options

**Framework Adapters**
- Next.js
- SvelteKit
- Laravel
- Express
- **Hono** (Recommended for Cloudflare Workers)

**Native SDKs**
- JavaScript/TypeScript
- Python
- Go
- PHP

### Pricing

- **Transaction Fee**: 4% + 40¢ per transaction
- **Monthly Fees**: None
- **Setup Costs**: None
- **Note**: Payment processing fees are non-refundable

### Open Source

- **License**: Apache 2.0
- **Development**: Public on GitHub
- **Community**: 36+ contributors
- **Transparency**: Fully open-source codebase

### Target Audiences

- Individual developers
- Small teams
- Growing businesses
- SaaS applications

### Unique Selling Points

- Developer-first approach
- Global sales capabilities
- Instant product delivery
- Transparent pricing
- 20% lower fees than traditional Merchant of Record solutions

---

## Getting Started

### Prerequisites

1. **Create Polar Account**
   - Sign up at https://polar.sh
   - Create your organization
   - Set up your products

2. **Get Access Token**
   - Navigate to organization settings
   - Create Organization Access Token (OAT)
   - Store securely in environment variables

3. **Install SDK**

```bash
# For TypeScript/JavaScript
pnpm add @polar-sh/sdk

# For Better Auth integration
pnpm add @polar-sh/better-auth

# For Hono integration (Cloudflare Workers)
pnpm add @polar-sh/hono zod
```

### Environment Variables

```env
# Polar Access Token
POLAR_ACCESS_TOKEN=your_access_token_here

# Polar Organization ID
POLAR_ORGANIZATION_ID=your_organization_id

# Polar Webhook Secret
POLAR_WEBHOOK_SECRET=your_webhook_secret

# Environment (sandbox or production)
POLAR_SERVER=sandbox
```

---

## Products

### Product Creation

Products are the core of Polar's system. Each product represents something you're selling, whether it's a one-time purchase or a subscription.

### Product Configuration Options

#### 1. Name & Description
- Product name for identification
- Description supports **Markdown** formatting
- Visible to customers during checkout

#### 2. Pricing Models

**Billing Cycles:**
- One-time purchase
- Monthly subscription
- Yearly subscription

**Pricing Types:**
- **Fixed Price**: Set price amount
- **Pay What You Want**: Customer chooses amount
- **Free**: No charge

**Important**: Billing cycle and pricing type **cannot be changed** after product creation.

#### 3. Trial Periods
- Optional for recurring products only
- Configurable duration (days/weeks/months/years)
- Payment info collected upfront
- No charge during trial
- See [Trials](#trials) section for details

#### 4. Product Media
- Upload product images
- Maximum 10MB per image
- Reorder and remove images
- Displayed during checkout

#### 5. Checkout Fields
Custom fields for collecting additional data:
- Text
- Number
- Date
- Checkbox
- Select

See [Custom Fields](#custom-fields) for details.

#### 6. Automated Entitlements/Benefits
Built-in benefit types:
- License Keys
- Discord Server Role
- GitHub Repository Access
- File Downloads (up to 10GB)
- Custom Benefits

See [Benefits](#benefits-entitlements) for details.

### Unique Polar Approach

- **Single Pricing Model**: Each product has one pricing model
- **Multiple Products at Checkout**: Showcase multiple products in one checkout
- **Archive, Don't Delete**: Products can be archived to preserve history
- **Subscriber Protection**: Existing subscribers maintain original pricing when product is updated

### Product Management Best Practices

1. **Product Naming**: Use clear, descriptive names
2. **Pricing Strategy**: Start with fixed pricing, add flexibility later
3. **Trial Periods**: Use trials to reduce purchase friction
4. **Benefits**: Automate benefit delivery for better UX
5. **Media**: Use high-quality images for better conversion

---

## Benefits (Entitlements)

### Overview

Benefits are automated entitlements that customers receive when they purchase products or maintain active subscriptions. They're a powerful way to deliver value automatically.

### Benefit Types

#### 1. Credits
- Balance usage meter credits
- Track and limit usage
- Ideal for usage-based billing

#### 2. License Keys
- Customizable software license keys
- Automatic generation
- Revocable on subscription cancellation

#### 3. File Downloads
- Downloadable files up to 10GB
- Direct download links
- Access control based on subscription status

#### 4. GitHub Repository Access
- Automatic private repository invitations
- Managed via GitHub API
- Revoked when subscription ends

#### 5. Discord Invite
- Automated role assignment
- Server invitation management
- Role removal on subscription end

### Access Rules

**✅ Customers with Access:**
- Active subscribers
- Lifetime product purchasers
- Trial period users

**❌ Customers without Access:**
- Expired subscriptions
- Non-customers
- Canceled subscriptions (after end date)

### Management Methods

#### 1. Product-Level Management
- Add benefits during product creation
- Configure in product edit form
- Benefits tied to specific product

#### 2. Centralized Dashboard Management
- Create benefits in "Benefits" section
- Reuse across multiple products
- Update once, affects all products

### Key Advantages

- **Reusability**: Create once, use in multiple products
- **Centralized Updates**: Modify benefit, updates everywhere
- **No Duplication**: Single source of truth
- **Better UX**: Clear benefit management interface

### Best Practices

1. **Centralize Common Benefits**: If a benefit is used in multiple products, manage it centrally
2. **Clear Naming**: Use descriptive benefit names
3. **Automate Everything**: Let Polar handle delivery and revocation
4. **Test Thoroughly**: Verify benefit delivery in sandbox environment

---

## Checkout

Polar provides three ways to create checkout experiences:

1. **Checkout Links**: Simple shareable links
2. **Embedded Checkout**: Integrate checkout into your website
3. **Checkout Session API**: Programmatic checkout creation

---

### Checkout Links

#### Overview

Checkout Links are the simplest way to sell products. Share a link that creates a checkout session automatically.

#### Location
- Products section → "Checkout Links" tab

#### Creating a Checkout Link

1. **Add Internal Label**: For your reference only
2. **Select Products**: Choose one or multiple products
3. **Optional Discount**: Apply discount code
4. **Add Metadata**: Track attribution and custom data

#### Usage

Share the link via:
- Website buttons/links
- Social media
- Email campaigns
- Direct messages to customers

#### Query Parameters

**Prepopulate Customer Information:**
```
?customer_email=user@example.com
&customer_name=John Doe
&discount_code=SAVE20
&amount=9900
```

**Attribution Metadata:**
```
?reference_id=campaign_123
&utm_source=twitter
&utm_medium=social
&utm_campaign=launch
&utm_content=button
&utm_term=keyword
```

**Custom Field Data:**
```
?custom_field_slug=value
```

#### Important Limitations

⚠️ **Temporary Sessions**: Checkout Links create short-lived sessions that expire if no purchase is made.

⚠️ **API Rate Limits**: Checkout Links make API calls, so they're subject to rate limiting.

#### Recommendation

For complex or programmatic integrations, use the [Checkout Session API](#checkout-session-api) instead.

---

### Embedded Checkout

#### Overview

Embed Polar's checkout directly on your website for a seamless purchase experience without redirecting users.

#### Integration Methods

**1. Simple Script Tag (CDN)**

```html
<!-- Add to your HTML -->
<a
  href="YOUR_CHECKOUT_LINK"
  data-polar-checkout
  data-polar-checkout-theme="light"
>
  Purchase
</a>

<script
  src="https://cdn.jsdelivr.net/npm/@polar-sh/checkout@0.1/dist/embed.global.js"
  defer
  data-auto-init
></script>
```

**2. NPM Package Installation**

```bash
pnpm add @polar-sh/checkout
```

**3. React Integration**

```typescript
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'
import { useEffect } from 'react'

const PurchaseButton = () => {
  useEffect(() => {
    PolarEmbedCheckout.init()
  }, [])

  return (
    <a
      href="YOUR_CHECKOUT_LINK"
      data-polar-checkout
      data-polar-checkout-theme="light"
    >
      Purchase
    </a>
  )
}
```

#### Theme Options

```typescript
// Light theme
data-polar-checkout-theme="light"

// Dark theme
data-polar-checkout-theme="dark"
```

#### Advanced Features

**Programmatic Checkout Creation**
```typescript
import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'

// Initialize
PolarEmbedCheckout.init()

// Open checkout programmatically
PolarEmbedCheckout.open({
  checkoutLink: 'YOUR_CHECKOUT_LINK',
  theme: 'dark'
})
```

**Event Listeners**
```typescript
// Listen to checkout events
window.addEventListener('polar-checkout-success', (event) => {
  console.log('Checkout successful!', event.detail)
})

window.addEventListener('polar-checkout-close', () => {
  console.log('Checkout closed')
})
```

#### Wallet Payments

**Supported Wallets:**
- **Apple Pay**: Safari on Apple devices
- **Google Pay**: Chrome with configured Google account

**Enabling Wallet Payments:**
Contact Polar support with:
- Organization slug
- Domain for wallet verification

#### Best Practices

1. **Theme Matching**: Match checkout theme to your website design
2. **Loading States**: Show loading indicator while checkout initializes
3. **Error Handling**: Handle checkout failures gracefully
4. **Mobile Testing**: Test on various devices and screen sizes

---

### Checkout Session API

#### Overview

Create checkout sessions programmatically using Polar's API. This is the most flexible checkout option for custom integrations.

#### Prerequisites

- Polar Access Token
- Product ID(s)
- Polar SDK installed

#### Getting Product ID

1. Navigate to Products dashboard
2. Click context menu (three dots) next to product
3. Copy Product ID
4. Store in your configuration

#### Basic Usage

**TypeScript/JavaScript:**
```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN
})

// Create checkout session
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  successUrl: 'https://yourdomain.com/success',
  // Optional parameters
  customerId: 'cus_xxxxxxxxxxxxx',
  customerEmail: 'user@example.com',
  allowDiscountCodes: true,
  metadata: {
    userId: '12345',
    plan: 'pro'
  }
})

// Redirect user to checkout
window.location.href = checkout.url
```

**Python:**
```python
from polar_sdk import Polar

polar = Polar(
    access_token=os.environ["POLAR_ACCESS_TOKEN"]
)

checkout = polar.checkouts.create(request={
    "product_id": "prod_xxxxxxxxxxxxx",
    "success_url": "https://yourdomain.com/success",
    "allow_discount_codes": True
})

# checkout.url contains the checkout URL
```

#### Advanced Configuration

**Multiple Products:**
```typescript
const checkout = await polar.checkouts.create({
  products: [
    'prod_xxxxxxxxxxxxx',
    'prod_yyyyyyyyyyyyy'
  ],
  successUrl: 'https://yourdomain.com/success'
})
```

**External Customer ID Mapping:**
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  customerEmail: 'user@example.com',
  metadata: {
    externalId: 'user_12345', // Your system's user ID
    accountType: 'premium'
  }
})
```

**Prefilled Customer Information:**
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  customerEmail: 'user@example.com',
  customerName: 'John Doe',
  customerBillingAddress: {
    country: 'US'
  }
})
```

**Custom Success/Cancel URLs:**
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  successUrl: 'https://yourdomain.com/success?session_id={CHECKOUT_ID}',
  cancelUrl: 'https://yourdomain.com/cancel'
})
```

#### API Reference

**Endpoint**: `/api-reference/checkouts/create-session`

**Required Parameters:**
- `productId` or `products`: Product ID(s) to purchase

**Optional Parameters:**
- `successUrl`: Redirect URL after successful purchase
- `cancelUrl`: Redirect URL if checkout is canceled
- `customerId`: Existing Polar customer ID
- `customerEmail`: Pre-fill customer email
- `customerName`: Pre-fill customer name
- `allowDiscountCodes`: Enable discount code input
- `metadata`: Custom key-value pairs
- `customerBillingAddress`: Pre-fill billing address

**Response:**
```typescript
{
  id: string           // Checkout session ID
  url: string          // Checkout URL to redirect user
  customerId: string   // Polar customer ID
  productId: string    // Product ID
  status: string       // 'open' | 'confirmed' | 'succeeded' | 'expired'
  // ... additional fields
}
```

#### Webhook Integration

Listen for checkout events:
```typescript
// Webhook event: checkout.created
// Webhook event: checkout.updated
// Webhook event: checkout.succeeded
```

See [Webhooks](#webhooks) section for details.

---

## Integration

### Authentication

Polar API offers two authentication mechanisms:

#### 1. Organization Access Tokens (OAT) - Recommended

**Creating an OAT:**
1. Navigate to organization settings
2. Click "Create Access Token"
3. Name your token
4. Copy and store securely

**Usage:**
```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN
})
```

**Benefits:**
- Scoped to single organization
- Easy to create and revoke
- No OAuth flow required

#### 2. OAuth 2.0 Provider

For partner integrations and third-party applications.

**Use Cases:**
- Building integrations for multiple organizations
- Third-party applications
- Multi-tenant platforms

### Security Best Practices

⚠️ **Critical Security Rules:**

1. **Never expose tokens in client-side code**
2. **Use environment variables for token storage**
3. **Never commit tokens to version control**
4. **Regularly rotate access tokens**
5. **Use separate tokens for development/production**

**Secret Scanning Protection:**
- Polar is part of GitHub's Secret Scanning Program
- Leaked tokens are automatically revoked
- Email notification sent on token leak detection

**Resources:**
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

### Sandbox Environment

#### Overview

Polar provides an isolated sandbox environment for testing without affecting production data or making real payments.

#### Access

**URL**: https://sandbox.polar.sh/start

**Features:**
- Separate from production environment
- Unlimited test accounts and organizations
- Test payments using Stripe test cards
- Full feature parity with production

#### Test Payments

**Easiest Test Card:**
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
ZIP: Any 5 digits
```

**More Test Cards:**
See [Stripe Test Cards](https://stripe.com/docs/testing#cards) for additional scenarios.

#### SDK Configuration

**TypeScript:**
```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  server: 'sandbox',
  accessToken: process.env.POLAR_SANDBOX_ACCESS_TOKEN
})
```

**Python:**
```python
from polar_sdk import Polar

polar = Polar(
    server='sandbox',
    access_token=os.environ["POLAR_SANDBOX_ACCESS_TOKEN"]
)
```

**Go:**
```go
client := polargo.New(
    polargo.WithServer("sandbox"),
    polargo.WithAccessToken(os.Getenv("POLAR_SANDBOX_ACCESS_TOKEN")),
)
```

**PHP:**
```php
$polar = Polar\Polar::builder()
    ->setServer('sandbox')
    ->setAccessToken(getenv('POLAR_SANDBOX_ACCESS_TOKEN'))
    ->build();
```

#### Base URL Changes

When using the API directly (not via SDK):

**Production**: `https://api.polar.sh`
**Sandbox**: `https://sandbox-api.polar.sh`

#### Important Limitations

⚠️ **Subscription Lifecycle:**
- Subscriptions are automatically canceled **90 days after creation**
- This prevents infinite test subscriptions
- Reset by creating new test subscriptions

#### Best Practices

1. **Separate Accounts**: Use different email for sandbox vs production
2. **Separate Tokens**: Never use production tokens in sandbox
3. **Test Everything**: Complete full checkout flow in sandbox before production
4. **Webhook Testing**: Test all webhook handlers in sandbox
5. **Environment Variables**: Use different env vars for sandbox/production

#### Getting Started with Sandbox

1. Visit https://sandbox.polar.sh/start
2. Create sandbox user account
3. Create test organization
4. Set up test products
5. Create sandbox access token
6. Configure SDK with sandbox server
7. Test checkout flows
8. Test webhook handlers
9. Verify benefit delivery

---

### Customer State

#### Overview

Customer State provides a **single API call** to retrieve comprehensive information about a customer, including subscriptions, benefits, and usage.

#### What's Included in Customer State

**Customer State Object Contains:**
- Customer data (name, email, metadata)
- Active subscriptions
- Granted benefits
- Active meters with current balance
- External ID mapping

#### Use Cases

1. **Service Access Control**: Determine if customer should have access
2. **Feature Gating**: Check subscription tier for feature availability
3. **Usage Tracking**: Monitor meter balances
4. **Benefit Verification**: Confirm active benefits

#### API Methods

**1. Get Customer State by External ID**

This is the recommended method when you have your own user management system.

```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN
})

// Get customer state using your user ID
const customerState = await polar.customers.getByExternalId({
  externalCustomerId: 'your_user_id_12345'
})

console.log(customerState)
// {
//   customer: { id, email, name, ... },
//   subscriptions: [...],
//   benefits: [...],
//   meters: [...]
// }
```

**2. Get Customer State by Polar Customer ID**

```typescript
const customerState = await polar.customers.get({
  id: 'polar_customer_id'
})
```

#### Response Structure

```typescript
interface CustomerState {
  customer: {
    id: string
    email: string
    name: string
    metadata: Record<string, any>
    externalId?: string
  }

  subscriptions: Array<{
    id: string
    status: 'active' | 'trialing' | 'canceled' | 'past_due'
    productId: string
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
  }>

  benefits: Array<{
    id: string
    type: 'license_key' | 'file_download' | 'github_repo' | 'discord' | 'custom'
    description: string
    properties: Record<string, any>
  }>

  meters: Array<{
    id: string
    balance: number
    limit: number
  }>
}
```

#### Webhook: `customer.state_changed`

This webhook is triggered whenever customer state changes:

**Trigger Events:**
- Customer created/updated/deleted
- Subscription started/renewed/canceled
- Benefit granted/revoked
- Meter balance changed

**Example Handler:**
```typescript
app.post('/webhooks/polar', async (req, res) => {
  const event = req.body

  if (event.type === 'customer.state_changed') {
    const { customer, subscriptions, benefits, meters } = event.data

    // Update your database
    await updateCustomerAccess(customer.externalId, {
      hasActiveSubscription: subscriptions.some(s => s.status === 'active'),
      benefits: benefits,
      usage: meters
    })
  }

  res.json({ received: true })
})
```

#### Integration Pattern

**Recommended Flow:**

1. **User Signs Up in Your App**
   ```typescript
   // After user registration in your system
   const user = await createUser({ email, name })

   // Create Polar customer with external ID
   const polarCustomer = await polar.customers.create({
     email: user.email,
     name: user.name,
     externalId: user.id // Your user ID
   })
   ```

2. **User Completes Checkout**
   ```typescript
   const checkout = await polar.checkouts.create({
     productId: 'prod_xxxxxxxxxxxxx',
     customerEmail: user.email,
     metadata: {
       externalId: user.id
     }
   })
   ```

3. **Check Access in Your App**
   ```typescript
   // When user tries to access a feature
   const customerState = await polar.customers.getByExternalId({
     externalCustomerId: user.id
   })

   const hasAccess = customerState.subscriptions.some(
     sub => sub.status === 'active' || sub.status === 'trialing'
   )

   if (!hasAccess) {
     return res.status(403).json({ error: 'Subscription required' })
   }
   ```

4. **Listen to State Changes**
   ```typescript
   // Webhook handler keeps your system in sync
   if (event.type === 'customer.state_changed') {
     // Update cached access permissions
     await updateUserAccess(event.data.customer.externalId, event.data)
   }
   ```

#### Benefits

✅ **Single API Call**: Get all customer data at once
✅ **Real-time Sync**: Webhooks keep your system updated
✅ **External ID Mapping**: Easy integration with existing user management
✅ **Comprehensive**: Subscriptions + Benefits + Usage in one object

#### Best Practices

1. **Use External IDs**: Always set externalId when creating customers
2. **Cache Customer State**: Store in your database, update via webhooks
3. **Handle Webhook Events**: Keep your system synchronized
4. **Graceful Degradation**: Handle API failures gracefully
5. **Test State Changes**: Verify all state transitions in sandbox

---

## SDK Adapters

### Better Auth Adapter

#### Overview

The Polar Better Auth adapter provides seamless integration between Better Auth (authentication system) and Polar (payment system), enabling automatic customer management, checkout flows, and webhook handling.

**Perfect for Mirai MVP** since we're already using Better Auth!

#### Installation

```bash
pnpm add better-auth @polar-sh/better-auth @polar-sh/sdk
```

#### Key Features

- ✅ Automatic customer creation on signup
- ✅ Customer deletion synchronization
- ✅ Checkout integration
- ✅ Usage-based billing
- ✅ Webhook handling
- ✅ Customer portal management

#### Server-Side Setup

**1. Create Polar SDK Client**

```typescript
// lib/polar.ts
import { Polar } from '@polar-sh/sdk'

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
})
```

**2. Configure Better Auth with Polar Plugin**

```typescript
// auth.ts
import { betterAuth } from "better-auth"
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth"
import { polarClient } from "./lib/polar"

export const auth = betterAuth({
  database: {
    // Your database configuration
  },

  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true, // Auto-create Polar customer

      use: [
        // Checkout plugin
        checkout({
          organizationId: process.env.POLAR_ORGANIZATION_ID!,
          products: {
            // Map subscription tiers to Polar products
            free: process.env.POLAR_FREE_PRODUCT_ID!,
            pro: process.env.POLAR_PRO_PRODUCT_ID!,
            enterprise: process.env.POLAR_ENTERPRISE_PRODUCT_ID!
          }
        }),

        // Customer portal plugin
        portal(),

        // Usage-based billing plugin
        usage(),

        // Webhooks plugin
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,
          onPaymentSuccess: async (event) => {
            console.log('Payment successful:', event)
            // Handle successful payment
          },
          onSubscriptionCreated: async (event) => {
            console.log('Subscription created:', event)
            // Update user tier in database
          },
          onSubscriptionUpdated: async (event) => {
            console.log('Subscription updated:', event)
            // Update user tier in database
          },
          onSubscriptionCanceled: async (event) => {
            console.log('Subscription canceled:', event)
            // Downgrade user to free tier
          }
        })
      ]
    })
  ]
})
```

#### Client-Side Setup

**1. Install Better Auth React**

```bash
pnpm add @better-auth/react
```

**2. Create Auth Client with Polar**

```typescript
// lib/auth-client.ts
import { createAuthClient } from "@better-auth/react"
import { polarClient } from "@polar-sh/better-auth/client"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL!,
  plugins: [polarClient()]
})
```

#### Usage Examples

**1. Create Checkout Session**

```typescript
import { authClient } from '@/lib/auth-client'

async function handleUpgrade() {
  try {
    const checkout = await authClient.checkout({
      productId: 'pro', // Tier name from checkout plugin config
      successUrl: '/dashboard?upgraded=true',
      cancelUrl: '/pricing'
    })

    // Redirect to checkout
    window.location.href = checkout.url
  } catch (error) {
    console.error('Checkout failed:', error)
  }
}
```

**2. Open Customer Portal**

```typescript
async function openPortal() {
  try {
    const portal = await authClient.customer.portal()

    // Open portal in new tab
    window.open(portal.url, '_blank')
  } catch (error) {
    console.error('Portal failed:', error)
  }
}
```

**3. Get Customer State**

```typescript
async function checkSubscription() {
  const state = await authClient.customer.state()

  const hasActiveSubscription = state.subscriptions.some(
    sub => sub.status === 'active' || sub.status === 'trialing'
  )

  if (hasActiveSubscription) {
    // User has active subscription
    const subscription = state.subscriptions[0]
    console.log('Subscription tier:', subscription.productId)
    console.log('Ends on:', subscription.currentPeriodEnd)
  }
}
```

**4. Track Usage (Usage-Based Billing)**

```typescript
async function trackVoiceMinutes(minutes: number) {
  await authClient.usage.ingestion({
    eventName: 'voice_minutes',
    value: minutes,
    timestamp: new Date().toISOString()
  })
}
```

**5. List Customer Benefits**

```typescript
async function getBenefits() {
  const state = await authClient.customer.state()

  state.benefits.forEach(benefit => {
    console.log('Benefit type:', benefit.type)
    console.log('Description:', benefit.description)

    if (benefit.type === 'license_key') {
      console.log('License key:', benefit.properties.key)
    }
  })
}
```

#### Webhook Handler

The Polar plugin automatically handles webhooks, but you can add custom handlers:

```typescript
webhooks({
  secret: process.env.POLAR_WEBHOOK_SECRET!,

  // Subscription events
  onSubscriptionCreated: async (event) => {
    const { customer, subscription } = event.data

    // Update user in your database
    await updateUserTier(customer.externalId, subscription.productId)
  },

  onSubscriptionCanceled: async (event) => {
    const { customer } = event.data

    // Downgrade user
    await updateUserTier(customer.externalId, 'free')
  },

  // Payment events
  onPaymentSuccess: async (event) => {
    // Send confirmation email
    await sendEmail({
      to: event.data.customer.email,
      subject: 'Payment received',
      template: 'payment-success'
    })
  },

  // Benefit events
  onBenefitGranted: async (event) => {
    console.log('Benefit granted:', event.data.benefit)
  },

  onBenefitRevoked: async (event) => {
    console.log('Benefit revoked:', event.data.benefit)
  }
})
```

#### Integration with Mirai MVP

**Environment Variables:**
```env
# Polar Configuration
POLAR_ACCESS_TOKEN=your_access_token
POLAR_ORGANIZATION_ID=your_org_id
POLAR_WEBHOOK_SECRET=your_webhook_secret
POLAR_FREE_PRODUCT_ID=prod_xxxxxxxxxxxxx
POLAR_PRO_PRODUCT_ID=prod_yyyyyyyyyyyyy
POLAR_ENTERPRISE_PRODUCT_ID=prod_zzzzzzzzzzzzz
```

**Better Auth Configuration:**
```typescript
// apps/workers/api-gateway/src/auth.ts
import { betterAuth } from "better-auth"
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth"
import { polarClient } from "./lib/polar"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { db } from "@mirai/database-schema"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite" // For Cloudflare D1
  }),

  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      use: [
        checkout({
          organizationId: process.env.POLAR_ORGANIZATION_ID!,
          products: {
            free: process.env.POLAR_FREE_PRODUCT_ID!,
            pro: process.env.POLAR_PRO_PRODUCT_ID!,
            enterprise: process.env.POLAR_ENTERPRISE_PRODUCT_ID!
          }
        }),
        portal(),
        usage(),
        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,

          onSubscriptionCreated: async (event) => {
            // Update user subscription in D1
            const { customer, subscription } = event.data

            await db.update(users)
              .set({
                subscriptionTier: subscription.productId,
                subscriptionStatus: subscription.status,
                polarCustomerId: customer.id
              })
              .where(eq(users.email, customer.email))
          },

          onSubscriptionCanceled: async (event) => {
            // Downgrade to free tier
            const { customer } = event.data

            await db.update(users)
              .set({
                subscriptionTier: 'free',
                subscriptionStatus: 'canceled'
              })
              .where(eq(users.polarCustomerId, customer.id))
          }
        })
      ]
    })
  ]
})
```

---

### Hono Adapter

#### Overview

The Polar Hono adapter provides middleware for integrating Polar payments into Hono applications, perfect for **Cloudflare Workers**.

**Highly Recommended for Mirai MVP** since we're using Hono for the API Gateway!

#### Installation

```bash
pnpm add @polar-sh/hono zod
```

#### Key Features

- ✅ Checkout middleware
- ✅ Customer portal middleware
- ✅ Webhook handling middleware
- ✅ Full TypeScript support
- ✅ Cloudflare Workers compatible

#### Basic Setup

```typescript
import { Hono } from 'hono'
import { Checkout, CustomerPortal, Webhooks } from '@polar-sh/hono'

const app = new Hono()

// Environment variables
const config = {
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'sandbox' as const, // or 'production'
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!
}
```

#### Checkout Middleware

**1. Basic Checkout Handler**

```typescript
import { Checkout } from '@polar-sh/hono'

app.get('/checkout', Checkout({
  accessToken: config.accessToken,
  server: config.server,
  successUrl: process.env.SUCCESS_URL,
  theme: 'dark' // Optional: 'light' | 'dark'
}))
```

**2. With Query Parameters**

Users can pass query parameters to customize checkout:

```
GET /checkout?products=prod_xxxxx,prod_yyyyy&customerEmail=user@example.com
```

**Supported Query Parameters:**
- `products`: Comma-separated product IDs (required)
- `customerId`: Existing Polar customer ID
- `customerExternalId`: Your system's customer ID
- `customerEmail`: Pre-fill customer email
- `customerName`: Pre-fill customer name
- `metadata`: URL-encoded JSON metadata

**3. Advanced Checkout with Product Mapping**

```typescript
app.get('/checkout/:tier', async (c) => {
  const tier = c.req.param('tier')

  // Map tier to product ID
  const productMap = {
    free: process.env.POLAR_FREE_PRODUCT_ID,
    pro: process.env.POLAR_PRO_PRODUCT_ID,
    enterprise: process.env.POLAR_ENTERPRISE_PRODUCT_ID
  }

  const productId = productMap[tier]
  if (!productId) {
    return c.json({ error: 'Invalid tier' }, 400)
  }

  // Create checkout session
  const polar = new Polar({
    accessToken: config.accessToken,
    server: config.server
  })

  const checkout = await polar.checkouts.create({
    productId,
    successUrl: `${process.env.APP_URL}/dashboard?tier=${tier}`,
    cancelUrl: `${process.env.APP_URL}/pricing`
  })

  return c.redirect(checkout.url)
})
```

#### Customer Portal Middleware

**1. Basic Portal Handler**

```typescript
import { CustomerPortal } from '@polar-sh/hono'

app.get('/portal', CustomerPortal({
  accessToken: config.accessToken,
  server: config.server,

  // Function to get customer ID from request
  getCustomerId: async (event) => {
    // Extract from session, JWT, or other auth method
    const userId = event.get('userId') // From auth middleware

    // Get Polar customer ID from your database
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    })

    return user?.polarCustomerId || ''
  }
}))
```

**2. With Better Auth Integration**

```typescript
import { auth } from './auth'

app.get('/portal', async (c) => {
  // Get session from Better Auth
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Get user's Polar customer ID
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id)
  })

  if (!user?.polarCustomerId) {
    return c.json({ error: 'No subscription found' }, 404)
  }

  // Create portal session
  const polar = new Polar({
    accessToken: config.accessToken,
    server: config.server
  })

  const portal = await polar.customerSessions.create({
    customerId: user.polarCustomerId
  })

  return c.redirect(portal.customerPortalUrl)
})
```

#### Webhooks Middleware

**1. Basic Webhook Handler**

```typescript
import { Webhooks } from '@polar-sh/hono'

app.post('/webhooks/polar', Webhooks({
  webhookSecret: config.webhookSecret!,

  onPayload: async (payload) => {
    console.log('Webhook received:', payload.type)

    // Handle all webhook events
    switch (payload.type) {
      case 'checkout.created':
        console.log('Checkout created:', payload.data)
        break

      case 'order.created':
        console.log('Order created:', payload.data)
        break

      case 'subscription.created':
        console.log('Subscription created:', payload.data)
        break
    }
  }
}))
```

**2. Advanced Webhook Handlers**

```typescript
app.post('/webhooks/polar', Webhooks({
  webhookSecret: config.webhookSecret!,

  // Specific event handlers
  onCheckoutCreated: async (payload) => {
    console.log('Checkout created:', payload.data.id)
  },

  onCheckoutUpdated: async (payload) => {
    console.log('Checkout updated:', payload.data.status)
  },

  onOrderCreated: async (payload) => {
    const { order, customer } = payload.data

    // Update your database
    await db.insert(orders).values({
      polarOrderId: order.id,
      customerId: customer.id,
      amount: order.amount,
      status: 'completed'
    })

    // Send confirmation email
    await sendOrderConfirmation(customer.email, order)
  },

  onSubscriptionCreated: async (payload) => {
    const { subscription, customer } = payload.data

    // Update user subscription tier
    await db.update(users)
      .set({
        subscriptionTier: subscription.productId,
        subscriptionStatus: subscription.status,
        polarCustomerId: customer.id,
        subscriptionId: subscription.id
      })
      .where(eq(users.email, customer.email))
  },

  onSubscriptionUpdated: async (payload) => {
    const { subscription } = payload.data

    await db.update(users)
      .set({
        subscriptionStatus: subscription.status,
        subscriptionEndsAt: subscription.currentPeriodEnd
      })
      .where(eq(users.subscriptionId, subscription.id))
  },

  onSubscriptionCanceled: async (payload) => {
    const { subscription } = payload.data

    // Downgrade to free tier at end of billing period
    await db.update(users)
      .set({
        subscriptionStatus: 'canceled',
        subscriptionEndsAt: subscription.currentPeriodEnd
      })
      .where(eq(users.subscriptionId, subscription.id))
  },

  onBenefitGranted: async (payload) => {
    console.log('Benefit granted:', payload.data.benefit)
  },

  onBenefitRevoked: async (payload) => {
    console.log('Benefit revoked:', payload.data.benefit)
  }
}))
```

#### Available Webhook Events

The Hono adapter supports **25+ webhook event handlers**:

**Checkout Events:**
- `onCheckoutCreated`
- `onCheckoutUpdated`
- `onCheckoutSucceeded`

**Order Events:**
- `onOrderCreated`
- `onOrderUpdated`

**Subscription Events:**
- `onSubscriptionCreated`
- `onSubscriptionUpdated`
- `onSubscriptionCanceled`
- `onSubscriptionRevoked`

**Product Events:**
- `onProductCreated`
- `onProductUpdated`

**Benefit Events:**
- `onBenefitCreated`
- `onBenefitUpdated`
- `onBenefitGranted`
- `onBenefitRevoked`

**Customer Events:**
- `onCustomerCreated`
- `onCustomerUpdated`
- `onCustomerStateChanged`

**Organization Events:**
- `onOrganizationUpdated`

And more...

#### Complete Mirai MVP Integration Example

```typescript
// apps/workers/api-gateway/src/index.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { auth } from './auth'
import { Checkout, CustomerPortal, Webhooks } from '@polar-sh/hono'
import { db } from '@mirai/database-schema'
import { users, subscriptions, orders } from '@mirai/database-schema/schema'
import { eq } from 'drizzle-orm'

type Env = {
  DB: D1Database
  POLAR_ACCESS_TOKEN: string
  POLAR_WEBHOOK_SECRET: string
  APP_URL: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

// Better Auth routes
app.all('/api/auth/*', async (c) => {
  return auth.handler(c.req.raw)
})

// Checkout route with tier mapping
app.get('/api/checkout/:tier', async (c) => {
  const tier = c.req.param('tier')

  const productMap = {
    pro: c.env.POLAR_PRO_PRODUCT_ID,
    enterprise: c.env.POLAR_ENTERPRISE_PRODUCT_ID
  }

  const productId = productMap[tier]
  if (!productId) {
    return c.json({ error: 'Invalid tier' }, 400)
  }

  // Get current user
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const polar = new Polar({
    accessToken: c.env.POLAR_ACCESS_TOKEN,
    server: 'production'
  })

  const checkout = await polar.checkouts.create({
    productId,
    customerEmail: session.user.email,
    metadata: {
      userId: session.user.id
    },
    successUrl: `${c.env.APP_URL}/dashboard?upgraded=true`,
    cancelUrl: `${c.env.APP_URL}/pricing`
  })

  return c.json({ checkoutUrl: checkout.url })
})

// Customer portal
app.get('/api/portal', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id)
  })

  if (!user?.polarCustomerId) {
    return c.json({ error: 'No subscription' }, 404)
  }

  const polar = new Polar({
    accessToken: c.env.POLAR_ACCESS_TOKEN,
    server: 'production'
  })

  const portal = await polar.customerSessions.create({
    customerId: user.polarCustomerId
  })

  return c.json({ portalUrl: portal.customerPortalUrl })
})

// Webhook handler
app.post('/api/webhooks/polar', Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    const { subscription, customer } = payload.data

    await db.insert(subscriptions).values({
      id: subscription.id,
      userId: customer.metadata?.userId,
      polarCustomerId: customer.id,
      productId: subscription.productId,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.currentPeriodStart),
      currentPeriodEnd: new Date(subscription.currentPeriodEnd)
    })

    await db.update(users)
      .set({
        subscriptionTier: subscription.productId,
        subscriptionStatus: subscription.status,
        polarCustomerId: customer.id
      })
      .where(eq(users.id, customer.metadata?.userId))
  },

  onSubscriptionUpdated: async (payload) => {
    const { subscription } = payload.data

    await db.update(subscriptions)
      .set({
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.currentPeriodEnd)
      })
      .where(eq(subscriptions.id, subscription.id))
  },

  onSubscriptionCanceled: async (payload) => {
    const { subscription } = payload.data

    await db.update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date()
      })
      .where(eq(subscriptions.id, subscription.id))
  },

  onOrderCreated: async (payload) => {
    const { order, customer } = payload.data

    await db.insert(orders).values({
      id: order.id,
      polarCustomerId: customer.id,
      amount: order.amount,
      currency: order.currency,
      status: 'completed',
      createdAt: new Date(order.createdAt)
    })
  }
}))

export default app
```

---

## Features

### Trials

#### Overview

Trials allow customers to experience your product for a set period before committing to a subscription. No payment is charged during the trial period.

#### Trial Configuration

Trials can be configured in **three locations**:

1. **Product Settings**: When creating/editing a product
2. **Checkout Links**: When creating/editing a checkout link
3. **Checkout Session API**: When creating a checkout programmatically

**Priority**: Checkout-level trial settings **override** product-level trial settings.

#### Trial Parameters

**Unit Options:**
- Day
- Week
- Month
- Year

**Duration**: Number of units (e.g., "7 days", "1 month")

#### Trial Setup Examples

**1. Product-Level Trial**

```typescript
// Via Polar Dashboard
// Product → Edit → Trial Period
// Set: 7 days trial
```

**2. Checkout Link Trial**

```typescript
// Via Polar Dashboard
// Products → Checkout Links → Create
// Override product trial with custom duration
```

**3. API-Level Trial**

```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  trial: {
    duration: 14,
    unit: 'day'
  },
  successUrl: 'https://yourdomain.com/success'
})
```

#### Trial Process Flow

1. **Customer Enters Checkout**
   - Sees trial offer
   - Provides payment information
   - No charge yet

2. **Trial Begins**
   - Customer gets immediate access
   - Subscription status: `trialing`
   - Access to all benefits

3. **During Trial**
   - Customer can cancel anytime
   - No charge if canceled during trial
   - Full product access

4. **Trial Ends**
   - **If Not Canceled**: Automatic billing begins
   - **If Canceled**: No charge, access revoked
   - Subscription status changes to `active`

#### Managing Active Trials

**Via Dashboard:**
1. Navigate to Sales → Subscriptions
2. Select subscription with trial
3. Options available:
   - **Extend Trial**: Add more trial days
   - **End Trial**: Immediately activate subscription
   - **Cancel**: End subscription

**Extending Trial:**
- Changes status back to `trialing`
- Adds specified number of days

**Ending Trial:**
- Immediately activates subscription
- Triggers first payment
- Status changes to `active`

#### API Management

**Check Trial Status:**
```typescript
const subscription = await polar.subscriptions.get({
  id: 'sub_xxxxxxxxxxxxx'
})

if (subscription.status === 'trialing') {
  console.log('Trial ends:', subscription.trialEnd)
}
```

**Extend Trial:**
```typescript
const subscription = await polar.subscriptions.update({
  id: 'sub_xxxxxxxxxxxxx',
  trialEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // +7 days
})
```

#### Best Practices

1. **Optimal Trial Length**:
   - 7 days: Good for simple products
   - 14 days: Standard for SaaS
   - 30 days: Complex enterprise products

2. **Trial Communication**:
   - Email 3 days before trial ends
   - Email 1 day before trial ends
   - Clear cancellation instructions

3. **Trial Experience**:
   - Give full access during trial
   - Don't require credit card (optional)
   - Make cancellation easy

4. **Trial Analytics**:
   - Track trial → paid conversion rate
   - Monitor trial cancellation reasons
   - Optimize trial length based on data

#### Trial States

```typescript
type SubscriptionStatus =
  | 'trialing'      // During trial period
  | 'active'        // After trial, paying
  | 'canceled'      // Canceled during/after trial
  | 'past_due'      // Payment failed
  | 'incomplete'    // Setup incomplete
```

---

### Custom Fields

#### Overview

Custom Fields allow you to collect additional information from customers during checkout. They're managed at the organization level and can be added to specific products.

#### Field Types

##### 1. Text
- **Input**: Text input or textarea
- **Validation**: Min/max length
- **Storage**: String

**Example Use Cases:**
- Company name
- Referral source
- Special instructions

##### 2. Number
- **Input**: Number field
- **Validation**: Min/max value
- **Storage**: Number

**Example Use Cases:**
- Team size
- Number of users
- Quantity

##### 3. Date
- **Input**: Date picker
- **Validation**: Min/max date
- **Storage**: ISO 8601 string

**Example Use Cases:**
- Start date
- Birthdate
- Project deadline

##### 4. Checkbox
- **Input**: Boolean checkbox
- **Storage**: true/false

**Example Use Cases:**
- Terms acceptance
- Newsletter opt-in
- Feature preferences

##### 5. Select
- **Input**: Dropdown menu
- **Options**: Predefined list
- **Storage**: Selected value

**Example Use Cases:**
- Industry selection
- Use case
- Preferred contact method

#### Configuration Options

**Required Settings:**
- **Slug**: Unique identifier for API/data storage
- **Label**: Display name for customers
- **Type**: Field type (text, number, date, checkbox, select)

**Optional Settings:**
- **Help Text**: Additional context for customers
- **Placeholder**: Example value
- **Required**: Make field mandatory
- **Validation**: Min/max constraints
- **Markdown**: Rich formatting in labels

#### Creating Custom Fields

**Via Dashboard:**

1. Navigate to Settings → Custom Fields
2. Click "Create Custom Field"
3. Configure field:
   ```
   Slug: company_name
   Label: Company Name
   Type: Text
   Required: Yes
   Placeholder: Acme Inc.
   Help Text: We'll use this for your invoices
   ```
4. Save field
5. Add to products in Product settings

**Example Configuration:**

```typescript
// Field 1: Company Name
{
  slug: "company_name",
  label: "Company Name",
  type: "text",
  required: true,
  minLength: 2,
  maxLength: 100,
  placeholder: "Acme Inc."
}

// Field 2: Team Size
{
  slug: "team_size",
  label: "How many team members?",
  type: "number",
  required: false,
  min: 1,
  max: 1000
}

// Field 3: Terms
{
  slug: "terms_accepted",
  label: "I agree to the [terms of service](https://example.com/terms)",
  type: "checkbox",
  required: true
}

// Field 4: Industry
{
  slug: "industry",
  label: "Industry",
  type: "select",
  options: ["Technology", "Healthcare", "Finance", "Education", "Other"],
  required: true
}
```

#### Adding Fields to Products

1. Edit product
2. Scroll to "Checkout Fields" section
3. Select custom fields to include
4. Order fields by drag-and-drop
5. Save product

#### Accessing Custom Field Data

**Via Dashboard:**
- Sales page → Click order
- View "Custom Fields" section
- See all submitted values

**Via API:**

```typescript
const order = await polar.orders.get({
  id: 'ord_xxxxxxxxxxxxx'
})

console.log(order.customFieldValues)
// {
//   company_name: "Acme Inc.",
//   team_size: 50,
//   terms_accepted: true,
//   industry: "Technology"
// }
```

**Via Webhook:**

```typescript
app.post('/webhooks/polar', Webhooks({
  webhookSecret: config.webhookSecret,

  onOrderCreated: async (payload) => {
    const { order } = payload.data

    // Access custom fields
    const companyName = order.customFieldValues.company_name
    const teamSize = order.customFieldValues.team_size

    console.log(`New order from ${companyName} (${teamSize} users)`)
  }
}))
```

#### Use Cases for Mirai MVP

**1. User Preferences**
```typescript
{
  slug: "preferred_voice_model",
  label: "Preferred Voice Model",
  type: "select",
  options: ["Natural", "Professional", "Casual"],
  required: false
}
```

**2. Usage Intent**
```typescript
{
  slug: "use_case",
  label: "What will you use Mirai for?",
  type: "select",
  options: [
    "Personal companion",
    "Character creation",
    "Gaming",
    "Education",
    "Other"
  ]
}
```

**3. Referral Tracking**
```typescript
{
  slug: "referral_source",
  label: "How did you hear about us?",
  type: "text",
  required: false,
  placeholder: "e.g., Twitter, Reddit, friend"
}
```

#### Best Practices

1. **Minimize Required Fields**: Only require essential information
2. **Clear Labels**: Use descriptive, customer-friendly labels
3. **Help Text**: Provide context for complex fields
4. **Validation**: Set appropriate min/max constraints
5. **Default Values**: Use sensible defaults when possible
6. **Privacy**: Only collect data you actually need

---

### Discounts

#### Overview

Discounts allow you to reduce prices on products and subscriptions to incentivize purchases, reward loyalty, or run promotions.

#### Discount Types

##### 1. Percentage Discount
- **Format**: X% off
- **Example**: 20% off
- **Use Cases**: Sales events, referrals

##### 2. Fixed Amount Discount
- **Format**: $X off
- **Example**: $10 off
- **Use Cases**: First-time customer offers

##### 3. Recurring Discount
- **Duration Options**:
  - **Once**: First payment only
  - **Several Months**: X months
  - **Forever**: Every payment

**Example**: 50% off for 3 months

#### Creating Discounts

**Via Dashboard:**

1. Navigate to Products → Discounts
2. Click "Create Discount"
3. Configure discount settings

#### Discount Configuration

**Basic Settings:**

```typescript
{
  name: "Summer Sale 2025",           // Customer-facing name
  code: "SUMMER2025",                 // Optional discount code
  type: "percentage",                 // or "fixed_amount"
  amount: 20,                         // 20% or $20
  duration: "forever"                 // "once", "repeating", "forever"
}
```

**Advanced Settings:**

```typescript
{
  // Product Restrictions
  products: ["prod_xxx", "prod_yyy"], // Specific products only

  // Date Restrictions
  startsAt: "2025-06-01T00:00:00Z",  // Start date
  endsAt: "2025-08-31T23:59:59Z",    // End date

  // Usage Restrictions
  maxRedemptions: 100,                // Limit total uses
  maxRedemptionsPerCustomer: 1        // Limit per customer
}
```

#### Discount Code vs No Code

**With Code:**
- Customer must enter code at checkout
- Used for referral programs, promotions
- Code is case-insensitive

**Without Code:**
- Applied automatically via link or API
- Used for exclusive offers, cart links
- No customer input required

#### Applying Discounts

##### 1. Via Checkout Link

```
https://polar.sh/org/checkout?products=prod_xxx&discount_code=SUMMER2025
```

##### 2. Via Checkout Session API

```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  discountCode: 'SUMMER2025',
  successUrl: 'https://yourdomain.com/success'
})
```

##### 3. Customer Enters Code

Enable discount code input at checkout:
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  allowDiscountCodes: true, // Show discount code field
  successUrl: 'https://yourdomain.com/success'
})
```

#### Discount Duration Examples

**Once (First Payment):**
```typescript
{
  type: "percentage",
  amount: 50,
  duration: "once",
  durationMonths: null
}
// $20/mo subscription → $10 first month, then $20/mo
```

**Several Months:**
```typescript
{
  type: "percentage",
  amount: 30,
  duration: "repeating",
  durationMonths: 3
}
// $20/mo subscription → $14/mo for 3 months, then $20/mo
```

**Forever:**
```typescript
{
  type: "fixed_amount",
  amount: 500, // $5 in cents
  duration: "forever"
}
// $20/mo subscription → $15/mo forever
```

#### Monitoring Discount Usage

**Via Dashboard:**
- Products → Discounts → Select discount
- View redemption count
- See customer list
- Track revenue impact

**Via API:**
```typescript
const discount = await polar.discounts.get({
  id: 'discount_xxxxxxxxxxxxx'
})

console.log('Redemptions:', discount.redemptionsCount)
console.log('Max redemptions:', discount.maxRedemptions)
console.log('Remaining:', discount.maxRedemptions - discount.redemptionsCount)
```

#### Discount Strategies for Mirai MVP

**1. Launch Offer**
```typescript
{
  name: "Early Bird Pricing",
  code: "EARLYBIRD",
  type: "percentage",
  amount: 30,
  duration: "forever",
  maxRedemptions: 100
}
```

**2. Referral Program**
```typescript
{
  name: "Friend Referral",
  code: null, // No code, use referral link
  type: "fixed_amount",
  amount: 1000, // $10 off
  duration: "once",
  maxRedemptionsPerCustomer: 1
}
```

**3. Seasonal Promotion**
```typescript
{
  name: "Holiday Sale",
  code: "HOLIDAY2025",
  type: "percentage",
  amount: 25,
  duration: "repeating",
  durationMonths: 3,
  startsAt: "2025-12-01T00:00:00Z",
  endsAt: "2025-12-31T23:59:59Z"
}
```

**4. Student Discount**
```typescript
{
  name: "Student Pricing",
  code: "STUDENT",
  type: "percentage",
  amount: 50,
  duration: "forever",
  products: ["prod_pro"] // Only Pro tier
}
```

#### Best Practices

1. **Clear Terms**: Communicate duration and restrictions clearly
2. **Expiration Dates**: Create urgency with time limits
3. **Limit Redemptions**: Prevent abuse with redemption limits
4. **Track Performance**: Monitor discount ROI
5. **Test Codes**: Verify codes work before sharing
6. **Unique Codes**: Use unique codes for different campaigns

---

### Orders & Subscriptions

#### Overview

The Orders & Subscriptions section provides comprehensive management of all sales transactions, including one-time purchases and recurring subscriptions.

#### Main Sections

##### 1. Sales View

**Features:**
- Paginated list of all sales
- Filter by date range
- Search by customer
- Export to CSV

**Information Displayed:**
- Order/Subscription ID
- Customer name and email
- Product purchased
- Amount and currency
- Payment status
- Date created

##### 2. Order Details

**Metadata Includes:**

**Financial Information:**
- Subtotal amount
- Tax amount
- Total amount
- Currency

**Customer Information:**
- Name
- Email
- Billing address
- Customer metadata

**Order Information:**
- Order ID
- Status
- Created date
- Invoice link
- Receipt link

**Product Information:**
- Product name
- Pricing details
- Benefits granted

**Past Order History:**
- Previous purchases from customer
- Subscription history
- Total lifetime value

##### 3. Subscription Details

**Subscription Metadata:**
- Subscription ID
- Status (active, trialing, canceled, past_due)
- Product/Plan name
- Billing cycle (monthly, yearly)
- Current period start/end dates
- Next billing date
- Amount

**Management Actions:**
- Cancel subscription
- Update subscription
- Extend trial
- View payment history
- Issue refunds

##### 4. Checkouts Section

**Overview:**
- All checkout sessions
- Filterable by:
  - Customer email
  - Status
  - Product

**Checkout States:**

| State | Description |
|-------|-------------|
| **Open** | Waiting for customer to complete payment |
| **Confirmed** | Payment is processing |
| **Succeeded** | Payment completed, order created |
| **Expired** | Checkout session no longer valid |

**Checkout Details:**

For each checkout session:
- Checkout ID
- Created date
- Expiration date
- Products in cart
- Customer email (if provided)
- Payment attempts
- Failure/decline reasons

**Payment Attempt Information:**
- Timestamp
- Payment method
- Status
- Error message (if failed)
- Decline reason
- Suggested customer action

#### API Access

**Get Order:**
```typescript
const order = await polar.orders.get({
  id: 'ord_xxxxxxxxxxxxx'
})

console.log(order.amount)
console.log(order.customFieldValues)
console.log(order.customer)
```

**List Orders:**
```typescript
const orders = await polar.orders.list({
  page: 1,
  limit: 10,
  customerId: 'cus_xxxxxxxxxxxxx' // Optional filter
})

orders.items.forEach(order => {
  console.log(`Order ${order.id}: $${order.amount / 100}`)
})
```

**Get Subscription:**
```typescript
const subscription = await polar.subscriptions.get({
  id: 'sub_xxxxxxxxxxxxx'
})

console.log('Status:', subscription.status)
console.log('Next billing:', subscription.currentPeriodEnd)
```

**List Subscriptions:**
```typescript
const subscriptions = await polar.subscriptions.list({
  customerId: 'cus_xxxxxxxxxxxxx',
  status: 'active'
})
```

#### Webhook Events

**Order Events:**
```typescript
onOrderCreated: async (payload) => {
  const { order, customer } = payload.data
  console.log(`New order: ${order.id} from ${customer.email}`)
}
```

**Subscription Events:**
```typescript
onSubscriptionCreated: async (payload) => {
  const { subscription } = payload.data
  console.log('New subscription:', subscription.id)
}

onSubscriptionUpdated: async (payload) => {
  const { subscription } = payload.data
  console.log('Subscription updated:', subscription.status)
}

onSubscriptionCanceled: async (payload) => {
  console.log('Subscription canceled')
}
```

#### Dashboard Insights

The dashboard provides:
- Total sales revenue
- Active subscriptions count
- Monthly Recurring Revenue (MRR)
- Successful checkouts
- Failed payments
- Customer lifetime value
- Churn rate

#### Integration with Mirai MVP

**Sync Orders to D1:**
```typescript
onOrderCreated: async (payload) => {
  const { order, customer } = payload.data

  await db.insert(orders).values({
    id: order.id,
    userId: customer.metadata?.userId,
    polarCustomerId: customer.id,
    amount: order.amount,
    currency: order.currency,
    status: 'completed',
    productId: order.productId,
    createdAt: new Date(order.createdAt)
  })
}
```

**Sync Subscriptions to D1:**
```typescript
onSubscriptionCreated: async (payload) => {
  const { subscription, customer } = payload.data

  await db.insert(subscriptions).values({
    id: subscription.id,
    userId: customer.metadata?.userId,
    polarCustomerId: customer.id,
    productId: subscription.productId,
    status: subscription.status,
    currentPeriodStart: new Date(subscription.currentPeriodStart),
    currentPeriodEnd: new Date(subscription.currentPeriodEnd),
    createdAt: new Date(subscription.createdAt)
  })
}
```

---

### Refunds

#### Overview

Polar allows merchants to issue both full and partial refunds for orders. Refunds help maintain customer satisfaction and reduce chargebacks.

#### Important Policies

⚠️ **Merchant Control with Override:**
- You have full control over refund policies
- Polar reserves the right to issue refunds within 60 days
- This helps reduce costly chargebacks
- Polar can override "no refund" policies if necessary

⚠️ **Non-Refundable Fees:**
- Payment processing fees are NOT refundable
- This is due to actual transaction costs incurred

#### Refund Process

**Via Dashboard:**

1. Navigate to Sales → Orders
2. Click on the order to refund
3. Scroll to "Refund" section
4. Click "Refund" button
5. Configure refund:
   - Amount (full or partial)
   - Reason (for tracking)
   - Revoke benefits (for one-time purchases)
6. Confirm refund

#### Refund Options

##### 1. Full Refund
- Refund entire order amount
- Customer receives full payment back
- Processing fees are not refunded

##### 2. Partial Refund
- Refund portion of order amount
- Specify exact amount to refund
- Useful for pro-rated refunds

#### Refund Configuration

**Refund Amount:**
```typescript
{
  amount: 2000, // $20 in cents
  // or
  amount: order.amount // Full refund
}
```

**Refund Reason:**
```typescript
{
  reason: "customer_request" | "duplicate" | "fraudulent" | "other"
}
```

**Revoke Benefits (One-Time Purchases):**
```typescript
{
  revokeBenefits: true // Revoke license keys, access, etc.
}
```

#### Subscription Refunds

**Important**: Refunding subscriptions requires additional steps:

1. **Cancel the subscription** first
2. **Then issue the refund** for the payment

**Process:**
1. Navigate to subscription
2. Click "Cancel Subscription"
3. Access is revoked after current period ends
4. Refund the last payment if needed

#### API Refund

```typescript
const refund = await polar.orders.refund({
  id: 'ord_xxxxxxxxxxxxx',
  amount: 2000, // Amount in cents
  reason: 'customer_request',
  revokeBenefits: true
})

console.log('Refund issued:', refund.id)
```

#### Webhook Event

```typescript
onOrderRefunded: async (payload) => {
  const { order, refund } = payload.data

  console.log(`Refund issued for order ${order.id}`)
  console.log(`Amount: $${refund.amount / 100}`)
  console.log(`Reason: ${refund.reason}`)

  // Update your database
  await db.update(orders)
    .set({
      refundedAt: new Date(),
      refundAmount: refund.amount,
      status: 'refunded'
    })
    .where(eq(orders.id, order.id))

  // Send refund confirmation email
  await sendEmail({
    to: order.customer.email,
    subject: 'Refund processed',
    template: 'refund-confirmation',
    data: { order, refund }
  })
}
```

#### Benefit Revocation

When issuing refunds for one-time purchases:

**If `revokeBenefits: true`:**
- License keys are revoked
- File download access removed
- GitHub repository access revoked
- Discord roles removed
- Custom benefit access revoked

**If `revokeBenefits: false`:**
- Customer keeps access to benefits
- Use this for goodwill refunds

#### Best Practices

1. **Clear Refund Policy**: Communicate your policy upfront
2. **Fast Processing**: Issue refunds quickly to prevent chargebacks
3. **Track Reasons**: Use refund reasons to identify issues
4. **Customer Communication**: Email customers about refund status
5. **Prevent Fraud**: Monitor refund patterns for abuse
6. **Pro-rated Refunds**: Consider partial refunds for subscriptions

#### Refund Timeline

**Processing Time:**
- Refund initiated: Immediate
- Polar processing: Within 24 hours
- Customer receives funds: 5-10 business days (depends on bank)

#### Refund Scenarios for Mirai MVP

**1. Accidental Purchase**
```typescript
await polar.orders.refund({
  id: order.id,
  amount: order.amount, // Full refund
  reason: 'duplicate',
  revokeBenefits: true
})
```

**2. Service Issue**
```typescript
await polar.orders.refund({
  id: order.id,
  amount: order.amount,
  reason: 'other',
  revokeBenefits: false // Let them keep access as goodwill
})
```

**3. Pro-rated Subscription Cancellation**
```typescript
// Calculate unused days
const daysUsed = Math.floor(
  (Date.now() - subscription.currentPeriodStart) / (1000 * 60 * 60 * 24)
)
const totalDays = Math.floor(
  (subscription.currentPeriodEnd - subscription.currentPeriodStart) / (1000 * 60 * 60 * 24)
)
const unusedAmount = (order.amount * (totalDays - daysUsed)) / totalDays

await polar.orders.refund({
  id: order.id,
  amount: Math.floor(unusedAmount),
  reason: 'customer_request'
})
```

---

### Analytics

#### Overview

Polar provides professional analytics dashboards out-of-the-box, allowing you to focus on increasing revenue rather than building analytics infrastructure.

#### Filtering Options

**Period:**
- Yearly
- Monthly
- Weekly
- Daily
- Hourly

**Timeframe:**
- Custom date range selector
- Compare periods
- Year-over-year comparison

**Product:**
- Filter by individual products
- Filter by subscription tier
- View all products combined

#### Metrics Tracked

##### Revenue Metrics

**1. Total Revenue**
- All revenue across time period
- Includes one-time and recurring
- Gross revenue before refunds

**2. Orders**
- Total number of orders
- One-time + subscription orders
- Successful payments only

**3. Average Order Value (AOV)**
- Total revenue / number of orders
- Helps optimize pricing strategy
- Track changes over time

**4. One-Time Product Sales**
- Count of one-time purchases
- Excludes subscriptions
- Track conversion rates

**5. One-Time Product Revenue**
- Revenue from one-time purchases only
- Excludes recurring revenue
- Useful for product mix analysis

##### Subscription Metrics

**1. New Subscriptions**
- Count of new subscriptions started
- Excludes renewals
- Growth metric

**2. New Subscription Revenue**
- MRR from new subscriptions
- First-time subscribers only
- Acquisition revenue

**3. Renewed Subscriptions**
- Count of subscription renewals
- Successful recurring payments
- Retention metric

**4. Renewed Subscription Revenue**
- MRR from renewals
- Retention revenue
- Stability indicator

**5. Active Subscriptions**
- Current active subscription count
- Includes trialing subscriptions
- Real-time metric

**6. Monthly Recurring Revenue (MRR)**
- Normalized monthly revenue from subscriptions
- Yearly subscriptions normalized to monthly
- Key SaaS metric

##### Checkout Metrics

**1. Total Checkouts**
- All checkout sessions created
- Includes successful and failed
- Funnel top metric

**2. Succeeded Checkouts**
- Completed purchases
- Successful payments only
- Funnel bottom metric

**3. Checkout Conversion Rate**
- (Succeeded / Total) × 100
- Key optimization metric
- Industry benchmark: 2-5%

#### Dashboard Views

**Light Mode:**
- Clean, professional design
- Easy to read charts
- Export-ready visuals

**Dark Mode:**
- Reduce eye strain
- Modern interface
- Developer-friendly

#### Requesting Additional Metrics

Polar accepts metric requests via:
- GitHub Discussions
- Feature requests
- Community voting

**Example Custom Metrics:**
- Customer Lifetime Value (LTV)
- Churn rate
- Net Revenue Retention (NRR)
- Customer Acquisition Cost (CAC)

#### API Access to Analytics

While Polar provides visual dashboards, you can also access raw data via API:

```typescript
// Get orders for custom analysis
const orders = await polar.orders.list({
  startDate: '2025-01-01',
  endDate: '2025-01-31'
})

// Calculate custom metrics
const totalRevenue = orders.items.reduce(
  (sum, order) => sum + order.amount, 0
)

const avgOrderValue = totalRevenue / orders.items.length
```

#### Key Metrics for SaaS (Mirai MVP)

**Growth Metrics:**
- MRR growth rate
- New subscriptions per month
- Customer acquisition rate

**Retention Metrics:**
- Churn rate
- Revenue retention
- Subscription renewal rate

**Revenue Metrics:**
- Total MRR
- Average Revenue Per User (ARPU)
- Expansion revenue

**Conversion Metrics:**
- Checkout conversion rate
- Trial-to-paid conversion
- Upsell rate

#### Best Practices

1. **Daily Monitoring**: Check metrics daily for anomalies
2. **Weekly Reviews**: Deep dive into trends weekly
3. **Monthly Planning**: Use monthly data for strategic decisions
4. **Compare Periods**: Always compare to previous periods
5. **Track Cohorts**: Monitor user cohorts over time
6. **Set Goals**: Define target metrics and track progress

#### Analytics Integration with Mirai MVP

**Export to Your Database:**
```typescript
// Daily sync of analytics
async function syncAnalytics() {
  const today = new Date()
  const startDate = new Date(today.setDate(today.getDate() - 1))

  const orders = await polar.orders.list({
    startDate: startDate.toISOString()
  })

  const subscriptions = await polar.subscriptions.list({
    status: 'active'
  })

  // Store in your D1 database for custom reporting
  await db.insert(dailyMetrics).values({
    date: startDate,
    revenue: orders.items.reduce((sum, o) => sum + o.amount, 0),
    orders: orders.items.length,
    activeSubscriptions: subscriptions.items.length,
    mrr: subscriptions.items.reduce((sum, s) => sum + s.recurringAmount, 0)
  })
}
```

**Custom Dashboard:**
Build your own dashboard using Polar data:
- Real-time metrics
- Custom calculations
- Integration with other services (Inworld usage, etc.)
- User-specific analytics

---

### Customer Management

#### Overview

Customer Management in Polar tracks everyone who has purchased from your organization, providing comprehensive insights into customers, sales, and ongoing subscriptions.

#### Customer Dashboard

**Features:**
- View all customers
- Search by name or email
- Filter by status
- See customer lifetime value
- Access customer history

**Customer List Displays:**
- Customer name
- Email address
- Total orders
- Total revenue
- Active subscriptions
- Sign-up date
- Last purchase date

#### Customer Details

Click on a customer to view:

**Profile Information:**
- Name
- Email
- Customer ID
- External ID (if set)
- Metadata
- Created date

**Purchase History:**
- All orders (one-time + subscriptions)
- Order amounts
- Products purchased
- Order dates
- Payment status

**Active Subscriptions:**
- Subscription ID
- Product/Plan
- Status
- Billing cycle
- Next billing date
- Amount

**Benefits:**
- Active benefits
- Benefit types
- Access status

#### External ID Integration

The External ID feature is crucial for integrating Polar with your own user management system.

**Purpose:**
- Map Polar customers to your users
- Enable cross-platform customer identification
- Simplify API queries

**Setting External ID:**

**1. During Checkout:**
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  customerEmail: 'user@example.com',
  metadata: {
    externalId: 'your_user_id_12345'
  }
})
```

**2. Via API:**
```typescript
const customer = await polar.customers.create({
  email: 'user@example.com',
  name: 'John Doe',
  externalId: 'your_user_id_12345'
})
```

**3. Update Existing Customer:**
```typescript
await polar.customers.update({
  id: 'cus_xxxxxxxxxxxxx',
  externalId: 'your_user_id_12345'
})
```

#### External ID API Methods

**Get Customer by External ID:**
```typescript
const customer = await polar.customers.getByExternalId({
  externalCustomerId: 'your_user_id_12345'
})

console.log(customer.email)
console.log(customer.subscriptions)
```

**Update Customer by External ID:**
```typescript
await polar.customers.updateByExternalId({
  externalCustomerId: 'your_user_id_12345',
  name: 'Updated Name',
  metadata: {
    tier: 'premium'
  }
})
```

**Delete Customer by External ID:**
```typescript
await polar.customers.deleteByExternalId({
  externalCustomerId: 'your_user_id_12345'
})
```

#### Customer Metadata

Metadata allows you to store additional custom data on customers.

**Setting Metadata:**

**1. Via Dashboard:**
- Customer Details → Edit Customer
- Add key-value pairs
- Save changes

**2. Via API:**
```typescript
await polar.customers.update({
  id: 'cus_xxxxxxxxxxxxx',
  metadata: {
    accountType: 'enterprise',
    referralSource: 'twitter',
    customNote: 'VIP customer',
    internalId: '12345'
  }
})
```

**3. During Checkout:**
```typescript
const checkout = await polar.checkouts.create({
  productId: 'prod_xxxxxxxxxxxxx',
  customerEmail: 'user@example.com',
  metadata: {
    campaignId: 'launch_2025',
    referrer: 'friend_12345'
  }
})
```

**Accessing Metadata:**
```typescript
const customer = await polar.customers.get({
  id: 'cus_xxxxxxxxxxxxx'
})

console.log(customer.metadata.accountType) // 'enterprise'
console.log(customer.metadata.referralSource) // 'twitter'
```

**Via Webhooks:**
```typescript
onCustomerUpdated: async (payload) => {
  const { customer } = payload.data
  console.log('Customer metadata:', customer.metadata)
}
```

#### Customer State Integration

See [Customer State](#customer-state) section for comprehensive customer information retrieval.

#### Integration with Mirai MVP

**Sync Customers to D1:**

```typescript
// When user signs up in your app
async function createUserWithPolar(userData) {
  // 1. Create user in your database
  const user = await db.insert(users).values({
    id: generateId(),
    email: userData.email,
    name: userData.name,
    createdAt: new Date()
  }).returning()

  // 2. Create Polar customer with external ID
  const polarCustomer = await polar.customers.create({
    email: user.email,
    name: user.name,
    externalId: user.id, // Your user ID
    metadata: {
      signupSource: userData.signupSource,
      plan: 'free'
    }
  })

  // 3. Update user with Polar customer ID
  await db.update(users)
    .set({ polarCustomerId: polarCustomer.id })
    .where(eq(users.id, user.id))

  return user
}
```

**Access Control Based on Customer State:**

```typescript
async function checkUserAccess(userId: string) {
  // Get customer state using external ID
  const customerState = await polar.customers.getByExternalId({
    externalCustomerId: userId
  })

  // Check for active subscription
  const hasActiveSubscription = customerState.subscriptions.some(
    sub => sub.status === 'active' || sub.status === 'trialing'
  )

  // Get subscription tier
  const subscription = customerState.subscriptions[0]
  const tier = subscription?.productId || 'free'

  // Check specific benefits
  const hasLicenseKey = customerState.benefits.some(
    benefit => benefit.type === 'license_key'
  )

  return {
    hasAccess: hasActiveSubscription,
    tier,
    benefits: customerState.benefits,
    usage: customerState.meters
  }
}
```

**Webhook Sync:**

```typescript
onCustomerCreated: async (payload) => {
  const { customer } = payload.data

  // Sync to your database
  await db.insert(customers).values({
    polarCustomerId: customer.id,
    userId: customer.externalId,
    email: customer.email,
    name: customer.name,
    metadata: customer.metadata,
    createdAt: new Date(customer.createdAt)
  })
}

onCustomerUpdated: async (payload) => {
  const { customer } = payload.data

  await db.update(customers)
    .set({
      email: customer.email,
      name: customer.name,
      metadata: customer.metadata,
      updatedAt: new Date()
    })
    .where(eq(customers.polarCustomerId, customer.id))
}
```

#### Best Practices

1. **Always Use External ID**: Map Polar customers to your users
2. **Sync Metadata**: Keep customer data synchronized
3. **Handle Webhooks**: Listen to customer state changes
4. **Cache Customer State**: Store in your DB, update via webhooks
5. **Graceful Deletion**: Handle customer deletion carefully

---

### Customer Portal

#### Overview

The Customer Portal enables customers to self-manage their orders and subscriptions without contacting support. It's a fully-managed interface provided by Polar.

#### Portal URL

**Direct Access:**
```
https://polar.sh/{your-org-slug}/portal
```

**Example:**
```
https://polar.sh/mirai/portal
```

#### Authentication Methods

##### 1. Email Authentication (Standard)

Customers sign in using their purchase email:

1. Visit portal URL
2. Enter email address
3. Receive magic link
4. Click link to access portal

**Flow:**
```
Customer → Enter Email → Receive Magic Link → Access Portal
```

##### 2. Pre-authenticated Links (API)

Generate authenticated portal links programmatically for seamless access.

**Benefits:**
- No email step required
- Instant access
- Better user experience
- Integration with your auth system

#### Creating Pre-authenticated Portal Links

**TypeScript SDK:**
```typescript
import { Polar } from '@polar-sh/sdk'

const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!
})

// Create customer portal session
const portalSession = await polar.customerSessions.create({
  customerId: 'cus_xxxxxxxxxxxxx'
})

// Redirect customer to portal
const portalUrl = portalSession.customerPortalUrl
console.log('Portal URL:', portalUrl)
```

**Next.js Utility Method:**
```typescript
import { CustomerPortal } from "@polar-sh/nextjs"

export const GET = CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,

  // Function to get customer ID from request
  getCustomerId: async (req) => {
    // Get user from your auth system
    const session = await getSession(req)

    // Return Polar customer ID
    return session.user.polarCustomerId
  },

  server: 'production' // or 'sandbox'
})

// Usage: GET /api/portal → Redirects to Polar portal
```

**Hono Middleware:**
```typescript
import { Hono } from 'hono'
import { CustomerPortal } from '@polar-sh/hono'
import { auth } from './auth'

const app = new Hono()

app.get('/api/portal', CustomerPortal({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: 'production',

  getCustomerId: async (event) => {
    // Get user from Better Auth
    const session = await auth.api.getSession({
      headers: event.req.raw.headers
    })

    if (!session) {
      throw new Error('Unauthorized')
    }

    // Get user from database
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id)
    })

    return user?.polarCustomerId || ''
  }
}))
```

#### Portal Capabilities

Customers can:

**View Orders:**
- Order history
- Order details
- Download receipts
- View invoices

**Manage Subscriptions:**
- View active subscriptions
- Cancel subscriptions
- Update payment method
- Change billing cycle
- View upcoming charges

**Access Benefits:**
- View granted benefits
- Download license keys
- Access file downloads
- View GitHub repo access
- See Discord invitations

**Update Profile:**
- Change email address
- Update billing information
- Manage payment methods

**Download Invoices:**
- Access all invoices
- Download PDF receipts
- View payment history

#### Integration Examples

**React Component:**
```typescript
import { useState } from 'react'

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)

  async function openPortal() {
    setLoading(true)

    try {
      // Call your API endpoint
      const response = await fetch('/api/portal')
      const data = await response.json()

      // Open portal in new tab
      window.open(data.portalUrl, '_blank')
    } catch (error) {
      console.error('Failed to open portal:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button onClick={openPortal} disabled={loading}>
      {loading ? 'Loading...' : 'Manage Subscription'}
    </button>
  )
}
```

**Cloudflare Worker (Hono):**
```typescript
import { Hono } from 'hono'
import { Polar } from '@polar-sh/sdk'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/portal', async (c) => {
  // Authenticate user
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Get user's Polar customer ID
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id)
  })

  if (!user?.polarCustomerId) {
    return c.json({ error: 'No subscription found' }, 404)
  }

  // Create portal session
  const polar = new Polar({
    accessToken: c.env.POLAR_ACCESS_TOKEN
  })

  const portalSession = await polar.customerSessions.create({
    customerId: user.polarCustomerId
  })

  // Return portal URL or redirect
  return c.json({ portalUrl: portalSession.customerPortalUrl })
  // Or: return c.redirect(portalSession.customerPortalUrl)
})
```

#### Portal Session Security

**Session Expiration:**
- Portal sessions expire after a set time
- Requires re-authentication after expiration
- Prevents unauthorized access

**Security Best Practices:**
1. **Always Verify User**: Confirm user identity before generating portal link
2. **Use HTTPS**: Only generate portal links over secure connections
3. **Short-Lived Tokens**: Portal sessions should be short-lived
4. **Audit Logs**: Monitor portal access via webhooks

#### Webhook Events

Monitor portal usage:
```typescript
onCustomerPortalAccessed: async (payload) => {
  console.log('Customer accessed portal:', payload.data.customer.email)
}

onSubscriptionUpdated: async (payload) => {
  // Customer updated subscription in portal
  console.log('Subscription changed:', payload.data.subscription)
}

onPaymentMethodUpdated: async (payload) => {
  console.log('Payment method updated')
}
```

#### Mirai MVP Integration

**Dashboard Settings Page:**
```typescript
// apps/stage-web/src/pages/Settings.tsx
import { useSession } from '@/lib/auth-client'

export default function Settings() {
  const { data: session } = useSession()

  async function openPortal() {
    const response = await fetch('/api/portal')
    const data = await response.json()

    // Open in new tab
    window.open(data.portalUrl, '_blank')
  }

  return (
    <div>
      <h2>Subscription Management</h2>
      <p>Manage your subscription, view invoices, and update payment method</p>
      <button onClick={openPortal}>
        Manage Subscription
      </button>
    </div>
  )
}
```

**API Gateway Route:**
```typescript
// apps/workers/api-gateway/src/routes/portal.ts
app.get('/api/portal', async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const user = await c.env.DB.prepare(
    'SELECT polar_customer_id FROM user WHERE id = ?'
  ).bind(session.user.id).first()

  if (!user?.polar_customer_id) {
    return c.json({ error: 'No subscription' }, 404)
  }

  const polar = new Polar({
    accessToken: c.env.POLAR_ACCESS_TOKEN
  })

  const portal = await polar.customerSessions.create({
    customerId: user.polar_customer_id
  })

  return c.json({ portalUrl: portal.customerPortalUrl })
})
```

#### Benefits

✅ **Reduce Support Burden**: Customers self-manage subscriptions
✅ **Better UX**: Instant access without email verification
✅ **Branded Experience**: Portal matches your branding
✅ **Fully Managed**: No portal infrastructure to build
✅ **Secure**: Authenticated sessions with expiration

---

## Integration with Mirai MVP

### Project Context

**Mirai MVP Architecture:**
- Monorepo using **pnpm**
- Database: **Cloudflare D1** with **Drizzle ORM**
- Database schema: `packages/database-schema`
- API Gateway: **Hono** on Cloudflare Workers
- Authentication: **Better Auth**
- Frontend: **React** + **Vite** (Cloudflare Pages)

### Integration Strategy

#### 1. Environment Setup

```env
# Polar Configuration
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_ORGANIZATION_ID=your_org_id
POLAR_WEBHOOK_SECRET=your_webhook_secret

# Product IDs (from Polar Dashboard)
POLAR_FREE_PRODUCT_ID=prod_xxxxxxxxxxxxx
POLAR_PRO_PRODUCT_ID=prod_yyyyyyyyyyyyy
POLAR_ENTERPRISE_PRODUCT_ID=prod_zzzzzzzzzzzzz

# URLs
POLAR_SERVER=production # or 'sandbox' for testing
APP_URL=https://app.miraichat.app
API_URL=https://api.miraichat.app
```

#### 2. Database Schema Extensions

```typescript
// packages/database-schema/src/schema.ts
import { pgTable, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core'

// Extend Better Auth user table
export const user = pgTable('user', {
  // ... Better Auth fields
  polarCustomerId: text('polar_customer_id'),
  subscriptionTier: text('subscription_tier').default('free'),
  subscriptionStatus: text('subscription_status'),
  subscriptionEndsAt: timestamp('subscription_ends_at')
})

// Subscriptions table (synced from Polar)
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(), // Polar subscription ID
  userId: text('user_id').references(() => user.id),
  polarCustomerId: text('polar_customer_id').notNull(),
  productId: text('product_id').notNull(),
  priceId: text('price_id'),
  status: text('status').notNull(), // active, trialing, canceled, past_due
  currentPeriodStart: timestamp('current_period_start').notNull(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// Orders table (synced from Polar)
export const orders = pgTable('orders', {
  id: text('id').primaryKey(), // Polar order ID
  userId: text('user_id').references(() => user.id),
  polarCustomerId: text('polar_customer_id').notNull(),
  productId: text('product_id').notNull(),
  amount: integer('amount').notNull(), // in cents
  currency: text('currency').notNull(),
  status: text('status').notNull(),
  refundedAt: timestamp('refunded_at'),
  refundAmount: integer('refund_amount'),
  createdAt: timestamp('created_at').defaultNow()
})
```

#### 3. Polar SDK Setup

```typescript
// packages/polar-client/src/index.ts
import { Polar } from '@polar-sh/sdk'

export const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
  server: process.env.POLAR_SERVER === 'production' ? 'production' : 'sandbox'
})
```

#### 4. Better Auth Integration

```typescript
// apps/workers/api-gateway/src/auth.ts
import { betterAuth } from 'better-auth'
import { polar, checkout, portal, usage, webhooks } from '@polar-sh/better-auth'
import { polarClient } from '@mirai/polar-client'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { db } from '@mirai/database-schema'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite' // Cloudflare D1
  }),

  plugins: [
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,

      use: [
        checkout({
          organizationId: process.env.POLAR_ORGANIZATION_ID!,
          products: {
            free: process.env.POLAR_FREE_PRODUCT_ID!,
            pro: process.env.POLAR_PRO_PRODUCT_ID!,
            enterprise: process.env.POLAR_ENTERPRISE_PRODUCT_ID!
          }
        }),

        portal(),

        usage(),

        webhooks({
          secret: process.env.POLAR_WEBHOOK_SECRET!,

          onSubscriptionCreated: async (event) => {
            const { customer, subscription } = event.data

            await db.insert(subscriptions).values({
              id: subscription.id,
              userId: customer.externalId,
              polarCustomerId: customer.id,
              productId: subscription.productId,
              status: subscription.status,
              currentPeriodStart: new Date(subscription.currentPeriodStart),
              currentPeriodEnd: new Date(subscription.currentPeriodEnd)
            })

            await db.update(user)
              .set({
                subscriptionTier: subscription.productId,
                subscriptionStatus: subscription.status
              })
              .where(eq(user.id, customer.externalId))
          },

          onSubscriptionUpdated: async (event) => {
            const { subscription } = event.data

            await db.update(subscriptions)
              .set({
                status: subscription.status,
                currentPeriodEnd: new Date(subscription.currentPeriodEnd),
                updatedAt: new Date()
              })
              .where(eq(subscriptions.id, subscription.id))
          },

          onSubscriptionCanceled: async (event) => {
            const { subscription } = event.data

            await db.update(subscriptions)
              .set({
                status: 'canceled',
                cancelAtPeriodEnd: true,
                updatedAt: new Date()
              })
              .where(eq(subscriptions.id, subscription.id))
          }
        })
      ]
    })
  ]
})
```

#### 5. Hono Routes

```typescript
// apps/workers/api-gateway/src/index.ts
import { Hono } from 'hono'
import { Checkout, CustomerPortal, Webhooks } from '@polar-sh/hono'
import { auth } from './auth'
import { polarClient } from '@mirai/polar-client'

const app = new Hono<{ Bindings: Env }>()

// Checkout
app.get('/api/checkout/:tier', async (c) => {
  const tier = c.req.param('tier')
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })

  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const productMap = {
    pro: c.env.POLAR_PRO_PRODUCT_ID,
    enterprise: c.env.POLAR_ENTERPRISE_PRODUCT_ID
  }

  const productId = productMap[tier]
  if (!productId) {
    return c.json({ error: 'Invalid tier' }, 400)
  }

  const checkout = await polarClient.checkouts.create({
    productId,
    customerEmail: session.user.email,
    metadata: { userId: session.user.id },
    successUrl: `${c.env.APP_URL}/dashboard?upgraded=true`,
    cancelUrl: `${c.env.APP_URL}/pricing`
  })

  return c.json({ checkoutUrl: checkout.url })
})

// Customer Portal
app.get('/api/portal', CustomerPortal({
  accessToken: c.env.POLAR_ACCESS_TOKEN,
  server: 'production',

  getCustomerId: async (event) => {
    const session = await auth.api.getSession({
      headers: event.req.raw.headers
    })

    if (!session) throw new Error('Unauthorized')

    const user = await db.query.user.findFirst({
      where: eq(user.id, session.user.id)
    })

    return user?.polarCustomerId || ''
  }
}))

// Webhooks
app.post('/api/webhooks/polar', Webhooks({
  webhookSecret: c.env.POLAR_WEBHOOK_SECRET!,

  onSubscriptionCreated: async (payload) => {
    // Handled by Better Auth plugin
  },

  onOrderCreated: async (payload) => {
    const { order, customer } = payload.data

    await db.insert(orders).values({
      id: order.id,
      userId: customer.externalId,
      polarCustomerId: customer.id,
      productId: order.productId,
      amount: order.amount,
      currency: order.currency,
      status: 'completed',
      createdAt: new Date(order.createdAt)
    })
  }
}))

export default app
```

#### 6. Frontend Integration

```typescript
// apps/stage-web/src/lib/auth-client.ts
import { createAuthClient } from '@better-auth/react'
import { polarClient } from '@polar-sh/better-auth/client'

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL,
  plugins: [polarClient()]
})

// apps/stage-web/src/components/PricingPage.tsx
export function PricingPage() {
  async function handleUpgrade(tier: string) {
    const response = await fetch(`/api/checkout/${tier}`)
    const data = await response.json()

    window.location.href = data.checkoutUrl
  }

  return (
    <div>
      <button onClick={() => handleUpgrade('pro')}>
        Upgrade to Pro
      </button>
      <button onClick={() => handleUpgrade('enterprise')}>
        Upgrade to Enterprise
      </button>
    </div>
  )
}

// apps/stage-web/src/components/SettingsPage.tsx
export function SettingsPage() {
  async function openPortal() {
    const response = await fetch('/api/portal')
    const data = await response.json()

    window.open(data.portalUrl, '_blank')
  }

  return (
    <div>
      <button onClick={openPortal}>
        Manage Subscription
      </button>
    </div>
  )
}
```

### Deployment Checklist

- [ ] Install dependencies: `pnpm add @polar-sh/sdk @polar-sh/hono @polar-sh/better-auth`
- [ ] Configure environment variables in Cloudflare Workers
- [ ] Create Polar products (Free, Pro, Enterprise)
- [ ] Generate Polar access token
- [ ] Generate webhook secret
- [ ] Update database schema with Polar tables
- [ ] Run Drizzle migrations
- [ ] Deploy API Gateway with Hono routes
- [ ] Deploy frontend with pricing page
- [ ] Test checkout flow in sandbox
- [ ] Test webhooks in sandbox
- [ ] Configure production products
- [ ] Switch to production mode
- [ ] Monitor analytics

---

## Additional Resources

- [Polar Official Documentation](https://polar.sh/docs)
- [Polar GitHub Repository](https://github.com/polarsource/polar)
- [Polar Discord Community](https://discord.gg/polar)
- [Better Auth Integration Guide](https://www.better-auth.com/docs/plugins/polar)
- [Hono Framework](https://hono.dev/)
- [Cloudflare Workers](https://workers.cloudflare.com/)
- [Drizzle ORM](https://orm.drizzle.team/)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-06
**Compiled by:** Claude Code for Mirai MVP
**Source:** polar.sh official documentation

---

## Notes for Developers

This documentation is specifically tailored for the Mirai MVP project:

- Using **pnpm** monorepo structure
- Using **Drizzle ORM** with Cloudflare D1
- Using **Better Auth** for authentication
- Using **Hono** for API Gateway on Cloudflare Workers
- Using **React** + **Vite** for frontend

All code examples are production-ready and compatible with the Mirai MVP tech stack. Adjust environment variables and configuration as needed for your specific setup.

For questions or issues, refer to:
- Architecture documentation: `mvp-cloudflare-inworld-architecture.md`
- Better Auth documentation: `better-auth.md`
- Database schema: `packages/database-schema`
