const express = require('express');
const { User, ApiKey, Usage } = require('../db/models');
const config = require('../config');

const router = express.Router();

function formatDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getRelativeTime(dateStr) {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffDays < 60) return 'Over 30 days ago (or never)';
  return formatDate(dateStr);
}

// Main dashboard
router.get('/', (req, res) => {
  const users = User.getAll();
  const allKeys = [];

  users.forEach(user => {
    const keys = ApiKey.findByUserId(user.id);
    keys.forEach(key => {
      const usage = Usage.getCurrentMonthUsage(user.id);
      allKeys.push({
        ...key,
        userEmail: user.email,
        userName: user.name || 'Noverse Inc',
        callCount: usage?.total_calls || 0
      });
    });
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API keys - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #1a1a1a;
      color: #fafafa;
      min-height: 100vh;
      font-size: 14px;
    }

    .layout {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: 240px;
      background: #141414;
      border-right: 1px solid #2a2a2a;
      padding: 16px 0;
      position: fixed;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      padding: 8px 16px 24px;
      border-bottom: 1px solid #2a2a2a;
    }

    .org-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .org-selector:hover {
      background: #252525;
    }

    .org-avatar {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 12px;
      color: white;
    }

    .org-info {
      flex: 1;
      min-width: 0;
    }

    .org-name {
      font-weight: 500;
      font-size: 13px;
      color: #fafafa;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .org-type {
      font-size: 11px;
      color: #737373;
    }

    .expand-icon {
      color: #737373;
      font-size: 10px;
    }

    .nav {
      padding: 16px 8px;
      flex: 1;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      border-radius: 6px;
      color: #a3a3a3;
      text-decoration: none;
      font-size: 13px;
      margin-bottom: 2px;
      transition: all 0.15s;
    }

    .nav-item:hover {
      background: #252525;
      color: #fafafa;
    }

    .nav-item.active {
      background: #252525;
      color: #fafafa;
    }

    .nav-icon {
      width: 16px;
      text-align: center;
      opacity: 0.7;
    }

    .nav-section {
      padding: 16px 12px 8px;
      font-size: 11px;
      font-weight: 500;
      color: #525252;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Main Content */
    .main {
      flex: 1;
      margin-left: 240px;
      background: #1a1a1a;
    }

    .content {
      max-width: 1200px;
      margin: 0 auto;
      padding: 48px 32px;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 600;
      color: #fafafa;
    }

    .key-count {
      background: #2a2a2a;
      color: #a3a3a3;
      font-size: 12px;
      font-weight: 500;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .page-desc {
      color: #737373;
      font-size: 13px;
      margin-top: 8px;
      max-width: 600px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s;
      text-decoration: none;
    }

    .btn-primary {
      background: #fafafa;
      color: #171717;
      border-color: #fafafa;
    }

    .btn-primary:hover {
      background: #e5e5e5;
      border-color: #e5e5e5;
    }

    /* Table */
    .table-container {
      background: #141414;
      border-radius: 12px;
      border: 1px solid #2a2a2a;
      overflow: hidden;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    thead {
      background: #1a1a1a;
    }

    th {
      text-align: left;
      padding: 12px 16px;
      font-size: 11px;
      font-weight: 500;
      color: #737373;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #2a2a2a;
    }

    th.sortable {
      cursor: pointer;
    }

    th.sortable:hover {
      color: #a3a3a3;
    }

    .sort-icon {
      margin-left: 4px;
      opacity: 0.5;
    }

    td {
      padding: 16px;
      border-bottom: 1px solid #252525;
      vertical-align: middle;
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:hover {
      background: #1f1f1f;
    }

    .key-cell {
      min-width: 200px;
    }

    .key-name {
      font-weight: 500;
      color: #fafafa;
      margin-bottom: 4px;
    }

    .key-value {
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 12px;
      color: #737373;
    }

    .workspace-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #252525;
      border-radius: 4px;
      font-size: 12px;
      color: #a3a3a3;
    }

    .workspace-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #a78bfa;
    }

    .workspace-icon {
      font-size: 10px;
    }

    .user-cell {
      min-width: 180px;
    }

    .user-name {
      color: #fafafa;
      font-size: 13px;
    }

    .user-email {
      color: #737373;
      font-size: 12px;
    }

    .date-cell {
      color: #a3a3a3;
      font-size: 13px;
      white-space: nowrap;
    }

    .date-secondary {
      color: #525252;
      font-size: 12px;
    }

    .cost-cell {
      font-family: 'SF Mono', Monaco, monospace;
      color: #a3a3a3;
      font-size: 13px;
    }

    .actions-btn {
      background: none;
      border: none;
      color: #525252;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 16px;
      letter-spacing: 1px;
    }

    .actions-btn:hover {
      background: #252525;
      color: #a3a3a3;
    }

    .empty-state {
      text-align: center;
      padding: 64px 20px;
    }

    .empty-state h3 {
      color: #a3a3a3;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .empty-state p {
      color: #525252;
      font-size: 13px;
    }

    .info-tooltip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 1px solid #525252;
      font-size: 9px;
      color: #525252;
      margin-left: 4px;
      cursor: help;
    }

    /* Mobile Header */
    .mobile-header {
      display: none;
      background: #141414;
      border-bottom: 1px solid #2a2a2a;
      padding: 12px 16px;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 100;
    }

    .mobile-header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .mobile-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .mobile-avatar {
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 12px;
    }

    .mobile-title {
      font-weight: 500;
      font-size: 14px;
    }

    .menu-btn {
      background: none;
      border: none;
      color: #a3a3a3;
      font-size: 24px;
      cursor: pointer;
      padding: 4px;
    }

    /* Mobile Nav Overlay */
    .mobile-nav {
      display: none;
      position: fixed;
      top: 53px;
      left: 0;
      right: 0;
      bottom: 0;
      background: #141414;
      z-index: 99;
      padding: 16px;
    }

    .mobile-nav.open {
      display: block;
    }

    .mobile-nav .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      border-radius: 6px;
      color: #a3a3a3;
      text-decoration: none;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .mobile-nav .nav-item:hover,
    .mobile-nav .nav-item.active {
      background: #252525;
      color: #fafafa;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
      .mobile-header {
        display: block;
      }

      .sidebar {
        display: none;
      }

      .main {
        margin-left: 0;
        padding-top: 53px;
      }

      .content {
        padding: 20px 16px;
      }

      .page-header {
        flex-direction: column;
        gap: 16px;
      }

      .page-title {
        font-size: 18px;
      }

      .table-container {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }

      table {
        min-width: 600px;
      }

      th, td {
        padding: 12px 10px;
        font-size: 12px;
      }

      .key-cell {
        min-width: 150px;
      }

      .user-cell {
        min-width: 140px;
      }

      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <!-- Mobile Header -->
  <header class="mobile-header">
    <div class="mobile-header-content">
      <div class="mobile-logo">
        <div class="mobile-avatar">N</div>
        <span class="mobile-title">Novo API</span>
      </div>
      <button class="menu-btn" onclick="document.getElementById('mobileNav').classList.toggle('open')">☰</button>
    </div>
  </header>

  <!-- Mobile Navigation -->
  <nav id="mobileNav" class="mobile-nav">
    <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
    <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
    <a href="/dashboard/billing" class="nav-item"><span class="nav-icon">💳</span> Billing</a>
    <a href="/dashboard/usage" class="nav-item"><span class="nav-icon">📊</span> Usage</a>
    <a href="/dashboard" class="nav-item active"><span class="nav-icon">🔑</span> API keys</a>
  </nav>

  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="org-selector">
          <div class="org-avatar">N</div>
          <div class="org-info">
            <div class="org-name">Noverse Inc. sandbox</div>
            <div class="org-type">Noverse Inc.</div>
          </div>
          <span class="expand-icon">↗</span>
        </div>
      </div>

      <nav class="nav">
        <a href="/dashboard/profile" class="nav-item">
          <span class="nav-icon">👤</span> Profile
        </a>
        <a href="/" class="nav-item">
          <span class="nav-icon">🎨</span> Documentation
        </a>
        <a href="/dashboard/billing" class="nav-item">
          <span class="nav-icon">💳</span> Billing
        </a>
        <a href="/dashboard/usage" class="nav-item">
          <span class="nav-icon">📊</span> Usage
        </a>
        <a href="/dashboard" class="nav-item active">
          <span class="nav-icon">🔑</span> API keys
        </a>
      </nav>
    </aside>

    <main class="main">
      <div class="content">
        <div class="page-header">
          <div>
            <h1 class="page-title">
              API keys
              <span class="key-count">${allKeys.length}</span>
            </h1>
            <p class="page-desc">
              API keys are owned by workspaces and remain active even after the creator is removed
            </p>
          </div>
          <a href="/dashboard/create" class="btn btn-primary">
            + Create Key
          </a>
        </div>

        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>KEY</th>
                <th>WORKSPACE</th>
                <th>CREATED BY</th>
                <th class="sortable">CREATED AT <span class="sort-icon">↑</span></th>
                <th>LAST USED AT</th>
                <th>COST <span class="info-tooltip">?</span></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${allKeys.length > 0 ? allKeys.map(key => `
                <tr>
                  <td class="key-cell">
                    <div class="key-name">${key.name}</div>
                    <div class="key-value">${key.key_prefix}...${key.key_prefix.slice(-4)}</div>
                  </td>
                  <td>
                    <span class="workspace-badge">
                      <span class="workspace-dot"></span>
                      Default <span class="workspace-icon">ⓘ</span>
                    </span>
                  </td>
                  <td class="user-cell">
                    <div class="user-name">${key.userName}</div>
                    <div class="user-email">${key.userEmail}</div>
                  </td>
                  <td class="date-cell">${formatDate(key.created_at)}</td>
                  <td class="date-cell">
                    ${key.last_used_at ? formatDate(key.last_used_at) : getRelativeTime(key.last_used_at)}
                  </td>
                  <td class="cost-cell">${key.callCount > 0 ? 'USD ' + (key.callCount * config.billing.costPerCall).toFixed(2) : '—'}</td>
                  <td>
                    <button class="actions-btn">•••</button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7">
                    <div class="empty-state">
                      <h3>No API keys yet</h3>
                      <p>Create your first API key to get started</p>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
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

  if (users.length === 0) {
    return res.redirect('/dashboard?error=no_users');
  }

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create API Key - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #1a1a1a;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 440px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 24px;
    }
    .form-group { margin-bottom: 20px; }
    .form-label {
      display: block;
      font-size: 13px;
      color: #a3a3a3;
      margin-bottom: 8px;
      font-weight: 500;
    }
    .form-input, .form-select {
      width: 100%;
      padding: 10px 12px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      color: #fafafa;
      font-size: 14px;
      font-family: inherit;
    }
    .form-input:focus, .form-select:focus {
      outline: none;
      border-color: #525252;
    }
    .form-select option { background: #1a1a1a; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      width: 100%;
      margin-top: 8px;
      text-decoration: none;
      font-family: inherit;
    }
    .btn-primary { background: #fafafa; color: #171717; }
    .btn-primary:hover { background: #e5e5e5; }
    .back-link {
      display: block;
      text-align: center;
      margin-top: 16px;
      color: #737373;
      text-decoration: none;
      font-size: 13px;
    }
    .back-link:hover { color: #a3a3a3; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">Create new secret key</h1>
    <form action="/dashboard/create" method="POST">
      <div class="form-group">
        <label class="form-label">Owner</label>
        <select name="userId" class="form-select" required>
          ${users.map(u => `<option value="${u.id}">${u.name || 'User'} (${u.email})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Name</label>
        <input type="text" name="keyName" class="form-input" placeholder="My API Key" required>
      </div>
      <button type="submit" class="btn btn-primary">Create secret key</button>
    </form>
    <a href="/dashboard" class="back-link">Cancel</a>
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
  <title>Save your key - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: #1a1a1a;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      background: #141414;
      border: 1px solid #2a2a2a;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 560px;
    }
    .title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    .desc {
      color: #737373;
      font-size: 14px;
      margin-bottom: 24px;
      line-height: 1.5;
    }
    .key-container {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }
    .key-box {
      flex: 1;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      padding: 12px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
      color: #10b981;
      word-break: break-all;
    }
    .copy-btn {
      background: #252525;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      color: #a3a3a3;
      cursor: pointer;
      padding: 12px 16px;
      font-size: 14px;
    }
    .copy-btn:hover { background: #2a2a2a; color: #fafafa; }
    .warning {
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.2);
      color: #fbbf24;
      padding: 12px 16px;
      border-radius: 6px;
      font-size: 13px;
      margin-bottom: 24px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      text-decoration: none;
      font-family: inherit;
    }
    .btn-primary { background: #fafafa; color: #171717; }
    .btn-primary:hover { background: #e5e5e5; }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="title">Save your key</h1>
    <p class="desc">Please save this secret key somewhere safe and accessible. For security reasons, <strong>you won't be able to view it again</strong> through your account. If you lose this secret key, you'll need to generate a new one.</p>

    <div class="key-container">
      <div class="key-box" id="key">${apiKey.key}</div>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${apiKey.key}');this.textContent='Copied!'">Copy</button>
    </div>

    <div class="warning">
      ⚠️ This key will not be shown again. Copy it now!
    </div>

    <a href="/dashboard" class="btn btn-primary" style="width: 100%;">Done</a>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Profile page
router.get('/profile', (req, res) => {
  const users = User.getAll();
  const totalUsers = users.length;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Profile - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #1a1a1a; color: #fafafa; min-height: 100vh; font-size: 14px; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 240px; background: #141414; border-right: 1px solid #2a2a2a; padding: 16px 0; position: fixed; height: 100vh; }
    .sidebar-header { padding: 8px 16px 24px; border-bottom: 1px solid #2a2a2a; }
    .org-selector { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
    .org-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; }
    .org-name { font-weight: 500; font-size: 13px; }
    .org-type { font-size: 11px; color: #737373; }
    .nav { padding: 16px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; color: #a3a3a3; text-decoration: none; font-size: 13px; margin-bottom: 2px; }
    .nav-item:hover { background: #252525; color: #fafafa; }
    .nav-item.active { background: #252525; color: #fafafa; }
    .nav-icon { width: 16px; text-align: center; opacity: 0.7; }
    .main { flex: 1; margin-left: 240px; }
    .content { max-width: 800px; margin: 0 auto; padding: 48px 32px; }
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 32px; }
    .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
    .card-title { font-size: 14px; font-weight: 600; margin-bottom: 16px; color: #a3a3a3; }
    .profile-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
    .profile-avatar { width: 64px; height: 64px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 24px; }
    .profile-info h2 { font-size: 18px; font-weight: 600; }
    .profile-info p { color: #737373; font-size: 13px; margin-top: 4px; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #252525; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #737373; }
    .info-value { color: #fafafa; font-weight: 500; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge-green { background: rgba(16, 185, 129, 0.2); color: #10b981; }
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
      .content { padding: 20px 16px; }
      .page-title { font-size: 18px; }
      .profile-header { flex-direction: column; text-align: center; }
      .info-row { flex-direction: column; gap: 4px; }
      .info-label { font-size: 12px; }
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
    <a href="/dashboard/profile" class="nav-item active"><span class="nav-icon">👤</span> Profile</a>
    <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
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
        <a href="/dashboard/profile" class="nav-item active"><span class="nav-icon">👤</span> Profile</a>
        <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
        <a href="/dashboard/billing" class="nav-item"><span class="nav-icon">💳</span> Billing</a>
        <a href="/dashboard/usage" class="nav-item"><span class="nav-icon">📊</span> Usage</a>
        <a href="/dashboard" class="nav-item"><span class="nav-icon">🔑</span> API keys</a>
      </nav>
    </aside>
    <main class="main">
      <div class="content">
        <h1 class="page-title">Profile</h1>

        <div class="card">
          <div class="profile-header">
            <div class="profile-avatar">N</div>
            <div class="profile-info">
              <h2>Noverse Inc.</h2>
              <p>API Provider Account</p>
            </div>
          </div>
          <div class="info-row">
            <span class="info-label">Account Type</span>
            <span class="badge badge-green">Sandbox</span>
          </div>
          <div class="info-row">
            <span class="info-label">Total Users</span>
            <span class="info-value">${totalUsers}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Billing Model</span>
            <span class="info-value">Usage-based (Metered)</span>
          </div>
          <div class="info-row">
            <span class="info-label">Price per API Call</span>
            <span class="info-value">$${config.billing.costPerCall}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Free Tier</span>
            <span class="info-value">${config.billing.freeTierCalls.toLocaleString()} calls/month</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Stripe Integration</div>
          <div class="info-row">
            <span class="info-label">Product ID</span>
            <span class="info-value" style="font-family: monospace; font-size: 12px;">${config.stripe.productId || 'Not configured'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Price ID</span>
            <span class="info-value" style="font-family: monospace; font-size: 12px;">${config.stripe.priceId || 'Not configured'}</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Billing page
router.get('/billing', (req, res) => {
  const usageData = Usage.getTotalUsageStats();
  const totalCalls = usageData.reduce((sum, u) => sum + (u.total_calls || 0), 0);
  const billableCalls = Math.max(0, totalCalls - (config.billing.freeTierCalls * usageData.length));
  const totalRevenue = billableCalls * config.billing.costPerCall;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Billing - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #1a1a1a; color: #fafafa; min-height: 100vh; font-size: 14px; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 240px; background: #141414; border-right: 1px solid #2a2a2a; padding: 16px 0; position: fixed; height: 100vh; }
    .sidebar-header { padding: 8px 16px 24px; border-bottom: 1px solid #2a2a2a; }
    .org-selector { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
    .org-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; }
    .org-name { font-weight: 500; font-size: 13px; }
    .org-type { font-size: 11px; color: #737373; }
    .nav { padding: 16px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; color: #a3a3a3; text-decoration: none; font-size: 13px; margin-bottom: 2px; }
    .nav-item:hover { background: #252525; color: #fafafa; }
    .nav-item.active { background: #252525; color: #fafafa; }
    .nav-icon { width: 16px; text-align: center; opacity: 0.7; }
    .main { flex: 1; margin-left: 240px; }
    .content { max-width: 900px; margin: 0 auto; padding: 48px 32px; }
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 32px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; }
    .stat-label { font-size: 12px; color: #737373; margin-bottom: 8px; text-transform: uppercase; }
    .stat-value { font-size: 28px; font-weight: 600; }
    .stat-value.green { color: #10b981; }
    .card { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 24px; margin-bottom: 16px; }
    .card-title { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
    .info-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #252525; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #737373; }
    .info-value { color: #fafafa; }
    .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; text-decoration: none; border: none; cursor: pointer; }
    .btn-primary { background: #fafafa; color: #171717; }
    .btn-primary:hover { background: #e5e5e5; }
    .btn-outline { background: transparent; border: 1px solid #2a2a2a; color: #a3a3a3; }
    .btn-outline:hover { border-color: #525252; color: #fafafa; }
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
      .content { padding: 20px 16px; }
      .page-title { font-size: 18px; }
      .stats-grid { grid-template-columns: 1fr; }
      .stat-value { font-size: 24px; }
      .info-row { flex-direction: column; gap: 4px; }
      .btn { width: 100%; justify-content: center; }
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
    <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
    <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
    <a href="/dashboard/billing" class="nav-item active"><span class="nav-icon">💳</span> Billing</a>
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
        <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
        <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
        <a href="/dashboard/billing" class="nav-item active"><span class="nav-icon">💳</span> Billing</a>
        <a href="/dashboard/usage" class="nav-item"><span class="nav-icon">📊</span> Usage</a>
        <a href="/dashboard" class="nav-item"><span class="nav-icon">🔑</span> API keys</a>
      </nav>
    </aside>
    <main class="main">
      <div class="content">
        <h1 class="page-title">Billing</h1>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Revenue</div>
            <div class="stat-value green">$${totalRevenue.toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Billable Calls</div>
            <div class="stat-value">${billableCalls.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Paying Customers</div>
            <div class="stat-value">${usageData.filter(u => (u.total_calls || 0) > config.billing.freeTierCalls).length}</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Pricing Configuration</div>
          <div class="info-row">
            <span class="info-label">Cost per API Call</span>
            <span class="info-value">$${config.billing.costPerCall}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Free Tier (per user)</span>
            <span class="info-value">${config.billing.freeTierCalls.toLocaleString()} calls/month</span>
          </div>
          <div class="info-row">
            <span class="info-label">Billing Cycle</span>
            <span class="info-value">Monthly</span>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Stripe Dashboard</div>
          <p style="color: #737373; margin-bottom: 16px;">Manage invoices, payouts, and customer payments in Stripe.</p>
          <a href="https://dashboard.stripe.com/test/payments" target="_blank" class="btn btn-primary">Open Stripe Dashboard ↗</a>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

// Usage page
router.get('/usage', (req, res) => {
  const usageData = Usage.getTotalUsageStats();
  const totalCalls = usageData.reduce((sum, u) => sum + (u.total_calls || 0), 0);
  const totalCost = totalCalls * config.billing.costPerCall;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Usage - Novo API</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: #1a1a1a; color: #fafafa; min-height: 100vh; font-size: 14px; }
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 240px; background: #141414; border-right: 1px solid #2a2a2a; padding: 16px 0; position: fixed; height: 100vh; }
    .sidebar-header { padding: 8px 16px 24px; border-bottom: 1px solid #2a2a2a; }
    .org-selector { display: flex; align-items: center; gap: 12px; padding: 8px 12px; }
    .org-avatar { width: 28px; height: 28px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 12px; }
    .org-name { font-weight: 500; font-size: 13px; }
    .org-type { font-size: 11px; color: #737373; }
    .nav { padding: 16px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 6px; color: #a3a3a3; text-decoration: none; font-size: 13px; margin-bottom: 2px; }
    .nav-item:hover { background: #252525; color: #fafafa; }
    .nav-item.active { background: #252525; color: #fafafa; }
    .nav-icon { width: 16px; text-align: center; opacity: 0.7; }
    .main { flex: 1; margin-left: 240px; }
    .content { max-width: 1200px; margin: 0 auto; padding: 48px 32px; }
    .page-title { font-size: 20px; font-weight: 600; margin-bottom: 32px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #141414; border: 1px solid #2a2a2a; border-radius: 8px; padding: 20px; }
    .stat-label { font-size: 12px; color: #737373; margin-bottom: 8px; }
    .stat-value { font-size: 28px; font-weight: 600; }
    .stat-value.highlight { color: #10b981; }
    .table-container { background: #141414; border-radius: 8px; border: 1px solid #2a2a2a; overflow: hidden; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; font-weight: 500; color: #737373; text-transform: uppercase; background: #1a1a1a; border-bottom: 1px solid #2a2a2a; }
    td { padding: 16px; border-bottom: 1px solid #252525; }
    tr:last-child td { border-bottom: none; }
    .calls { font-family: 'SF Mono', Monaco, monospace; color: #10b981; font-weight: 500; }
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
      .content { padding: 20px 16px; }
      .page-title { font-size: 18px; }
      .stats-grid { grid-template-columns: 1fr; }
      .stat-value { font-size: 24px; }
      .table-container { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      table { min-width: 400px; }
      th, td { padding: 12px 10px; font-size: 12px; }
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
    <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
    <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
    <a href="/dashboard/billing" class="nav-item"><span class="nav-icon">💳</span> Billing</a>
    <a href="/dashboard/usage" class="nav-item active"><span class="nav-icon">📊</span> Usage</a>
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
        <a href="/dashboard/profile" class="nav-item"><span class="nav-icon">👤</span> Profile</a>
        <a href="/" class="nav-item"><span class="nav-icon">🎨</span> Documentation</a>
        <a href="/dashboard/billing" class="nav-item"><span class="nav-icon">💳</span> Billing</a>
        <a href="/dashboard/usage" class="nav-item active"><span class="nav-icon">📊</span> Usage</a>
        <a href="/dashboard" class="nav-item"><span class="nav-icon">🔑</span> API keys</a>
      </nav>
    </aside>
    <main class="main">
      <div class="content">
        <h1 class="page-title">Usage</h1>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">TOTAL API CALLS</div>
            <div class="stat-value">${totalCalls.toLocaleString()}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">TOTAL COST</div>
            <div class="stat-value highlight">$${totalCost.toFixed(2)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">ACTIVE USERS</div>
            <div class="stat-value">${usageData.length}</div>
          </div>
        </div>

        <div class="table-container">
          <table>
            <thead><tr><th>USER</th><th>STATUS</th><th>API CALLS</th><th>COST</th></tr></thead>
            <tbody>
              ${usageData.length > 0 ? usageData.map(u => `
                <tr>
                  <td>${u.email}</td>
                  <td>${u.subscription_status || 'active'}</td>
                  <td><span class="calls">${(u.total_calls || 0).toLocaleString()}</span></td>
                  <td>$${((u.total_calls || 0) * config.billing.costPerCall).toFixed(4)}</td>
                </tr>
              `).join('') : '<tr><td colspan="4" style="text-align:center;padding:40px;color:#737373;">No usage data yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`;
  res.type('html').send(html);
});

module.exports = router;
