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
import { Polar } from '@polar-sh/sdk'

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
    // Get webhook headers - Polar sends webhook-id, webhook-timestamp, and webhook-signature
    const webhookId = c.req.header('webhook-id')
    const webhookTimestamp = c.req.header('webhook-timestamp')
    const webhookSignature = c.req.header('webhook-signature')

    if (!webhookId || !webhookTimestamp || !webhookSignature) {
      console.error('[WEBHOOK] Missing required webhook headers', {
        hasId: !!webhookId,
        hasTimestamp: !!webhookTimestamp,
        hasSignature: !!webhookSignature,
      })
      return c.json({ error: 'Missing webhook headers' }, 401)
    }

    const rawBody = await c.req.text()

    // Verify webhook signature using Polar SDK
    let payload: any
    try {
      payload = validateEvent(
        rawBody,
        {
          'webhook-id': webhookId,
          'webhook-timestamp': webhookTimestamp,
          'webhook-signature': webhookSignature,
        },
        c.env.POLAR_SANDBOX_WEBHOOK_SECRET,
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

      case 'subscription.active':
        await handleSubscriptionActive(db, data, c.env)
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

      case 'order.paid':
        await handleOrderPaid(db, data)
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
    customerId,
    productId,
    price,
    status,
    currentPeriodStart,
    currentPeriodEnd,
  } = data

  // Extract priceId from nested price object or use productId as fallback
  const priceId = price?.id || productId

  // Determine tier from productId
  const tier = getTierFromProductId(productId)

  console.log(`[WEBHOOK] Creating subscription - productId: ${productId}, priceId: ${priceId}, tier: ${tier}`)

  // Get userId from customer's polarCustomerId
  // If not found, this might be a race condition where subscription.created arrived before customer.created
  let customer = await db
    .select()
    .from(user)
    .where(eq(user.polarCustomerId, customerId))
    .limit(1)

  if (!customer.length) {
    console.warn(`[WEBHOOK] Customer not yet linked with Polar ID: ${customerId}, will be handled by subscription.active`)
    // Don't fail - subscription.active will handle this after customer.created links the customer
    return
  }

  const userId = customer[0].id

  // Insert subscription
  // Note: Polar sends timestamps in seconds, Drizzle expects Date objects (converted to milliseconds)
  const newSubscription: NewSubscription = {
    id,
    userId,
    polarCustomerId: customerId,
    productId,
    priceId,
    status,
    currentPeriodStart: new Date(currentPeriodStart * 1000),
    currentPeriodEnd: new Date(currentPeriodEnd * 1000),
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
      polarCustomerId: customerId,
    })
    .where(eq(user.id, userId))

  console.log(`[WEBHOOK] Subscription created for user ${userId}: ${tier}`)
}

/**
 * Handle subscription.active event
 * This event is triggered when a subscription becomes active (after payment is confirmed)
 * This is the most reliable event to use for creating/updating subscriptions
 */
async function handleSubscriptionActive(db: any, data: any, env: HonoEnv['Bindings']) {
  const {
    id,
    customerId,
    productId,
    price,
    status,
    currentPeriodStart,
    currentPeriodEnd,
  } = data

  // Extract priceId from nested price object or use productId as fallback
  const priceId = price?.id || productId

  // Determine tier from productId
  const tier = getTierFromProductId(productId)

  console.log(`[WEBHOOK] Subscription activated - productId: ${productId}, priceId: ${priceId}, tier: ${tier}`)

  // Check if subscription already exists
  const existingSubscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1)

  if (existingSubscription.length) {
    // Update existing subscription to active
    // Note: Polar sends timestamps in seconds, Drizzle expects Date objects (converted to milliseconds)
    await db
      .update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: new Date(currentPeriodStart * 1000),
        currentPeriodEnd: new Date(currentPeriodEnd * 1000),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, id))

    console.log(`[WEBHOOK] Updated existing subscription ${id} to active`)
  } else {
    // Create new subscription record (fallback if subscription.created was missed or failed)
    let customer = await db
      .select()
      .from(user)
      .where(eq(user.polarCustomerId, customerId))
      .limit(1)

    // If customer not found, try to link them by fetching from Polar and matching by email
    if (!customer.length) {
      console.warn(`[WEBHOOK] Customer not yet linked, attempting to link customer ${customerId}`)

      try {
        const polar = new Polar({
          accessToken: env.POLAR_SANDBOX_ACCESS_TOKEN,
          server: 'sandbox',
        })

        // Fetch customer details from Polar
        const polarCustomer = await polar.customers.get({ id: customerId })

        if (polarCustomer.email) {
          // Try to find user by email
          const userByEmail = await db
            .select()
            .from(user)
            .where(eq(user.email, polarCustomer.email))
            .limit(1)

          if (userByEmail.length) {
            // Link Polar customer to user
            await db
              .update(user)
              .set({ polarCustomerId: customerId })
              .where(eq(user.id, userByEmail[0].id))

            customer = userByEmail
            console.log(`[WEBHOOK] Linked Polar customer ${customerId} to user ${userByEmail[0].id}`)
          }
        }
      } catch (linkError) {
        console.error(`[WEBHOOK] Failed to link customer ${customerId}:`, linkError)
      }
    }

    if (!customer.length) {
      console.error(`[WEBHOOK] Cannot create subscription: customer ${customerId} not found and cannot be linked`)
      return
    }

    const userId = customer[0].id

    // Note: Polar sends timestamps in seconds, Drizzle expects Date objects (converted to milliseconds)
    const newSubscription: NewSubscription = {
      id,
      userId,
      polarCustomerId: customerId,
      productId,
      priceId,
      status: 'active',
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(subscriptions).values(newSubscription)
    console.log(`[WEBHOOK] Created subscription record for ${id}`)
  }

  // Update user subscription tier and status
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1)

  if (subscription.length) {
    await db
      .update(user)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: 'active',
        polarCustomerId: customerId,
      })
      .where(eq(user.id, subscription[0].userId))

    console.log(`[WEBHOOK] Subscription activated for user ${subscription[0].userId}: ${tier}`)
  }
}

/**
 * Handle subscription.updated event
 */
async function handleSubscriptionUpdated(db: any, data: any) {
  const {
    id,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  } = data

  // Note: Polar sends timestamps in seconds, Drizzle expects Date objects (converted to milliseconds)
  await db
    .update(subscriptions)
    .set({
      status,
      currentPeriodStart: new Date(currentPeriodStart * 1000),
      currentPeriodEnd: new Date(currentPeriodEnd * 1000),
      cancelAtPeriodEnd: cancelAtPeriodEnd || false,
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
  const { id } = data

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Get subscription to find user
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1)

  if (subscription.length) {
    // Downgrade user to free tier
    await db
      .update(user)
      .set({
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
      })
      .where(eq(user.id, subscription[0].userId))

    console.log(`[WEBHOOK] Subscription canceled for user ${subscription[0].userId}`)
  }
}

/**
 * Handle subscription.revoked event
 * Immediately revokes subscription (e.g., chargebacks, fraud)
 */
async function handleSubscriptionRevoked(db: any, data: any) {
  const { id } = data

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, id))

  // Get subscription to find user
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.id, id))
    .limit(1)

  if (subscription.length) {
    // Immediately downgrade user to free tier
    await db
      .update(user)
      .set({
        subscriptionTier: 'free',
        subscriptionStatus: 'canceled',
      })
      .where(eq(user.id, subscription[0].userId))

    console.log(`[WEBHOOK] Subscription revoked for user ${subscription[0].userId}`)
  }
}

/**
 * Handle order.created event
 */
async function handleOrderCreated(db: any, data: any) {
  console.log('[WEBHOOK] Order created:', data.id)
  // One-time purchases can be handled here
  // For now, we focus on subscriptions
}

/**
 * Handle order.paid event
 * This event confirms payment was successful for an order
 */
async function handleOrderPaid(db: any, data: any) {
  const { id, customerId, productId, amount, currency } = data

  console.log(`[WEBHOOK] Order paid: ${id} - ${amount} ${currency} for product ${productId}`)

  // For subscription orders, the subscription.active event will handle tier updates
  // This is mainly for logging and tracking one-time purchases
  // You could add logic here to grant immediate access to one-time purchase items
}

/**
 * Handle benefit_grant.created event
 */
async function handleBenefitGranted(db: any, data: any) {
  const { customerId, benefitId } = data
  console.log(`[WEBHOOK] Benefit granted to customer ${customerId}: ${benefitId}`)
  // Can be used to grant access to specific features or content
}

/**
 * Handle benefit_grant.revoked event
 */
async function handleBenefitRevoked(db: any, data: any) {
  const { customerId, benefitId } = data
  console.log(`[WEBHOOK] Benefit revoked from customer ${customerId}: ${benefitId}`)
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
function getTierFromProductId(productId: string): 'free' | 'pro' | 'max' {
  // Match against actual Polar product IDs from wrangler.toml
  // Pro Monthly:  c540d579-d932-459f-bc8c-c6f73c7091b3
  // Pro Yearly:   15a6e08c-84d7-4076-a622-6f8e100bfa07
  // Max Monthly:  005f746f-e207-4a00-b25c-a3d1c8f97084
  // Max Yearly:   bdd7e461-7fcd-431e-a266-6891e1758781

  const productIdLower = productId.toLowerCase()

  // Pro tier products
  if (
    productIdLower.includes('c540d579') || // Pro Monthly
    productIdLower.includes('15a6e08c') || // Pro Yearly
    productIdLower.includes('pro')
  ) {
    return 'pro'
  }

  // Max tier products
  if (
    productIdLower.includes('005f746f') || // Max Monthly
    productIdLower.includes('bdd7e461') || // Max Yearly
    productIdLower.includes('max')
  ) {
    return 'max'
  }

  return 'free'
}

export default webhookRoutes
