const Stripe = require('stripe');
const config = require('../config');
const { User } = require('../db/models');

const stripe = new Stripe(config.stripe.secretKey);

class WebhookHandler {
  static constructEvent(payload, signature) {
    return stripe.webhooks.constructEvent(
      payload,
      signature,
      config.stripe.webhookSecret
    );
  }

  static async handleEvent(event) {
    console.log(`Processing webhook event: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
        return this.handleSubscriptionCreated(event.data.object);

      case 'customer.subscription.updated':
        return this.handleSubscriptionUpdated(event.data.object);

      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(event.data.object);

      case 'invoice.paid':
        return this.handleInvoicePaid(event.data.object);

      case 'invoice.payment_failed':
        return this.handleInvoicePaymentFailed(event.data.object);

      case 'customer.subscription.trial_will_end':
        return this.handleTrialWillEnd(event.data.object);

      default:
        console.log(`Unhandled event type: ${event.type}`);
        return { received: true };
    }
  }

  static async handleSubscriptionCreated(subscription) {
    const customerId = subscription.customer;

    User.updateSubscriptionByCustomerId(customerId, {
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    console.log(`Subscription created for customer ${customerId}: ${subscription.id}`);
    return { success: true };
  }

  static async handleSubscriptionUpdated(subscription) {
    const customerId = subscription.customer;

    User.updateSubscriptionByCustomerId(customerId, {
      subscriptionId: subscription.id,
      status: subscription.status,
    });

    console.log(`Subscription updated for customer ${customerId}: ${subscription.status}`);
    return { success: true };
  }

  static async handleSubscriptionDeleted(subscription) {
    const customerId = subscription.customer;

    User.updateSubscriptionByCustomerId(customerId, {
      subscriptionId: null,
      status: 'canceled',
    });

    console.log(`Subscription canceled for customer ${customerId}`);
    return { success: true };
  }

  static async handleInvoicePaid(invoice) {
    const customerId = invoice.customer;
    const user = User.findByStripeCustomerId(customerId);

    if (user) {
      console.log(`Invoice paid for user ${user.email}: $${invoice.amount_paid / 100}`);
    }

    return { success: true };
  }

  static async handleInvoicePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const user = User.findByStripeCustomerId(customerId);

    if (user) {
      console.log(`Payment failed for user ${user.email}`);
      // You could send an email notification here
      // Or suspend API access
    }

    return { success: true };
  }

  static async handleTrialWillEnd(subscription) {
    const customerId = subscription.customer;
    const user = User.findByStripeCustomerId(customerId);

    if (user) {
      console.log(`Trial ending soon for user ${user.email}`);
      // Send reminder email
    }

    return { success: true };
  }
}

module.exports = WebhookHandler;
