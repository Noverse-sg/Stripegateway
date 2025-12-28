const express = require('express');
const { User, ApiKey, Usage } = require('../db/models');
const config = require('../config');

const router = express.Router();

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Dashboard - shows all API keys directly
router.get('/', (req, res) => {
  const users = User.getAll();
  const allKeys = [];

  users.forEach(user => {
    const keys = ApiKey.findByUserId(user.id);
    keys.forEach(key => {
      allKeys.push({ ...key, userEmail: user.email, userName: user.name });
    });
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Keys - Novo API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e4e4e7; min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 260px; background: #141414; border-right: 1px solid #262626; padding: 20px 0; position: fixed; height: 100vh; }
    .org-header { padding: 15px 20px; border-bottom: 1px solid #262626; margin-bottom: 10px; }
    .org-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px; vertical-align: middle; }
    .org-name { font-weight: 600; font-size: 0.95rem; }
    .org-type { font-size: 0.8rem; color: #71717a; margin-top: 4px; }
    .nav-item { display: flex; align-items: center; padding: 12px 20px; color: #a1a1aa; text-decoration: none; }
    .nav-item:hover { background: #1f1f1f; color: #e4e4e7; }
    .nav-item.active { background: #1f1f1f; color: #fff; border-left: 2px solid #667eea; }
    .nav-icon { margin-right: 12px; }
    .main { flex: 1; margin-left: 260px; padding: 40px; }
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .page-title { font-size: 1.5rem; font-weight: 600; display: flex; align-items: center; gap: 12px; }
    .key-count { background: #262626; color: #a1a1aa; font-size: 0.85rem; padding: 4px 10px; border-radius: 20px; }
    .page-desc { color: #71717a; margin-top: 8px; font-size: 0.9rem; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; font-size: 0.9rem; font-weight: 500; cursor: pointer; border: none; text-decoration: none; }
    .btn-primary { background: #fff; color: #000; }
    .btn-primary:hover { background: #e4e4e7; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 20px; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #fff; }
    .stat-label { color: #71717a; font-size: 0.85rem; margin-top: 5px; }
    .stat-card.highlight { background: linear-gradient(135deg, rgba(102,126,234,0.1) 0%, rgba(118,75,162,0.1) 100%); border-color: rgba(102,126,234,0.3); }
    .stat-card.highlight .stat-value { color: #667eea; }
    .table-container { background: #141414; border-radius: 12px; border: 1px solid #262626; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 14px 20px; font-size: 0.75rem; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em; background: #1a1a1a; border-bottom: 1px solid #262626; }
    td { padding: 16px 20px; border-bottom: 1px solid #1f1f1f; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: #1a1a1a; }
    .key-name { font-weight: 500; color: #fff; margin-bottom: 4px; }
    .key-value { font-family: 'SF Mono', Monaco, monospace; font-size: 0.8rem; color: #71717a; }
    .workspace-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; background: #262626; border-radius: 6px; font-size: 0.8rem; }
    .workspace-dot { width: 8px; height: 8px; border-radius: 50%; background: #667eea; }
    .user-name { color: #e4e4e7; font-size: 0.85rem; }
    .user-email { color: #71717a; font-size: 0.8rem; }
    .date { color: #a1a1aa; font-size: 0.85rem; }
    .status-active { color: #10b981; }
    .status-revoked { color: #ef4444; }
    .empty-state { text-align: center; padding: 60px 20px; color: #71717a; }
    .actions-btn { background: none; border: none; color: #71717a; cursor: pointer; padding: 8px; border-radius: 6px; }
    .actions-btn:hover { background: #262626; color: #fff; }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="org-header">
        <span class="org-icon">N</span>
        <span class="org-name">Novo API</span>
        <div class="org-type">API Gateway</div>
      </div>
      <nav>
        <a class="nav-item" href="/"><span class="nav-icon">📖</span> Documentation</a>
        <a class="nav-item active" href="/dashboard"><span class="nav-icon">🔑</span> API Keys</a>
        <a class="nav-item" href="/dashboard/usage"><span class="nav-icon">📊</span> Usage</a>
      </nav>
    </aside>

    <main class="main">
      <div class="stats-grid">
        <div class="stat-card highlight">
          <div class="stat-value">${allKeys.length}</div>
          <div class="stat-label">Total API Keys</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${allKeys.filter(k => k.is_active).length}</div>
          <div class="stat-label">Active Keys</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">$${config.billing.costPerCall}</div>
          <div class="stat-label">Per API Call</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${config.billing.freeTierCalls.toLocaleString()}</div>
          <div class="stat-label">Free Calls/Month</div>
        </div>
      </div>

      <div class="page-header">
        <div>
          <h1 class="page-title">API Keys <span class="key-count">${allKeys.length}</span></h1>
          <p class="page-desc">API keys are owned by workspaces and remain active even after the creator is removed</p>
        </div>
        <a href="/dashboard/create" class="btn btn-primary"><span>+</span> Create Key</a>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Workspace</th>
              <th>Created By</th>
              <th>Created At</th>
              <th>Last Used At</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${allKeys.length > 0 ? allKeys.map(key => `
              <tr>
                <td>
                  <div class="key-name">${key.name}</div>
                  <div class="key-value">${key.key_prefix}...****</div>
                </td>
                <td><span class="workspace-badge"><span class="workspace-dot"></span> Default</span></td>
                <td>
                  <div class="user-name">${key.userName || 'User'}</div>
                  <div class="user-email">${key.userEmail}</div>
                </td>
                <td><div class="date">${formatDate(key.created_at)}</div></td>
                <td><div class="date">${key.last_used_at ? formatDate(key.last_used_at) : '— (never)'}</div></td>
                <td><span class="${key.is_active ? 'status-active' : 'status-revoked'}">● ${key.is_active ? 'Active' : 'Revoked'}</span></td>
                <td><button class="actions-btn">•••</button></td>
              </tr>
            `).join('') : `
              <tr><td colspan="7"><div class="empty-state"><h3>No API keys yet</h3><p>Create your first API key to get started</p></div></td></tr>
            `}
          </tbody>
        </table>
      </div>
    </main>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Create key page
router.get('/create', (req, res) => {
  const users = User.getAll();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create API Key - Novo API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e4e4e7; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: #141414; border: 1px solid #262626; border-radius: 16px; padding: 40px; width: 100%; max-width: 500px; }
    .title { font-size: 1.5rem; font-weight: 600; margin-bottom: 30px; text-align: center; }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; font-size: 0.85rem; color: #a1a1aa; margin-bottom: 8px; }
    .form-input, .form-select { width: 100%; padding: 12px 15px; background: #0a0a0a; border: 1px solid #262626; border-radius: 8px; color: #fff; font-size: 0.95rem; }
    .form-input:focus, .form-select:focus { outline: none; border-color: #667eea; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 20px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; border: none; width: 100%; margin-top: 10px; text-decoration: none; }
    .btn-primary { background: #fff; color: #000; }
    .btn-primary:hover { background: #e4e4e7; }
    .back-link { display: block; text-align: center; margin-top: 20px; color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">Create New API Key</h1>
    <form action="/dashboard/create" method="POST">
      <div class="form-group">
        <label class="form-label">Select User</label>
        <select name="userId" class="form-select" required>
          ${users.map(u => `<option value="${u.id}">${u.email}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Key Name</label>
        <input type="text" name="keyName" class="form-input" placeholder="e.g., Production, Development" required>
      </div>
      <button type="submit" class="btn btn-primary">Create Key</button>
    </form>
    <a href="/dashboard" class="back-link">← Back to Dashboard</a>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Handle create key
router.post('/create', (req, res) => {
  const { userId, keyName } = req.body;
  const apiKey = ApiKey.generate(parseInt(userId), keyName || 'API Key');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Key Created - Novo API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e4e4e7; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { background: #141414; border: 1px solid #262626; border-radius: 16px; padding: 40px; width: 100%; max-width: 600px; text-align: center; }
    .icon { font-size: 3rem; margin-bottom: 20px; }
    .title { font-size: 1.5rem; font-weight: 600; margin-bottom: 10px; }
    .key-box { background: #0a0a0a; border: 1px solid #262626; border-radius: 8px; padding: 20px; font-family: 'SF Mono', Monaco, monospace; font-size: 0.85rem; word-break: break-all; margin: 20px 0; color: #10b981; }
    .warning { background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); color: #fbbf24; padding: 15px; border-radius: 8px; font-size: 0.9rem; margin-bottom: 20px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; border-radius: 8px; font-size: 0.95rem; font-weight: 500; cursor: pointer; border: none; text-decoration: none; margin: 5px; }
    .btn-primary { background: #667eea; color: #fff; }
    .btn-secondary { background: #262626; color: #e4e4e7; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">🔑</div>
    <h1 class="title">API Key Created!</h1>
    <div class="key-box" id="key">${apiKey.key}</div>
    <div class="warning">⚠️ Copy this key now! It will never be shown again.</div>
    <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${apiKey.key}');alert('Copied!')">📋 Copy</button>
    <a href="/dashboard" class="btn btn-secondary">Done</a>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Usage page
router.get('/usage', (req, res) => {
  const usageData = Usage.getTotalUsageStats();
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Usage - Novo API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #e4e4e7; min-height: 100vh; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 260px; background: #141414; border-right: 1px solid #262626; padding: 20px 0; position: fixed; height: 100vh; }
    .org-header { padding: 15px 20px; border-bottom: 1px solid #262626; margin-bottom: 10px; }
    .org-icon { width: 32px; height: 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; font-weight: 600; margin-right: 12px; }
    .org-name { font-weight: 600; }
    .org-type { font-size: 0.8rem; color: #71717a; margin-top: 4px; }
    .nav-item { display: flex; align-items: center; padding: 12px 20px; color: #a1a1aa; text-decoration: none; }
    .nav-item:hover { background: #1f1f1f; color: #e4e4e7; }
    .nav-item.active { background: #1f1f1f; color: #fff; border-left: 2px solid #667eea; }
    .nav-icon { margin-right: 12px; }
    .main { flex: 1; margin-left: 260px; padding: 40px; }
    .page-title { font-size: 1.5rem; font-weight: 600; margin-bottom: 30px; }
    .table-container { background: #141414; border-radius: 12px; border: 1px solid #262626; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 14px 20px; font-size: 0.75rem; font-weight: 600; color: #71717a; text-transform: uppercase; background: #1a1a1a; border-bottom: 1px solid #262626; }
    td { padding: 16px 20px; border-bottom: 1px solid #1f1f1f; }
    tr:last-child td { border-bottom: none; }
    tr:hover { background: #1a1a1a; }
    .calls { font-family: 'SF Mono', Monaco, monospace; color: #667eea; font-weight: 600; }
  </style>
</head>
<body>
  <div class="layout">
    <aside class="sidebar">
      <div class="org-header">
        <span class="org-icon">N</span>
        <span class="org-name">Novo API</span>
        <div class="org-type">API Gateway</div>
      </div>
      <nav>
        <a class="nav-item" href="/"><span class="nav-icon">📖</span> Documentation</a>
        <a class="nav-item" href="/dashboard"><span class="nav-icon">🔑</span> API Keys</a>
        <a class="nav-item active" href="/dashboard/usage"><span class="nav-icon">📊</span> Usage</a>
      </nav>
    </aside>
    <main class="main">
      <h1 class="page-title">Usage Statistics</h1>
      <div class="table-container">
        <table>
          <thead><tr><th>User</th><th>Status</th><th>Total API Calls</th><th>Last Call</th></tr></thead>
          <tbody>
            ${usageData.length > 0 ? usageData.map(u => `
              <tr>
                <td>${u.email}</td>
                <td>${u.subscription_status || 'active'}</td>
                <td><span class="calls">${u.total_calls || 0}</span></td>
                <td>${u.last_call ? formatDate(u.last_call) : '—'}</td>
              </tr>
            `).join('') : '<tr><td colspan="4" style="text-align:center;padding:40px;color:#71717a;">No usage data yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </main>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

module.exports = router;
