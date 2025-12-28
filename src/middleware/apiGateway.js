const { ApiKey, Usage } = require('../db/models');
const config = require('../config');

// Extract API key from request
function extractApiKey(req) {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  if (req.headers['x-api-key']) {
    return req.headers['x-api-key'];
  }

  // Check query parameter
  if (req.query.api_key) {
    return req.query.api_key;
  }

  return null;
}

// Authentication middleware
function authenticate(req, res, next) {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required. Provide it via Authorization header (Bearer), X-API-Key header, or api_key query parameter.',
    });
  }

  // Validate API key
  const keyRecord = ApiKey.validate(apiKey);

  if (!keyRecord) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or inactive API key.',
    });
  }

  // Check subscription status
  const activeStatuses = ['active', 'trialing', 'past_due'];
  if (!activeStatuses.includes(keyRecord.subscription_status)) {
    return res.status(403).json({
      error: 'Subscription Required',
      message: `Your subscription is ${keyRecord.subscription_status}. Please update your payment method.`,
      subscriptionStatus: keyRecord.subscription_status,
    });
  }

  // Attach user info to request
  req.user = {
    id: keyRecord.user_id,
    apiKeyId: keyRecord.id,
    subscriptionStatus: keyRecord.subscription_status,
    subscriptionId: keyRecord.stripe_subscription_id,
  };

  next();
}

// Usage tracking middleware
function trackUsage(req, res, next) {
  const startTime = Date.now();

  // Override res.end to capture response
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;

    // Log the usage
    try {
      Usage.logCall({
        userId: req.user.id,
        apiKeyId: req.user.apiKeyId,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTimeMs: responseTime,
      });

      // Add to pending usage for Stripe reporting
      // Only count successful requests (2xx, 3xx)
      if (res.statusCode < 400) {
        Usage.addPendingUsage(req.user.id, 1);
      }
    } catch (error) {
      console.error('Failed to log usage:', error);
    }

    originalEnd.apply(res, args);
  };

  next();
}

// Rate limiting by user (on top of global rate limit)
const userRateLimits = new Map();

function userRateLimit(maxRequests = 100, windowMs = 60000) {
  return (req, res, next) => {
    const userId = req.user.id;
    const now = Date.now();

    if (!userRateLimits.has(userId)) {
      userRateLimits.set(userId, { count: 0, windowStart: now });
    }

    const userLimit = userRateLimits.get(userId);

    // Reset window if expired
    if (now - userLimit.windowStart > windowMs) {
      userLimit.count = 0;
      userLimit.windowStart = now;
    }

    userLimit.count++;

    // Add rate limit headers
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - userLimit.count));
    res.set('X-RateLimit-Reset', Math.ceil((userLimit.windowStart + windowMs) / 1000));

    if (userLimit.count > maxRequests) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `You have exceeded ${maxRequests} requests per minute. Please slow down.`,
        retryAfter: Math.ceil((userLimit.windowStart + windowMs - now) / 1000),
      });
    }

    next();
  };
}

// Combined middleware for protected routes
function protectedRoute(options = {}) {
  const { rateLimit = config.api.rateLimit.max } = options;

  return [
    authenticate,
    userRateLimit(rateLimit),
    trackUsage,
  ];
}

module.exports = {
  authenticate,
  trackUsage,
  userRateLimit,
  protectedRoute,
  extractApiKey,
};
