const Stripe = require('stripe');
const config = require('../config');
const { User, Usage } = require('../db/models');

const stripe = new Stripe(config.stripe.secretKey);

class StripeService {
  // Create a Stripe customer for a user
  static async createCustomer(user) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id.toString(),
      },
    });

    // Update user with Stripe customer ID
    User.updateStripeCustomer(user.id, customer.id);

    return customer;
  }

  // Create a metered subscription for a customer
  static async createSubscription(stripeCustomerId) {
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: config.stripe.priceId,
        },
      ],
      // Important for metered billing
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['latest_invoice.payment_intent', 'pending_setup_intent'],
    });

    return subscription;
  }

  // Create subscription with a setup intent (for $0 start)
  static async createMeteredSubscription(stripeCustomerId) {
    // For metered billing, we typically start with $0 and bill based on usage
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [
        {
          price: config.stripe.priceId,
        },
      ],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      expand: ['pending_setup_intent'],
    });

    return subscription;
  }

  // Report usage to Stripe for metered billing
  static async reportUsage(subscriptionItemId, quantity, timestamp = null) {
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      subscriptionItemId,
      {
        quantity,
        timestamp: timestamp || Math.floor(Date.now() / 1000),
        action: 'increment', // Add to existing usage
      }
    );

    return usageRecord;
  }

  // Get subscription item ID for a subscription
  static async getSubscriptionItemId(subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    // For single-item subscriptions, get the first item
    return subscription.items.data[0]?.id;
  }

  // Report all pending usage to Stripe
  static async reportPendingUsage() {
    const pendingUsage = Usage.getUnreportedUsage();
    const results = [];

    for (const usage of pendingUsage) {
      const user = User.findById(usage.user_id);

      if (!user?.stripe_subscription_id) {
        console.log(`User ${usage.user_id} has no subscription, skipping usage report`);
        continue;
      }

      try {
        const subscriptionItemId = await this.getSubscriptionItemId(user.stripe_subscription_id);

        if (subscriptionItemId) {
          const record = await this.reportUsage(subscriptionItemId, usage.total_quantity);
          Usage.markAsReported(usage.user_id);
          results.push({
            userId: usage.user_id,
            quantity: usage.total_quantity,
            success: true,
            recordId: record.id,
          });
        }
      } catch (error) {
        console.error(`Failed to report usage for user ${usage.user_id}:`, error.message);
        results.push({
          userId: usage.user_id,
          quantity: usage.total_quantity,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Get customer's current usage for billing period
  static async getUsageSummary(subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data'],
    });

    const subscriptionItem = subscription.items.data[0];
    if (!subscriptionItem) return null;

    // Get usage records for current period
    const usageRecords = await stripe.subscriptionItems.listUsageRecordSummaries(
      subscriptionItem.id,
      { limit: 1 }
    );

    return {
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      totalUsage: usageRecords.data[0]?.total_usage || 0,
      subscriptionStatus: subscription.status,
    };
  }

  // Create a checkout session for setting up payment
  static async createCheckoutSession(customerId, successUrl, cancelUrl) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'setup',
      payment_method_types: ['card'],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return session;
  }

  // Create a billing portal session
  static async createBillingPortalSession(customerId, returnUrl) {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session;
  }

  // Get customer's invoices
  static async getInvoices(customerId, limit = 10) {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data;
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId) {
    const subscription = await stripe.subscriptions.cancel(subscriptionId);
    return subscription;
  }

  // Get subscription details
  static async getSubscription(subscriptionId) {
    return stripe.subscriptions.retrieve(subscriptionId);
  }
}

module.exports = StripeService;
