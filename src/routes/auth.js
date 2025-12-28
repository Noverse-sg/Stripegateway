const express = require('express');
const { User, ApiKey } = require('../db/models');
const StripeService = require('../services/stripe');
const config = require('../config');

const router = express.Router();

// Check if Stripe is configured
const isStripeConfigured = () => !!config.stripe.secretKey && !!config.stripe.priceId;

// Register a new user
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user already exists
    const existingUser = User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create user
    const user = User.create({ email, password, name });

    // Create default API key
    const apiKey = ApiKey.generate(user.id, 'Default');

    let subscriptionInfo = null;

    // Only create Stripe resources if configured
    if (isStripeConfigured()) {
      // Create Stripe customer
      const customer = await StripeService.createCustomer(user);

      // Create metered subscription (starts at $0)
      const subscription = await StripeService.createMeteredSubscription(customer.id);

      // Update user with subscription info
      User.updateSubscription(user.id, {
        subscriptionId: subscription.id,
        status: subscription.status,
      });

      subscriptionInfo = {
        id: subscription.id,
        status: subscription.status,
        setupRequired: subscription.pending_setup_intent ? true : false,
        setupUrl: subscription.pending_setup_intent?.client_secret,
      };
    } else {
      // Mock mode - set subscription as active for testing
      User.updateSubscription(user.id, {
        subscriptionId: 'mock_sub_' + Date.now(),
        status: 'active',
      });

      subscriptionInfo = {
        id: 'mock_subscription',
        status: 'active',
        mode: 'test_mode_no_stripe',
      };
    }

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      apiKey: {
        key: apiKey.key, // Only shown once!
        name: apiKey.name,
        note: 'Save this API key securely. It will not be shown again.',
      },
      subscription: subscriptionInfo,
      testMode: !isStripeConfigured(),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!User.verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user's API keys
    const apiKeys = ApiKey.findByUserId(user.id);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionStatus: user.subscription_status,
      },
      apiKeys: apiKeys.map(k => ({
        id: k.id,
        prefix: k.key_prefix,
        name: k.name,
        isActive: k.is_active === 1,
        lastUsed: k.last_used_at,
      })),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Generate new API key (requires email/password auth)
router.post('/api-keys', (req, res) => {
  try {
    const { email, password, keyName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email);
    if (!user || !User.verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const apiKey = ApiKey.generate(user.id, keyName || 'API Key');

    res.status(201).json({
      message: 'API key created successfully',
      apiKey: {
        id: apiKey.id,
        key: apiKey.key,
        name: apiKey.name,
        note: 'Save this API key securely. It will not be shown again.',
      },
    });
  } catch (error) {
    console.error('API key creation error:', error);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// List API keys
router.get('/api-keys', (req, res) => {
  try {
    const { email, password } = req.query;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email);
    if (!user || !User.verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const apiKeys = ApiKey.findByUserId(user.id);

    res.json({
      apiKeys: apiKeys.map(k => ({
        id: k.id,
        prefix: k.key_prefix,
        name: k.name,
        isActive: k.is_active === 1,
        lastUsed: k.last_used_at,
        createdAt: k.created_at,
      })),
    });
  } catch (error) {
    console.error('List API keys error:', error);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// Revoke API key
router.delete('/api-keys/:keyId', (req, res) => {
  try {
    const { email, password } = req.body;
    const { keyId } = req.params;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = User.findByEmail(email);
    if (!user || !User.verifyPassword(user, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    ApiKey.revoke(parseInt(keyId), user.id);

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Revoke API key error:', error);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
