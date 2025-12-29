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

// API documentation endpoint - HTML page with sidebar
app.get('/', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Documentation - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #1a1a1a; color: #fafafa; min-height: 100vh; font-size: 14px; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 240px; background: #141414; border-right: 1px solid #2a2a2a; padding: 16px 0; position: fixed; height: 100vh; display: flex; flex-direction: column; }
    .sidebar-header { padding: 8px 16px 24px; border-bottom: 1px solid #2a2a2a; }
    .org-selector { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
    .org-selector:hover { background: #252525; }
    .org-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; }
    .org-name { font-weight: 500; font-size: 13px; }
    .org-type { font-size: 11px; color: #737373; }
    .nav { padding: 16px 8px; flex: 1; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; color: #a3a3a3; text-decoration: none; font-size: 13px; margin-bottom: 2px; }
    .nav-item:hover { background: #252525; color: #fafafa; }
    .nav-item.active { background: #252525; color: #fafafa; }
    .nav-icon { width: 16px; text-align: center; opacity: 0.7; }
    .main { flex: 1; margin-left: 240px; }
    .content { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 8px; }
    .page-desc { color: #737373; font-size: 13px; margin-bottom: 32px; }
    .pricing-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 40px; }
    .pricing-card { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; text-align: center; }
    .pricing-value { font-size: 24px; font-weight: 600; color: #10b981; }
    .pricing-label { font-size: 12px; color: #737373; margin-top: 4px; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 14px; font-weight: 600; color: #fafafa; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
    .section-icon { font-size: 16px; }
    .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; margin-bottom: 12px; }
    .card-title { font-size: 13px; font-weight: 500; margin-bottom: 12px; color: #a3a3a3; }
    .auth-method { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #252525; font-size: 13px; }
    .auth-method:last-child { border-bottom: none; }
    .auth-label { color: #737373; width: 60px; }
    .auth-code { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #10b981; background: #1f1f1f; padding: 4px 8px; border-radius: 4px; }
    .endpoint-list { display: flex; flex-direction: column; gap: 8px; }
    .endpoint { display: flex; align-items: center; padding: 12px 16px; background: #1a1a1a; border-radius: 6px; border: 1px solid #252525; }
    .endpoint:hover { border-color: #3a3a3a; }
    .method { font-family: 'SF Mono', Monaco, monospace; font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 4px; margin-right: 12px; min-width: 50px; text-align: center; }
    .method.get { background: #10b981; color: #000; }
    .method.post { background: #3b82f6; color: #fff; }
    .method.delete { background: #ef4444; color: #fff; }
    .endpoint-path { font-family: 'SF Mono', Monaco, monospace; font-size: 13px; color: #fafafa; flex: 1; }
    .endpoint-desc { font-size: 12px; color: #737373; }
    .badge { font-size: 10px; padding: 2px 6px; border-radius: 3px; margin-left: 8px; }
    .badge.billed { background: rgba(251,191,36,0.2); color: #fbbf24; }
    .badge.free { background: rgba(16,185,129,0.2); color: #10b981; }
    .code-block { background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 8px; padding: 16px; margin-top: 12px; overflow-x: auto; }
    .code-block code { font-family: 'SF Mono', Monaco, monospace; font-size: 12px; color: #a3a3a3; white-space: pre; }
    .code-block .cmd { color: #10b981; }
    .code-block .flag { color: #f59e0b; }
    .code-block .string { color: #60a5fa; }
    .mobile-header { display: none; background: #141414; border-bottom: 1px solid #2a2a2a; padding: 12px 16px; position: fixed; top: 0; left: 0; right: 0; z-index: 100; }
    .mobile-header-content { display: flex; align-items: center; justify-content: space-between; }
    .mobile-logo { display: flex; align-items: center; gap: 10px; }
    .mobile-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; }
    .mobile-title { font-weight: 500; font-size: 14px; }
    .menu-btn { background: none; border: none; color: #a3a3a3; font-size: 24px; cursor: pointer; padding: 4px; }
    .mobile-nav { display: none; position: fixed; top: 53px; left: 0; right: 0; bottom: 0; background: #141414; z-index: 99; padding: 16px; }
    .mobile-nav.open { display: block; }
    .mobile-nav .nav-item { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 6px; color: #a3a3a3; text-decoration: none; font-size: 14px; margin-bottom: 4px; }
    .mobile-nav .nav-item:hover, .mobile-nav .nav-item.active { background: #252525; color: #fafafa; }
    @media (max-width: 768px) {
      .mobile-header { display: block; }
      .sidebar { display: none; }
      .main { margin-left: 0; padding-top: 53px; }
      .layout { display: block; }
      .content { padding: 16px 12px; max-width: 100%; }
      .page-title { font-size: 16px; margin-bottom: 4px; }
      .page-desc { font-size: 12px; margin-bottom: 20px; }
      .pricing-grid { grid-template-columns: 1fr; gap: 10px; margin-bottom: 24px; }
      .pricing-card { padding: 14px; }
      .pricing-value { font-size: 18px; }
      .pricing-label { font-size: 11px; }
      .section { margin-bottom: 20px; }
      .section-title { font-size: 13px; margin-bottom: 10px; }
      .card { padding: 14px; margin-bottom: 8px; }
      .card-title { font-size: 12px; margin-bottom: 8px; }
      .endpoint-list { gap: 6px; }
      .endpoint { flex-direction: column; align-items: flex-start; gap: 6px; padding: 10px; }
      .method { margin-right: 0; margin-bottom: 4px; }
      .endpoint-path { font-size: 11px; width: 100%; word-break: break-all; }
      .endpoint-desc { font-size: 11px; }
      .badge { margin-left: 0; margin-top: 4px; }
      .code-block { padding: 10px; margin-top: 8px; }
      .code-block code { font-size: 9px; line-height: 1.4; }
      .auth-method { flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 0; }
      .auth-label { width: auto; font-size: 11px; }
      .auth-code { font-size: 9px; word-break: break-all; padding: 3px 6px; }
    }
  </style>
</head>
<body>
  <header class="mobile-header">
    <div class="mobile-header-content">
      <div class="mobile-logo"><div class="mobile-avatar">N</div><span class="mobile-title">Novo API</span></div>
      <button class="menu-btn" onclick="document.getElementById('mobileNav').classList.toggle('open')">☰</button>
    </div>
  </header>
  <nav id="mobileNav" class="mobile-nav">
    <a href="/" class="nav-item active"><span class="nav-icon">📖</span> Documentation</a>
    <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
    <a href="/dashboard/billing" class="nav-item"><span class="nav-icon">💳</span> Billing</a>
    <a href="/dashboard/usage" class="nav-item"><span class="nav-icon">📊</span> Usage</a>
    <a href="/dashboard" class="nav-item"><span class="nav-icon">🔑</span> API keys</a>
  </nav>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="org-selector">
          <div class="org-avatar">N</div>
          <div>
            <div class="org-name">Noverse Inc. sandbox</div>
            <div class="org-type">Noverse Inc.</div>
          </div>
        </div>
      </div>
      <nav class="nav">
        <a href="/" class="nav-item active"><span class="nav-icon">📖</span> Documentation</a>
        <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
        <a href="/dashboard/billing" class="nav-item"><span class="nav-icon">💳</span> Billing</a>
        <a href="/dashboard/usage" class="nav-item"><span class="nav-icon">📊</span> Usage</a>
        <a href="/dashboard" class="nav-item"><span class="nav-icon">🔑</span> API keys</a>
      </nav>
    </aside>

    <main class="main">
      <div class="content">
        <h1 class="page-title">Novo API Documentation</h1>
        <p class="page-desc">Usage-based billing API gateway with Stripe metered billing</p>

        <div class="pricing-grid">
          <div class="pricing-card">
            <div class="pricing-value">$${config.billing.costPerCall}</div>
            <div class="pricing-label">per API call</div>
          </div>
          <div class="pricing-card">
            <div class="pricing-value">${config.billing.freeTierCalls.toLocaleString()}</div>
            <div class="pricing-label">free calls/month</div>
          </div>
          <div class="pricing-card">
            <div class="pricing-value">Monthly</div>
            <div class="pricing-label">billing period</div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><span class="section-icon">🔐</span> Authentication</h2>
          <div class="card">
            <div class="card-title">Include your API key in requests</div>
            <div class="auth-method">
              <span class="auth-label">Header</span>
              <code class="auth-code">Authorization: Bearer &lt;api_key&gt;</code>
            </div>
            <div class="auth-method">
              <span class="auth-label">Header</span>
              <code class="auth-code">X-API-Key: &lt;api_key&gt;</code>
            </div>
            <div class="auth-method">
              <span class="auth-label">Query</span>
              <code class="auth-code">?api_key=&lt;api_key&gt;</code>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><span class="section-icon">👤</span> Auth Endpoints</h2>
          <div class="endpoint-list">
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="endpoint-path">/auth/register</span>
              <span class="endpoint-desc">Register and get API key</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="endpoint-path">/auth/login</span>
              <span class="endpoint-desc">Login</span>
            </div>
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="endpoint-path">/auth/api-keys</span>
              <span class="endpoint-desc">List API keys</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><span class="section-icon">🚀</span> API Endpoints</h2>
          <div class="endpoint-list">
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/insights</span>
              <span class="endpoint-desc">Marketing insights</span>
              <span class="badge billed">Billed</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/v1/audience/analyze</span>
              <span class="endpoint-desc">Analyze audience</span>
              <span class="badge billed">Billed</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="endpoint-path">/api/v1/campaign/generate</span>
              <span class="endpoint-desc">Generate campaign</span>
              <span class="badge billed">Billed</span>
            </div>
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/analytics</span>
              <span class="endpoint-desc">Analytics data</span>
              <span class="badge billed">Billed</span>
            </div>
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="endpoint-path">/api/v1/health</span>
              <span class="endpoint-desc">Health check</span>
              <span class="badge free">Free</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><span class="section-icon">💳</span> Billing Endpoints</h2>
          <div class="endpoint-list">
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="endpoint-path">/billing/usage</span>
              <span class="endpoint-desc">Current usage & cost</span>
            </div>
            <div class="endpoint">
              <span class="method get">GET</span>
              <span class="endpoint-path">/billing/invoices</span>
              <span class="endpoint-desc">Invoice history</span>
            </div>
            <div class="endpoint">
              <span class="method post">POST</span>
              <span class="endpoint-path">/billing/portal</span>
              <span class="endpoint-desc">Stripe billing portal</span>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title"><span class="section-icon">⚡</span> Quick Start</h2>
          <div class="code-block">
            <code><span class="cmd"># 1. Register and get your API key</span>
curl -X POST http://localhost:${config.port}/auth/register \\
  <span class="flag">-H</span> <span class="string">"Content-Type: application/json"</span> \\
  <span class="flag">-d</span> <span class="string">'{"email": "you@example.com", "password": "secret", "name": "Your Name"}'</span>

<span class="cmd"># 2. Make API requests</span>
curl http://localhost:${config.port}/api/v1/insights \\
  <span class="flag">-H</span> <span class="string">"Authorization: Bearer YOUR_API_KEY"</span>

<span class="cmd"># 3. Check your usage</span>
curl http://localhost:${config.port}/billing/usage \\
  <span class="flag">-H</span> <span class="string">"Authorization: Bearer YOUR_API_KEY"</span></code>
          </div>
        </div>
      </div>
    </main>
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
