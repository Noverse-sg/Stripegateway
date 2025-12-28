const StripeService = require('./stripe');
const config = require('../config');

class UsageReporter {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
  }

  // Start periodic usage reporting
  start(intervalMs = config.api.usageReportingInterval) {
    if (this.isRunning) {
      console.log('Usage reporter is already running');
      return;
    }

    console.log(`Starting usage reporter with ${intervalMs}ms interval`);
    this.isRunning = true;

    // Run immediately on start
    this.reportUsage();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.reportUsage();
    }, intervalMs);
  }

  // Stop periodic reporting
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('Usage reporter stopped');
  }

  // Report pending usage to Stripe
  async reportUsage() {
    try {
      console.log(`[${new Date().toISOString()}] Reporting usage to Stripe...`);
      const results = await StripeService.reportPendingUsage();

      if (results.length === 0) {
        console.log('No pending usage to report');
        return;
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      console.log(`Reported usage: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        console.log('Failed reports:', results.filter(r => !r.success));
      }

      return results;
    } catch (error) {
      console.error('Usage reporting error:', error);
    }
  }
}

// Singleton instance
const usageReporter = new UsageReporter();

module.exports = usageReporter;
