#!/usr/bin/env node

/**
 * Manual script to report pending usage to Stripe
 * Run: npm run report-usage
 */

require('dotenv').config();

// Initialize database
require('../db/schema');

const StripeService = require('../services/stripe');
const { Usage, User } = require('../db/models');

async function reportUsage() {
  console.log('Reporting pending usage to Stripe...\n');

  try {
    // Get pending usage summary
    const pendingUsage = Usage.getUnreportedUsage();

    if (pendingUsage.length === 0) {
      console.log('No pending usage to report.');
      return;
    }

    console.log(`Found ${pendingUsage.length} users with pending usage:\n`);

    for (const usage of pendingUsage) {
      const user = User.findById(usage.user_id);
      console.log(`- User ${user?.email || usage.user_id}: ${usage.total_quantity} API calls`);
    }

    console.log('\nReporting to Stripe...\n');

    const results = await StripeService.reportPendingUsage();

    console.log('Results:');
    console.log('--------');

    for (const result of results) {
      const user = User.findById(result.userId);
      if (result.success) {
        console.log(`✓ ${user?.email}: ${result.quantity} calls reported (Record: ${result.recordId})`);
      } else {
        console.log(`✗ ${user?.email}: Failed - ${result.error}`);
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`\nSummary: ${successful} successful, ${failed} failed`);

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

reportUsage();
