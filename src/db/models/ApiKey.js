const db = require('../schema');
const crypto = require('crypto');

class ApiKey {
  // Generate a new API key (returns the raw key only once)
  static generate(userId, name = 'Default') {
    // Generate a secure random key
    const rawKey = `nk_${crypto.randomBytes(32).toString('hex')}`;
    const keyPrefix = rawKey.substring(0, 10);
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

    const stmt = db.prepare(`
      INSERT INTO api_keys (user_id, key_hash, key_prefix, name)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(userId, keyHash, keyPrefix, name);

    return {
      id: result.lastInsertRowid,
      key: rawKey, // Only returned once!
      keyPrefix,
      name,
      userId,
    };
  }

  // Validate an API key and return the associated key record
  static validate(rawKey) {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const stmt = db.prepare(`
      SELECT ak.*, u.subscription_status, u.stripe_subscription_id
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? AND ak.is_active = 1
    `);
    const keyRecord = stmt.get(keyHash);

    if (keyRecord) {
      // Update last used timestamp
      const updateStmt = db.prepare(`
        UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?
      `);
      updateStmt.run(keyRecord.id);
    }

    return keyRecord;
  }

  static findByUserId(userId) {
    const stmt = db.prepare(`
      SELECT id, key_prefix, name, is_active, last_used_at, created_at
      FROM api_keys
      WHERE user_id = ?
    `);
    return stmt.all(userId);
  }

  static findById(id) {
    const stmt = db.prepare('SELECT * FROM api_keys WHERE id = ?');
    return stmt.get(id);
  }

  static revoke(id, userId) {
    const stmt = db.prepare(`
      UPDATE api_keys
      SET is_active = 0
      WHERE id = ? AND user_id = ?
    `);
    return stmt.run(id, userId);
  }

  static delete(id, userId) {
    const stmt = db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?');
    return stmt.run(id, userId);
  }
}

module.exports = ApiKey;
