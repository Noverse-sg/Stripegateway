const db = require('../schema');
const bcrypt = require('bcryptjs');

class User {
  static create({ email, password, name }) {
    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, name)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(email, passwordHash, name);
    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  static findByEmail(email) {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email);
  }

  static findByStripeCustomerId(stripeCustomerId) {
    const stmt = db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?');
    return stmt.get(stripeCustomerId);
  }

  static verifyPassword(user, password) {
    return bcrypt.compareSync(password, user.password_hash);
  }

  static updateStripeCustomer(userId, stripeCustomerId) {
    const stmt = db.prepare(`
      UPDATE users
      SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(stripeCustomerId, userId);
    return this.findById(userId);
  }

  static updateSubscription(userId, { subscriptionId, status }) {
    const stmt = db.prepare(`
      UPDATE users
      SET stripe_subscription_id = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(subscriptionId, status, userId);
    return this.findById(userId);
  }

  static updateSubscriptionByCustomerId(stripeCustomerId, { subscriptionId, status }) {
    const stmt = db.prepare(`
      UPDATE users
      SET stripe_subscription_id = ?, subscription_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE stripe_customer_id = ?
    `);
    stmt.run(subscriptionId, status, stripeCustomerId);
    return this.findByStripeCustomerId(stripeCustomerId);
  }

  static getAll() {
    const stmt = db.prepare('SELECT id, email, name, subscription_status, created_at FROM users');
    return stmt.all();
  }
}

module.exports = User;
