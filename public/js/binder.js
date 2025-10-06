import { PLACEHOLDERS } from './placeholders.js';

const DEFAULT_FALLBACK = '—';
const TEXT_TEMPLATES = new WeakMap();
const LIST_INFO = new WeakMap();
const VIEW_CACHE = new Map();
const MODAL_CACHE = new Map();
const VIEW_PARAMS = new Map();
const HEARTBEAT_INTERVAL_MS = 30000;

let heartbeatTimer = null;
let binderReady = null;

function normalizeParams(params) {
  if (!params || typeof params !== 'object') return {};
  const normalized = {};
  Object.entries(params).forEach(([key, value]) => {
    const trimmedKey = typeof key === 'string' ? key.trim() : String(key || '').trim();
    if (!trimmedKey) return;
    if (value == null) return;
    let strValue;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return;
      strValue = String(value);
    } else {
      strValue = String(value).trim();
      if (!strValue) return;
    }
    normalized[trimmedKey] = strValue;
  });
  return normalized;
}

function paramsToKey(params) {
  const keys = Object.keys(params || {});
  if (!keys.length) return '';
  keys.sort();
  return keys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
}

function getRawViewParams(viewId) {
  return VIEW_PARAMS.get(viewId) || {};
}

function getClonedViewParams(viewId) {
  const raw = getRawViewParams(viewId);
  return { ...raw };
}

function clearViewCache(viewId) {
  if (!viewId) return;
  const prefix = `${viewId}|`;
  for (const key of Array.from(VIEW_CACHE.keys())) {
    if (key.startsWith(prefix)) {
      VIEW_CACHE.delete(key);
    }
  }
}

function setViewParamsInternal(viewId, params) {
  if (!viewId) return {};
  const normalized = normalizeParams(params);
  const prevKey = paramsToKey(getRawViewParams(viewId));
  const nextKey = paramsToKey(normalized);
  VIEW_PARAMS.set(viewId, normalized);
  if (prevKey !== nextKey) {
    clearViewCache(viewId);
  }
  return normalized;
}

function buildCacheKey(viewId, params) {
  const suffix = paramsToKey(params);
  return `${viewId}|${suffix}`;
}

function emitViewData(viewId, data) {
  if (typeof window === 'undefined' || !viewId) return;
  try {
    window.dispatchEvent(new CustomEvent('binder:view-data', { detail: { viewId, data } }));
  } catch (err) {
    // ignore notification errors
  }
}

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
      warned: false,
    };
    LIST_INFO.set(el, info);
  }
  return info;
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
  const keyAttr = (el.getAttribute('data-list') || '').trim() || null;
  if (info.key !== keyAttr) {
    info.key = keyAttr;
    info.warned = false;
  }
  info.template = el.getAttribute('data-template') || null;
  info.empty = el.getAttribute('data-empty') || null;
  if (!info.key) return;

  const items = resolvePath(data, info.key);
  if (!Array.isArray(items)) {
    if (!info.warned) {
      console.warn(`[binder] Expected array for list "${info.key}"`, items);
      info.warned = true;
    }

    const fragment = document.createDocumentFragment();
    const emptyText = info.empty;
    if (emptyText) {
      const p = document.createElement('p');
      p.className = 'opt dim';
      p.textContent = emptyText;
      fragment.appendChild(p);
    }
    el.innerHTML = '';
    if (fragment.childNodes.length) {
      el.appendChild(fragment);
    }
    return;
  }

  info.warned = false;

  const fragment = document.createDocumentFragment();
  if (items.length === 0) {
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

async function fetchViewData(viewId, overrideParams) {
  const params = overrideParams ? setViewParamsInternal(viewId, overrideParams) : getRawViewParams(viewId);
  const cacheKey = buildCacheKey(viewId, params);
  if (!VIEW_CACHE.has(cacheKey)) {
    const query = paramsToKey(params);
    const url = query ? `/api/view/${viewId}?${query}` : `/api/view/${viewId}`;
    const promise = fetch(url)
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch((err) => {
        console.error('Failed to load view data', viewId, err);
        return null;
      });
    VIEW_CACHE.set(cacheKey, promise);
  }
  return VIEW_CACHE.get(cacheKey);
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
  root.querySelectorAll('[data-list]').forEach((el) => {
    renderList(el, data);
  });
}

async function bindViewElement(el) {
  const id = el.id ? el.id.replace(/^view-/, '') : '';
  if (!id) return;
  const data = await fetchViewData(id);
  if (!data) return;
  bindInto(el, data, { view: id });
  emitViewData(id, data);
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
    clearViewCache(id);
    const el = document.getElementById(`view-${id}`);
    if (!el) return;
    const data = await fetchViewData(id);
    if (!data) return;
    bindInto(el, data, { view: id });
    emitViewData(id, data);
  },
  setViewParams(viewId, params) {
    if (!viewId) return;
    setViewParamsInternal(viewId, params);
  },
  getViewParams(viewId) {
    if (!viewId) return {};
    return getClonedViewParams(viewId);
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
