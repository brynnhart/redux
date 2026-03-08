/* client/js/auth.js */

'use strict';

// ── Tab switching ────────────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab, .panel').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab + '-panel').classList.add('active');
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function showError(elId, msg) {
  const el = document.getElementById(elId);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearError(elId) {
  const el = document.getElementById(elId);
  el.textContent = '';
  el.classList.add('hidden');
}

function saveToken(token) {
  sessionStorage.setItem('lord_token', token);
}

// ── Redirect if already logged in ────────────────────────────────────────────

if (sessionStorage.getItem('lord_token')) {
  window.location.href = 'game.html';
}

// ── Login ─────────────────────────────────────────────────────────────────────

document.getElementById('login-btn').addEventListener('click', async () => {
  clearError('login-error');
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;

  if (!username || !password) {
    showError('login-error', 'Please enter username and password.');
    return;
  }

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError('login-error', data.error || 'Login failed.');
      return;
    }
    saveToken(data.token);
    window.location.href = 'game.html';
  } catch {
    showError('login-error', 'Server error. Please try again.');
  }
});

// Submit on Enter
document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// ── Register ──────────────────────────────────────────────────────────────────

document.getElementById('reg-btn').addEventListener('click', async () => {
  clearError('reg-error');
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const confirm  = document.getElementById('reg-confirm').value;

  if (!username || !password) {
    showError('reg-error', 'Please fill in all fields.');
    return;
  }
  if (password !== confirm) {
    showError('reg-error', 'Passwords do not match.');
    return;
  }
  if (password.length < 6) {
    showError('reg-error', 'Password must be at least 6 characters.');
    return;
  }

  try {
    const res  = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      showError('reg-error', data.error || 'Registration failed.');
      return;
    }
    saveToken(data.token);
    window.location.href = 'game.html';
  } catch {
    showError('reg-error', 'Server error. Please try again.');
  }
});
