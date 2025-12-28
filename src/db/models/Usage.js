const db = require('../schema');

class Usage {
  // Log a single API call
  static logCall({ userId, apiKeyId, endpoint, method, statusCode, responseTimeMs }) {
    const stmt = db.prepare(`
      INSERT INTO usage_logs (user_id, api_key_id, endpoint, method, status_code, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(userId, apiKeyId, endpoint, method, statusCode, responseTimeMs);
  }

  // Add to pending usage (to be reported to Stripe)
  static addPendingUsage(userId, quantity = 1) {
    const stmt = db.prepare(`
      INSERT INTO pending_usage (user_id, quantity)
      VALUES (?, ?)
    `);
    return stmt.run(userId, quantity);
  }

  // Get unreported usage grouped by user
  static getUnreportedUsage() {
    const stmt = db.prepare(`
      SELECT user_id, SUM(quantity) as total_quantity
      FROM pending_usage
      WHERE reported = 0
      GROUP BY user_id
    `);
    return stmt.all();
  }

  // Mark usage as reported
  static markAsReported(userId) {
    const stmt = db.prepare(`
      UPDATE pending_usage
      SET reported = 1, reported_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND reported = 0
    `);
    return stmt.run(userId);
  }

  // Get usage stats for a user within a date range
  static getUserStats(userId, startDate, endDate) {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        AVG(response_time_ms) as avg_response_time,
        MIN(timestamp) as first_call,
        MAX(timestamp) as last_call
      FROM usage_logs
      WHERE user_id = ?
        AND timestamp >= ?
        AND timestamp < ?
    `);
    return stmt.get(userId, startDate, endDate);
  }

  // Get usage by endpoint for a user
  static getUsageByEndpoint(userId, startDate, endDate) {
    const stmt = db.prepare(`
      SELECT
        endpoint,
        method,
        COUNT(*) as call_count,
        AVG(response_time_ms) as avg_response_time
      FROM usage_logs
      WHERE user_id = ?
        AND timestamp >= ?
        AND timestamp < ?
      GROUP BY endpoint, method
      ORDER BY call_count DESC
    `);
    return stmt.all(userId, startDate, endDate);
  }

  // Get daily usage for a user
  static getDailyUsage(userId, days = 30) {
    const stmt = db.prepare(`
      SELECT
        DATE(timestamp) as date,
        COUNT(*) as call_count
      FROM usage_logs
      WHERE user_id = ?
        AND timestamp >= DATE('now', '-' || ? || ' days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `);
    return stmt.all(userId, days);
  }

  // Get current month usage
  static getCurrentMonthUsage(userId) {
    const stmt = db.prepare(`
      SELECT COUNT(*) as total_calls
      FROM usage_logs
      WHERE user_id = ?
        AND timestamp >= DATE('now', 'start of month')
    `);
    return stmt.get(userId);
  }

  // Get total usage for all users (admin)
  static getTotalUsageStats() {
    const stmt = db.prepare(`
      SELECT
        u.id as user_id,
        u.email,
        u.subscription_status,
        COUNT(ul.id) as total_calls,
        MAX(ul.timestamp) as last_call
      FROM users u
      LEFT JOIN usage_logs ul ON u.id = ul.user_id
      GROUP BY u.id
      ORDER BY total_calls DESC
    `);
    return stmt.all();
  }

  // Cleanup old logs (keep last 90 days)
  static cleanupOldLogs(daysToKeep = 90) {
    const stmt = db.prepare(`
      DELETE FROM usage_logs
      WHERE timestamp < DATE('now', '-' || ? || ' days')
    `);
    return stmt.run(daysToKeep);
  }
}

module.exports = Usage;
