#!/usr/bin/env node

/**
 * Setup script to create the required Stripe products and prices for metered billing
 * Run this once: npm run setup-stripe
 */

require('dotenv').config();
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function setup() {
  console.log('Setting up Stripe for metered billing...\n');

  try {
    // Create a product for API calls
    console.log('Creating product...');
    const product = await stripe.products.create({
      name: 'Novo API Access',
      description: 'Usage-based API access with metered billing',
      metadata: {
        type: 'api_access',
      },
    });
    console.log(`✓ Product created: ${product.id}`);

    // Create a metered price
    console.log('\nCreating metered price...');
    const price = await stripe.prices.create({
      product: product.id,
      currency: 'usd',
      recurring: {
        interval: 'month',
        usage_type: 'metered',
        aggregate_usage: 'sum', // Sum all usage in billing period
      },
      billing_scheme: 'per_unit',
      unit_amount: 1, // $0.01 per 10 API calls = $0.001 per call
      unit_amount_decimal: '0.1', // $0.001 per API call (0.1 cents)
      metadata: {
        type: 'api_calls',
      },
    });
    console.log(`✓ Metered price created: ${price.id}`);

    // Create a billing portal configuration
    console.log('\nCreating billing portal configuration...');
    const portalConfig = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Novo API - Manage your subscription',
      },
      features: {
        invoice_history: { enabled: true },
        payment_method_update: { enabled: true },
        subscription_cancel: { enabled: true },
        subscription_pause: { enabled: false },
      },
    });
    console.log(`✓ Billing portal configured: ${portalConfig.id}`);

    console.log('\n========================================');
    console.log('Setup complete! Add these to your .env file:');
    console.log('========================================\n');
    console.log(`STRIPE_PRODUCT_ID=${product.id}`);
    console.log(`STRIPE_PRICE_ID=${price.id}`);
    console.log('\n========================================');
    console.log('Pricing details:');
    console.log('========================================');
    console.log('- $0.001 per API call (0.1 cents)');
    console.log('- Billed monthly based on usage');
    console.log('- Usage is aggregated (summed) per billing period');

  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exit(1);
  }
}

setup();
