const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');

// Initialize database
require('./db/schema');

// Import routes
const authRoutes = require('./routes/auth');
const billingRoutes = require('./routes/billing');
const apiRoutes = require('./routes/api');
const webhookRoutes = require('./routes/webhook');
const dashboardRoutes = require('./routes/dashboard');

// Import services
const usageReporter = require('./services/usageReporter');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());

// Global rate limiting
const limiter = rateLimit({
  windowMs: config.api.rateLimit.windowMs,
  max: config.api.rateLimit.max * 10, // Global limit is higher than per-user
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the global rate limit. Please try again later.',
  },
});
app.use(limiter);

// Stripe webhook needs raw body
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRoutes);

// JSON body parser for other routes
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.use('/auth', authRoutes);
app.use('/billing', billingRoutes);
app.use('/api/v1', apiRoutes);
app.use('/dashboard', dashboardRoutes);

// API documentation endpoint - HTML page
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Novo API Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e4e7;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    header {
      text-align: center;
      margin-bottom: 50px;
      padding: 40px;
      background: rgba(255,255,255,0.03);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .logo {
      font-size: 3rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .tagline { color: #a1a1aa; font-size: 1.1rem; }
    .version {
      display: inline-block;
      background: rgba(102, 126, 234, 0.2);
      color: #667eea;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      margin-top: 15px;
    }
    .pricing-banner {
      display: flex;
      justify-content: center;
      gap: 40px;
      margin-top: 30px;
      flex-wrap: wrap;
    }
    .pricing-item {
      text-align: center;
      padding: 20px 30px;
      background: rgba(102, 126, 234, 0.1);
      border-radius: 12px;
      border: 1px solid rgba(102, 126, 234, 0.3);
    }
    .pricing-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #667eea;
    }
    .pricing-label { color: #a1a1aa; font-size: 0.9rem; }
    .section {
      background: rgba(255,255,255,0.03);
      border-radius: 16px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid rgba(255,255,255,0.08);
    }
    .section-title {
      font-size: 1.4rem;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section-icon {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .endpoint-grid { display: grid; gap: 12px; }
    .endpoint {
      display: flex;
      align-items: center;
      padding: 15px 20px;
      background: rgba(0,0,0,0.2);
      border-radius: 10px;
      transition: all 0.2s;
      border: 1px solid transparent;
    }
    .endpoint:hover {
      background: rgba(102, 126, 234, 0.1);
      border-color: rgba(102, 126, 234, 0.3);
      transform: translateX(5px);
    }
    .method {
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      min-width: 60px;
      text-align: center;
      margin-right: 15px;
    }
    .method.get { background: #10b981; color: #000; }
    .method.post { background: #3b82f6; color: #fff; }
    .method.delete { background: #ef4444; color: #fff; }
    .path {
      font-family: 'SF Mono', Monaco, monospace;
      color: #e4e4e7;
      flex: 1;
      font-size: 0.95rem;
    }
    .desc { color: #71717a; font-size: 0.9rem; }
    .badge {
      font-size: 0.7rem;
      padding: 3px 8px;
      border-radius: 4px;
      margin-left: 10px;
    }
    .badge.billed { background: rgba(251, 191, 36, 0.2); color: #fbbf24; }
    .badge.free { background: rgba(16, 185, 129, 0.2); color: #10b981; }
    .auth-box {
      background: rgba(0,0,0,0.3);
      border-radius: 10px;
      padding: 20px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 0.9rem;
    }
    .auth-method {
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .auth-method:last-child { border-bottom: none; }
    .auth-method code {
      background: rgba(102, 126, 234, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      color: #667eea;
    }
    .try-it {
      margin-top: 30px;
      padding: 25px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 12px;
    }
    .try-it h3 { color: #10b981; margin-bottom: 15px; }
    .try-it pre {
      background: rgba(0,0,0,0.4);
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 0.85rem;
    }
    .try-it code { color: #a5f3fc; }
    footer {
      text-align: center;
      padding: 40px;
      color: #52525b;
      font-size: 0.9rem;
    }
    @media (max-width: 768px) {
      .endpoint { flex-direction: column; align-items: flex-start; gap: 8px; }
      .method { margin-right: 0; }
      .pricing-banner { gap: 15px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Novo API</div>
      <p class="tagline">Usage-based billing API gateway with Stripe metered billing</p>
      <span class="version">v1.0.0</span>
      <div class="pricing-banner">
        <div class="pricing-item">
          <div class="pricing-value">$${config.billing.costPerCall}</div>
          <div class="pricing-label">per API call</div>
        </div>
        <div class="pricing-item">
          <div class="pricing-value">${config.billing.freeTierCalls.toLocaleString()}</div>
          <div class="pricing-label">free calls/month</div>
        </div>
        <div class="pricing-item">
          <div class="pricing-value">Monthly</div>
          <div class="pricing-label">billing period</div>
        </div>
      </div>
    </header>

    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🔑</span>
        Authentication
      </h2>
      <p style="color: #a1a1aa; margin-bottom: 15px;">Include your API key in requests using any of these methods:</p>
      <div class="auth-box">
        <div class="auth-method">Header: <code>Authorization: Bearer &lt;api_key&gt;</code></div>
        <div class="auth-method">Header: <code>X-API-Key: &lt;api_key&gt;</code></div>
        <div class="auth-method">Query: <code>?api_key=&lt;api_key&gt;</code></div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">👤</span>
        Auth Endpoints
      </h2>
      <div class="endpoint-grid">
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/auth/register</span>
          <span class="desc">Register a new user and get API key</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/auth/login</span>
          <span class="desc">Login and retrieve API keys</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/auth/api-keys</span>
          <span class="desc">Generate a new API key</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/auth/api-keys</span>
          <span class="desc">List your API keys</span>
        </div>
        <div class="endpoint">
          <span class="method delete">DEL</span>
          <span class="path">/auth/api-keys/:id</span>
          <span class="desc">Revoke an API key</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">💳</span>
        Billing Endpoints
      </h2>
      <div class="endpoint-grid">
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/billing/usage</span>
          <span class="desc">Get current usage and estimated cost</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/billing/usage/endpoints</span>
          <span class="desc">Usage breakdown by endpoint</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/billing/invoices</span>
          <span class="desc">Get invoice history</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/billing/portal</span>
          <span class="desc">Open Stripe billing portal</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/billing/subscription</span>
          <span class="desc">Get subscription details</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🚀</span>
        API Endpoints <span class="badge billed">Metered</span>
      </h2>
      <div class="endpoint-grid">
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/api/v1/health</span>
          <span class="desc">Health check</span>
          <span class="badge free">Free</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/api/v1/insights</span>
          <span class="desc">Get marketing insights</span>
          <span class="badge billed">Billed</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/api/v1/audience/analyze</span>
          <span class="desc">Analyze audience segments</span>
          <span class="badge billed">Billed</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/api/v1/campaign/generate</span>
          <span class="desc">Generate marketing campaign</span>
          <span class="badge billed">Billed</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/api/v1/notifications/send</span>
          <span class="desc">Send notifications</span>
          <span class="badge billed">Billed</span>
        </div>
        <div class="endpoint">
          <span class="method get">GET</span>
          <span class="path">/api/v1/analytics</span>
          <span class="desc">Get analytics data</span>
          <span class="badge billed">Billed</span>
        </div>
        <div class="endpoint">
          <span class="method post">POST</span>
          <span class="path">/api/v1/bulk/process</span>
          <span class="desc">Bulk data processing</span>
          <span class="badge billed">Billed</span>
        </div>
      </div>
    </div>

    <div class="try-it">
      <h3>🧪 Quick Start</h3>
      <pre><code># 1. Register and get your API key
curl -X POST http://localhost:${config.port}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email": "you@example.com", "password": "secret123", "name": "Your Name"}'

# 2. Use your API key to make requests
curl http://localhost:${config.port}/api/v1/insights \\
  -H "Authorization: Bearer YOUR_API_KEY"

# 3. Check your usage
curl http://localhost:${config.port}/billing/usage \\
  -H "Authorization: Bearer YOUR_API_KEY"</code></pre>
    </div>

    <footer>
      <p>Novo API Gateway &copy; ${new Date().getFullYear()} &bull; Powered by Stripe Metered Billing</p>
    </footer>
  </div>
</body>
</html>
  `;
  res.type('html').send(html);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `The endpoint ${req.method} ${req.path} does not exist`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           Novo API Gateway - Usage-Based Billing           ║
╠════════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                    ║
║                                                            ║
║  Endpoints:                                                ║
║  • GET  /              - API documentation                 ║
║  • POST /auth/register - Register & get API key            ║
║  • GET  /api/v1/*      - Protected API endpoints           ║
║  • GET  /billing/*     - Billing & usage info              ║
║                                                            ║
║  Usage Reporting: Every ${config.api.usageReportingInterval / 1000}s to Stripe                   ║
╚════════════════════════════════════════════════════════════╝
  `);

  // Start usage reporter
  if (config.stripe.secretKey) {
    usageReporter.start();
  } else {
    console.log('⚠️  STRIPE_SECRET_KEY not set - usage reporting disabled');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  usageReporter.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  usageReporter.stop();
  process.exit(0);
});

module.exports = app;
