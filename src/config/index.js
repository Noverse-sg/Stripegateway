require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    priceId: process.env.STRIPE_PRICE_ID, // Metered price ID
    productId: process.env.STRIPE_PRODUCT_ID,
  },

  database: {
    path: process.env.DATABASE_PATH || './data/billing.db',
  },

  api: {
    rateLimit: {
      windowMs: 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_PER_MINUTE) || 100,
    },
    usageReportingInterval: parseInt(process.env.USAGE_REPORTING_INTERVAL) || 60000, // 1 minute
  },

  billing: {
    // Cost per API call in cents (for display purposes)
    costPerCall: parseFloat(process.env.COST_PER_CALL) || 0.001,
    // Free tier calls per month
    freeTierCalls: parseInt(process.env.FREE_TIER_CALLS) || 1000,
  }
};
