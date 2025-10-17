/**
 * Webhook Routes
 *
 * Handles webhooks from external services (Polar, etc.)
 */

import { Hono } from 'hono'
import type { HonoEnv } from '../types/env'
import { drizzle } from 'drizzle-orm/d1'
import { subscriptions, user, type NewSubscription } from '@proj-airi/database-schema'
import { eq } from 'drizzle-orm'
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks'

const webhookRoutes = new Hono<HonoEnv>()

/**
 * POST /api/webhooks/polar
 * Handle Polar webhook events
 *
 * This endpoint handles all Polar webhook events including:
 * - subscription.created
 * - subscription.updated
 * - subscription.canceled
 * - subscription.revoked
 * - order.created
 * - benefit_grant.created
 * - benefit_grant.revoked
 * - customer.created
 * - customer.updated
 */
webhookRoutes.post('/polar', async (c) => {
  try {
    // Get webhook signature and payload
    const signature = c.req.header('webhook-signature') || c.req.header('x-polar-signature')
    if (!signature) {
      console.error('[WEBHOOK] Missing webhook signature')
      return c.json({ error: 'Missing signature' }, 401)
    }

    const rawBody = await c.req.text()

    // Verify webhook signature using Polar SDK
    let payload: any
    try {
      payload = validateEvent(
        rawBody,
        { 'webhook-signature': signature },
        c.env.POLAR_WEBHOOK_SECRET,
      )
    } catch (verifyError) {
      console.error('[WEBHOOK] Signature verification failed:', verifyError)
      if (verifyError instanceof WebhookVerificationError) {
        return c.json({ error: 'Invalid webhook signature' }, 401)
      }
      return c.json({ error: 'Invalid signature' }, 401)
    }

    const { type, data } = payload

    console.log(`[WEBHOOK] Polar event: ${type}`, {
      id: data.id || data.subscription?.id || data.order?.id,
      timestamp: new Date().toISOString(),
    })

    const db = drizzle(c.env.DB)

    // Handle different webhook events
    switch (type) {
      // Subscription Lifecycle
      case 'subscription.created':
        await handleSubscriptionCreated(db, data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(db, data)
        break

      case 'subscription.canceled':
        await handleSubscriptionCanceled(db, data)
        break

      case 'subscription.revoked':
        await handleSubscriptionRevoked(db, data)
        break

      // Orders
      case 'order.created':
        await handleOrderCreated(db, data)
        break

      // Benefit Grants
      case 'benefit_grant.created':
        await handleBenefitGranted(db, data)
        break

      case 'benefit_grant.revoked':
        await handleBenefitRevoked(db, data)
        break

      // Checkout Events
      case 'checkout.created':
        console.log('[WEBHOOK] Checkout created:', data.id)
        break

      case 'checkout.updated':
        console.log('[WEBHOOK] Checkout updated:', data.id, data.status)
        break

      // Customer Events
      case 'customer.created':
        await handleCustomerCreated(db, data)
        break

      case 'customer.updated':
        await handleCustomerUpdated(db, data)
        break

      default:
        console.log(`[WEBHOOK] Unhandled event type: ${type}`)
    }

    // Return 200 OK to acknowledge receipt
    return c.json({ received: true })
  } catch (error) {
    console.error('[WEBHOOK] Processing error:', error)
    // Return 200 to prevent Polar from retrying (we've logged the error)
    // Change to 500 if you want Polar to retry
    return c.json(
      {
        error: 'Failed to process webhook',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      200,
    )
  }
})

/**
 * Handle subscription.created event
 */
async function handleSubscriptionCreated(db: any, data: any) {
  const {
    id,
    customer_id,
    user_id,
    product_id,
    price_id,
    status,
    current_period_start,
    current_period_end,
  } = data

  // Determine tier from product_id
  const tier = getTierFromProductId(product_id)

  // Insert subscription
  const newSubscription: NewSubscription = {
    id,
    userId: user_id,
    polarCustomerId: customer_id,
    productId: product_id,
    priceId: price_id,
    status,
    currentPeriodStart: new Date(current_period_start),
    currentPeriodEnd: new Date(current_period_end),
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await db.insert(subscriptions).values(newSubscription)

  // Update user subscription tier
  await db
    .update(user)
    .set({
      subscriptionTier: tier,
      subscriptionStatus: status,
      polarCustomerId: customer_id,
    })
    .where(eq(user.id, user_id))

  console.log(`[WEBHOOK] Subscription created for user ${user_id}: ${tier}`)
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(db: any, data: any) {
  const {
    id,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
  } = data

  await db
    .update(subscriptions)
    .set({
      status,
      currentPeriodStart: new Date(current_period_start),
      currentPeriodEnd: new Date(current_period_end),
      cancelAtPeriodEnd: cancel_at_period_end,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Update user status
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1)

  if (subscription.length) {
    await db
      .update(user)
      .set({
        subscriptionStatus: status,
      })
      .where(eq(user.id, subscription[0].userId))
  }

  console.log(`[WEBHOOK] Subscription updated: ${id} - ${status}`)
}

/**
 * Handle subscription.canceled event
 */
async function handleSubscriptionCanceled(db: any, data: any) {
  const { id, user_id } = data

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Downgrade user to free tier
  await db
    .update(user)
    .set({
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
    })
    .where(eq(user.id, user_id))

  console.log(`[WEBHOOK] Subscription canceled for user ${user_id}`)
}

/**
 * Handle subscription.revoked event
 * Immediately revokes subscription (e.g., chargebacks, fraud)
 */
async function handleSubscriptionRevoked(db: any, data: any) {
  const { id, user_id } = data

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Immediately downgrade user to free tier
  await db
    .update(user)
    .set({
      subscriptionTier: 'free',
      subscriptionStatus: 'canceled',
    })
    .where(eq(user.id, user_id))

  console.log(`[WEBHOOK] Subscription revoked for user ${user_id}`)
}

/**
 * Handle order.created event
 */
async function handleOrderCreated(db: any, data: any) {
  console.log('[WEBHOOK] Order created:', data)
  // One-time purchases can be handled here
  // For now, we focus on subscriptions
}

/**
 * Handle benefit.granted event
 */
async function handleBenefitGranted(db: any, data: any) {
  const { customer, benefit } = data
  console.log(`[WEBHOOK] Benefit granted to customer ${customer.id}:`, benefit.type)
  // Can be used to grant access to specific features or content
}

/**
 * Handle benefit.revoked event
 */
async function handleBenefitRevoked(db: any, data: any) {
  const { customer, benefit } = data
  console.log(`[WEBHOOK] Benefit revoked from customer ${customer.id}:`, benefit.type)
  // Can be used to revoke access to specific features or content
}

/**
 * Handle customer.created event
 */
async function handleCustomerCreated(db: any, data: any) {
  const { id, email, metadata } = data

  // Try to match customer to existing user by email
  if (email) {
    const existingUser = await db
      .select()
      .from(user)
      .where(eq(user.email, email))
      .limit(1)

    if (existingUser.length && !existingUser[0].polarCustomerId) {
      // Link Polar customer to existing user
      await db
        .update(user)
        .set({ polarCustomerId: id })
        .where(eq(user.id, existingUser[0].id))

      console.log(`[WEBHOOK] Linked Polar customer ${id} to user ${existingUser[0].id}`)
    }
  }
}

/**
 * Handle customer.updated event
 */
async function handleCustomerUpdated(db: any, data: any) {
  const { id } = data
  console.log(`[WEBHOOK] Customer updated: ${id}`)
  // Handle customer metadata updates if needed
}

/**
 * Map Polar product ID to subscription tier
 */
function getTierFromProductId(productId: string): 'free' | 'pro' | 'enterprise' {
  // Note: In production, get these from environment variables
  // For now, we use a simple string matching approach
  const productIdLower = productId.toLowerCase()

  if (productIdLower.includes('pro')) {
    return 'pro'
  } else if (productIdLower.includes('enterprise')) {
    return 'enterprise'
  }

  return 'free'
}

export default webhookRoutes
