const express = require('express');
const { User, Usage } = require('../db/models');
const StripeService = require('../services/stripe');
const { protectedRoute } = require('../middleware/apiGateway');
const config = require('../config');

const router = express.Router();

// Get current usage and billing info
router.get('/usage', protectedRoute(), async (req, res) => {
  try {
    const user = User.findById(req.user.id);

    // Get current month usage from database
    const currentMonthUsage = Usage.getCurrentMonthUsage(req.user.id);

    // Get usage from Stripe if subscription exists
    let stripeUsage = null;
    if (user.stripe_subscription_id) {
      try {
        stripeUsage = await StripeService.getUsageSummary(user.stripe_subscription_id);
      } catch (error) {
        console.error('Failed to get Stripe usage:', error.message);
      }
    }

    // Get daily breakdown
    const dailyUsage = Usage.getDailyUsage(req.user.id, 30);

    // Calculate estimated cost
    const totalCalls = currentMonthUsage?.total_calls || 0;
    const billableCalls = Math.max(0, totalCalls - config.billing.freeTierCalls);
    const estimatedCost = billableCalls * config.billing.costPerCall;

    res.json({
      currentPeriod: {
        totalCalls,
        freeTierCalls: config.billing.freeTierCalls,
        billableCalls,
        estimatedCost: `$${estimatedCost.toFixed(4)}`,
        costPerCall: `$${config.billing.costPerCall}`,
      },
      stripe: stripeUsage,
      dailyBreakdown: dailyUsage,
      subscriptionStatus: user.subscription_status,
    });
  } catch (error) {
    console.error('Get usage error:', error);
    res.status(500).json({ error: 'Failed to get usage data' });
  }
});

// Get usage breakdown by endpoint
router.get('/usage/endpoints', protectedRoute(), (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const endpointUsage = Usage.getUsageByEndpoint(
      req.user.id,
      startDate.toISOString(),
      new Date().toISOString()
    );

    res.json({
      period: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
        days: parseInt(days),
      },
      endpoints: endpointUsage,
    });
  } catch (error) {
    console.error('Get endpoint usage error:', error);
    res.status(500).json({ error: 'Failed to get endpoint usage' });
  }
});

// Get invoices
router.get('/invoices', protectedRoute(), async (req, res) => {
  try {
    const user = User.findById(req.user.id);

    if (!user.stripe_customer_id) {
      return res.json({ invoices: [] });
    }

    const invoices = await StripeService.getInvoices(user.stripe_customer_id);

    res.json({
      invoices: invoices.map(inv => ({
        id: inv.id,
        number: inv.number,
        status: inv.status,
        amount: inv.amount_due / 100,
        currency: inv.currency.toUpperCase(),
        created: new Date(inv.created * 1000).toISOString(),
        periodStart: new Date(inv.period_start * 1000).toISOString(),
        periodEnd: new Date(inv.period_end * 1000).toISOString(),
        pdfUrl: inv.invoice_pdf,
        hostedUrl: inv.hosted_invoice_url,
      })),
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Create billing portal session
router.post('/portal', protectedRoute(), async (req, res) => {
  try {
    const user = User.findById(req.user.id);
    const { returnUrl } = req.body;

    if (!user.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const session = await StripeService.createBillingPortalSession(
      user.stripe_customer_id,
      returnUrl || 'http://localhost:3000/'
    );

    res.json({ url: session.url });
  } catch (error) {
    console.error('Create portal session error:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
  }
});

// Get subscription details
router.get('/subscription', protectedRoute(), async (req, res) => {
  try {
    const user = User.findById(req.user.id);

    if (!user.stripe_subscription_id) {
      return res.json({
        status: 'none',
        message: 'No active subscription',
      });
    }

    const subscription = await StripeService.getSubscription(user.stripe_subscription_id);

    res.json({
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
});

// Cancel subscription
router.post('/subscription/cancel', protectedRoute(), async (req, res) => {
  try {
    const user = User.findById(req.user.id);

    if (!user.stripe_subscription_id) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    const subscription = await StripeService.cancelSubscription(user.stripe_subscription_id);

    User.updateSubscription(req.user.id, {
      subscriptionId: subscription.id,
      status: 'canceled',
    });

    res.json({
      message: 'Subscription canceled',
      status: subscription.status,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

module.exports = router;
