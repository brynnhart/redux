import { PLACEHOLDERS } from './placeholders.js';

const DEFAULT_FALLBACK = '—';
const TEXT_TEMPLATES = new WeakMap();
const LIST_INFO = new WeakMap();
const VIEW_CACHE = new Map();
const MODAL_CACHE = new Map();
const HEARTBEAT_INTERVAL_MS = 30000;

let heartbeatTimer = null;
let binderReady = null;

const PLACEHOLDER_MAPS = new Map();
for (const [scope, mapping] of Object.entries(PLACEHOLDERS || {})) {
  const map = new Map();
  Object.entries(mapping || {}).forEach(([token, path]) => {
    const key = token.trim();
    if (!key) return;
    map.set(key, path);
    map.set(key.toLowerCase(), path);
  });
  PLACEHOLDER_MAPS.set(scope, map);
}

function resolvePath(source, path) {
  if (!source || !path) return undefined;
  const parts = path.split('.').map((part) => part.trim()).filter(Boolean);
  let cursor = source;
  for (const part of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function formatValue(value) {
  if (value == null) return DEFAULT_FALLBACK;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : DEFAULT_FALLBACK;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

function getScopeKey(viewId, modalId) {
  if (modalId) {
    const combined = `${viewId}.${modalId}`;
    if (PLACEHOLDER_MAPS.has(combined)) return combined;
  }
  return viewId;
}

function lookupPath(scopeKey, token) {
  if (!token) return null;
  const trimmed = token.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  const scopeMap = PLACEHOLDER_MAPS.get(scopeKey);
  let path = scopeMap?.get(trimmed) ?? scopeMap?.get(lower);
  if (!path) {
    const shared = PLACEHOLDER_MAPS.get('__shared');
    path = shared?.get(trimmed) ?? shared?.get(lower) ?? null;
  }
  return path || null;
}

function attemptResolve(token, data) {
  if (!data) return undefined;
  const normalized = token.toLowerCase();
  if (normalized.startsWith('player ')) {
    const words = normalized.replace(/^player\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
    const last = words[words.length - 1];
    if (!last) return undefined;
    const fieldCandidates = [last, `${last}_left`, `${last}_per_day`, `${last}Left`];
    for (const candidate of fieldCandidates) {
      const direct = resolvePath(data, `character.${candidate}`);
      if (direct !== undefined) return direct;
      const stats = resolvePath(data, `stats.${candidate}`);
      if (stats !== undefined) return stats;
    }
  }
  return undefined;
}

function replaceTextPlaceholders(root, data, scopeKey) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.includes('{') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  const replacements = [];
  while (true) {
    const node = walker.nextNode();
    if (!node) break;
    let template = TEXT_TEMPLATES.get(node);
    if (template === undefined) {
      template = node.nodeValue;
      TEXT_TEMPLATES.set(node, template);
    }
    const updated = template.replace(/\{([^{}]+)\}/g, (match, rawToken) => {
      const token = rawToken.trim();
      if (!token) return match;
      const path = lookupPath(scopeKey, token);
      let value = path ? resolvePath(data, path) : undefined;
      if (value === undefined) {
        value = attemptResolve(token, data);
      }
      if (value === undefined) return DEFAULT_FALLBACK;
      return formatValue(value);
    });
    replacements.push({ node, value: updated });
  }

  replacements.forEach(({ node, value }) => {
    node.nodeValue = value;
  });
}

function getListInfo(el) {
  let info = LIST_INFO.get(el);
  if (!info) {
    info = {
      key: (el.getAttribute('data-list') || '').trim() || null,
      template: el.getAttribute('data-template') || null,
      empty: el.getAttribute('data-empty') || null,
    };
    LIST_INFO.set(el, info);
  }
  return info;
}

function findFirstArrayCandidate(data) {
  const seen = new Set();
  const queue = [{ value: data, path: [] }];
  while (queue.length) {
    const { value, path } = queue.shift();
    if (!value || typeof value !== 'object') continue;
    if (seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      return { items: value, path: path.join('.') };
    }
    for (const [key, next] of Object.entries(value)) {
      if (Array.isArray(next)) {
        return { items: next, path: [...path, key].join('.') };
      }
      if (next && typeof next === 'object') {
        queue.push({ value: next, path: [...path, key] });
      }
    }
  }
  return null;
}

function renderTemplate(template, item, index, data) {
  return template.replace(/\{([^{}]+)\}/g, (match, rawToken) => {
    const token = rawToken.trim();
    if (!token) return match;
    if (token === 'index') return String(index);
    if (token === 'number') return String(index + 1);
    let value = resolvePath(item, token);
    if (value === undefined) {
      value = resolvePath(data, token);
    }
    if (value === undefined) {
      value = attemptResolve(token, item) ?? attemptResolve(token, data);
    }
    if (value === undefined) return DEFAULT_FALLBACK;
    return formatValue(value);
  });
}

function stringifyItem(item) {
  if (item == null) return DEFAULT_FALLBACK;
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item);
  }
  if (typeof item === 'object') {
    if ('text' in item && typeof item.text === 'string') {
      const kind = 'kind' in item ? `(${item.kind}) ` : '';
      return `${kind}${item.text}`;
    }
    return Object.entries(item)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  return String(item);
}

function renderList(el, data) {
  const info = getListInfo(el);
  let items = info.key ? resolvePath(data, info.key) : undefined;
  if (!Array.isArray(items)) {
    const fallback = findFirstArrayCandidate(data);
    if (fallback && Array.isArray(fallback.items)) {
      items = fallback.items;
      if (!info.key) {
        info.key = fallback.path || null;
      }
    }
  }

  const fragment = document.createDocumentFragment();
  if (!Array.isArray(items) || items.length === 0) {
    const emptyText = info.empty;
    if (emptyText) {
      const p = document.createElement('p');
      p.className = 'opt dim';
      p.textContent = emptyText;
      fragment.appendChild(p);
    }
    el.innerHTML = '';
    el.appendChild(fragment);
    return;
  }

  const template = info.template || null;
  items.forEach((item, index) => {
    let html;
    if (template) {
      html = renderTemplate(template, item, index, data);
    } else {
      const p = document.createElement('p');
      p.className = 'opt';
      p.textContent = `• ${stringifyItem(item)}`;
      fragment.appendChild(p);
      return;
    }
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    while (wrapper.firstChild) {
      fragment.appendChild(wrapper.firstChild);
    }
  });

  el.innerHTML = '';
  el.appendChild(fragment);
}

async function fetchViewData(viewId) {
  if (!VIEW_CACHE.has(viewId)) {
    const promise = fetch(`/api/view/${viewId}`)
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch((err) => {
        console.error('Failed to load view data', viewId, err);
        return null;
      });
    VIEW_CACHE.set(viewId, promise);
  }
  return VIEW_CACHE.get(viewId);
}

async function fetchModalData(viewId, modalId) {
  const key = `${viewId}:${modalId}`;
  if (!MODAL_CACHE.has(key)) {
    const promise = fetch(`/api/modal/${viewId}/${modalId}`)
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch((err) => {
        console.error('Failed to load modal data', viewId, modalId, err);
        return null;
      });
    MODAL_CACHE.set(key, promise);
  }
  return MODAL_CACHE.get(key);
}

function resolveElement(target) {
  if (!target) return null;
  if (target instanceof Element) return target;
  if (typeof target === 'string') {
    return document.querySelector(target);
  }
  return null;
}

function inferScope(el, options = {}) {
  let viewId = options.view || null;
  let modalId = options.modal || null;

  if (!viewId) {
    const attr = typeof el.getAttribute === 'function' ? el.getAttribute('data-view') : null;
    if (attr) {
      viewId = attr;
    } else if (el.id && el.id.startsWith('view-')) {
      viewId = el.id.replace(/^view-/, '');
    }
  }

  if (!modalId && typeof el.getAttribute === 'function') {
    const attr = el.getAttribute('data-modal');
    if (attr) {
      modalId = attr;
    }
  }

  const scopeKey = options.scope || (viewId ? getScopeKey(viewId, modalId) : null);
  return { viewId, modalId, scopeKey };
}

function bindInto(target, data, options = {}) {
  if (!data) return;
  const el = resolveElement(target);
  if (!el) return;
  const { scopeKey } = inferScope(el, options);
  const scope = scopeKey || '__shared';
  applyBinding(el, data, scope);
}

function applyBinding(root, data, scopeKey) {
  if (!data) return;
  replaceTextPlaceholders(root, data, scopeKey);
  root.querySelectorAll('[data-list], .list[data-list], .list-placeholder').forEach((el) => {
    renderList(el, data);
  });
  // Fallback: any element whose text is a bracketed placeholder
  root.querySelectorAll('*').forEach((el) => {
    if (el.children.length > 0) return;
    const text = el.textContent ? el.textContent.trim() : '';
    if (!text || !text.startsWith('[') || !text.endsWith(']')) return;
    if (!LIST_INFO.has(el)) {
      el.setAttribute('data-list', el.getAttribute('data-list') || '');
      renderList(el, data);
    }
  });
}

async function bindViewElement(el) {
  const id = el.id ? el.id.replace(/^view-/, '') : '';
  if (!id) return;
  const data = await fetchViewData(id);
  if (!data) return;
  bindInto(el, data, { view: id });
}

async function bindModalElement(el) {
  const viewId = el.getAttribute('data-view');
  const modalId = el.getAttribute('data-modal');
  if (!viewId || !modalId) return;
  const data = await fetchModalData(viewId, modalId);
  if (!data) return;
  bindInto(el, data, { view: viewId, modal: modalId });
}

function observeActivations() {
  const elements = document.querySelectorAll('.view, .modal__panel');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type !== 'attributes' || mutation.attributeName !== 'class') return;
      const target = mutation.target;
      if (target.classList.contains('view') && target.classList.contains('active')) {
        bindViewElement(target);
      }
      if (target.classList.contains('modal__panel') && target.classList.contains('active')) {
        bindModalElement(target);
      }
    });
  });
  elements.forEach((el) => {
    observer.observe(el, { attributes: true, attributeFilter: ['class'] });
    if (el.classList.contains('view') && el.classList.contains('active')) {
      bindViewElement(el);
    }
    if (el.classList.contains('modal__panel') && el.classList.contains('active')) {
      bindModalElement(el);
    }
  });
}

async function sendHeartbeat() {
  try {
    const response = await fetch('/api/presence/heartbeat', { method: 'POST' });
    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    if (binderReady) {
      binderReady.then((api) => {
        api?.refreshView?.('people');
      });
    }
  } catch (error) {
    console.error('Failed to send presence heartbeat', error);
  }
}

function startHeartbeatScheduler() {
  if (heartbeatTimer != null) return;
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
}

function initializeBinder() {
  observeActivations();
  startHeartbeatScheduler();
}

const binderApi = {
  bindInto,
  fetchView: fetchViewData,
  fetchModal: fetchModalData,
  async refreshView(id) {
    if (!id) return;
    VIEW_CACHE.delete(id);
    const el = document.getElementById(`view-${id}`);
    if (!el) return;
    const data = await fetchViewData(id);
    if (!data) return;
    bindInto(el, data, { view: id });
  },
};

window.BINDER = binderApi;
binderReady = Promise.resolve(binderApi);
window.BINDER_READY = binderReady;
window.dispatchEvent(new CustomEvent('binder:ready', { detail: binderApi }));

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBinder);
} else {
  initializeBinder();
}
