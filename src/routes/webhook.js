const express = require('express');
const WebhookHandler = require('../services/webhook');

const router = express.Router();

// Stripe webhook endpoint
// Note: This needs raw body, configured in main app
router.post('/', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  try {
    const event = WebhookHandler.constructEvent(req.body, signature);
    const result = await WebhookHandler.handleEvent(event);
    res.json(result);
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: `Webhook Error: ${error.message}` });
  }
});

module.exports = router;
