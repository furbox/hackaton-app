/**
 * Search module — "Mis Links" tab.
 * Loads, searches, sorts, and paginates visible links via GET /api/links.
 * @module search
 */

import { getLinks, getCategories } from './api.js';
import { showToast, formatDate, debounce } from './utils.js';
import { emitUnauthorized } from './app.js';

// Module-level state
let _state        = null;
let _currentPage  = 1;
let _hasMore      = false;
let _loading      = false;
let _initialized  = false;
const _categoriesById = new Map();
const SEARCH_LIMIT = 20;

/**
 * Initialize the search tab.
 * Safe to call on every tab activation — re-populates from scratch.
 *
 * @param {{ apiKey: string|null }} state
 */
export function initSearch(state) {
  _state = state;
  _currentPage = 1;
  _hasMore     = false;
  _loading     = false;
  _initialized = false;
  _categoriesById.clear();
  _setup();
}

async function _setup() {
  if (_initialized) return;
  _initialized = true;

  const searchInput    = document.getElementById('search-input');
  const sortSelect     = document.getElementById('search-sort');
  const categorySelect = document.getElementById('search-category');
  const loadMoreBtn    = document.getElementById('load-more-btn');

  // Load categories into filter dropdown
  await _loadCategoryFilter(categorySelect);

  // Initial load
  await _fetchLinks({ replace: true });

  // Debounced search
  const debouncedSearch = debounce(() => {
    _currentPage = 1;
    _fetchLinks({ replace: true });
  }, 300);

  searchInput?.addEventListener('input', debouncedSearch);

  // Sort / Category filter change
  sortSelect?.addEventListener('change', () => {
    _currentPage = 1;
    _fetchLinks({ replace: true });
  });

  categorySelect?.addEventListener('change', () => {
    _currentPage = 1;
    _fetchLinks({ replace: true });
  });

  // Load more
  loadMoreBtn?.addEventListener('click', () => {
    if (_hasMore && !_loading) {
      _currentPage++;
      _fetchLinks({ replace: false });
    }
  });
}

async function _fetchLinks({ replace = true } = {}) {
  if (_loading) return;
  _loading = true;
  _setLoading(true);

  const searchInput    = document.getElementById('search-input');
  const sortSelect     = document.getElementById('search-sort');
  const categorySelect = document.getElementById('search-category');
  const searchList     = document.getElementById('search-list');
  const searchEmpty    = document.getElementById('search-empty');
  const loadMoreCont   = document.getElementById('load-more-container');
  const searchEnd      = document.getElementById('search-end');

  const q          = searchInput?.value?.trim()    || undefined;
  const sort       = sortSelect?.value             || 'recent';
  const categoryId = categorySelect?.value ? parseInt(categorySelect.value, 10) : undefined;

  try {
    const res = await getLinks(
      { q, sort, categoryId, page: _currentPage, limit: SEARCH_LIMIT },
      _state?.apiKey
    );

    const links = Array.isArray(res?.data?.items) ? res.data.items : [];
    _hasMore = links.length === SEARCH_LIMIT;

    if (replace && searchList) {
      searchList.innerHTML = '';
    }

    if (links.length === 0 && _currentPage === 1) {
      if (searchEmpty) {
        searchEmpty.classList.remove('hidden');
        const msg = q
          ? 'No encontraste nada para tu búsqueda.'
          : 'No encontraste nada. ¡Empezá a guardar links!';
        searchEmpty.querySelector('p').textContent = msg;
      }
      if (loadMoreCont) loadMoreCont.classList.add('hidden');
      if (searchEnd)    searchEnd.classList.add('hidden');
    } else {
      if (searchEmpty) searchEmpty.classList.add('hidden');

      links.forEach(link => {
        const card = _renderLinkCard(link);
        searchList?.appendChild(card);
      });

      // Pagination controls
      if (_hasMore) {
        if (loadMoreCont) loadMoreCont.classList.remove('hidden');
        if (searchEnd)    searchEnd.classList.add('hidden');
      } else {
        if (loadMoreCont) loadMoreCont.classList.add('hidden');
        if (_currentPage > 1 && searchEnd) {
          searchEnd.classList.remove('hidden');
        } else if (searchEnd) {
          searchEnd.classList.add('hidden');
        }
      }
    }

  } catch (err) {
    if (err.code === 'UNAUTHORIZED') {
      // 401 — session token expired or invalid. Let the global handler take over.
      emitUnauthorized();
      return;
    }
    showToast('Error al cargar links. Revisá tu conexión.', 'error');
  } finally {
    _loading = false;
    _setLoading(false);
  }
}

function _renderLinkCard(link) {
  const card = document.createElement('div');
  card.className = 'link-card';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');

  // Title
  const title = document.createElement('span');
  title.className = 'link-card__title';
  title.textContent = link.title || 'Sin título';

  // URL
  const url = document.createElement('span');
  url.className = 'link-card__url';
  try {
    url.textContent = new URL(link.url).hostname;
  } catch {
    url.textContent = link.url || '';
  }

  // Meta (date + category)
  const meta = document.createElement('div');
  meta.className = 'link-card__meta';

  const date = document.createElement('span');
  date.className = 'link-card__date';
  date.textContent = formatDate(link.createdAt);
  meta.appendChild(date);

  const category = link.category
    || (Number.isInteger(link.categoryId) ? _categoriesById.get(link.categoryId) : null);

  if (category) {
    const badge = document.createElement('span');
    badge.className = 'category-badge';
    badge.style.background = category.color || '#6366f1';
    badge.textContent = category.name;
    meta.appendChild(badge);
  }

  card.appendChild(title);
  card.appendChild(url);
  card.appendChild(meta);

  // Open in new tab on click
  const openUrl = link.url;
  const handleOpen = () => {
    chrome.tabs.create({ url: openUrl });
  };

  card.addEventListener('click', handleOpen);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') handleOpen();
  });

  return card;
}

async function _loadCategoryFilter(select) {
  if (!select) return;
  try {
    const res = await getCategories(_state?.apiKey);
    const cats = Array.isArray(res?.data)
      ? res.data
      : (res?.data?.categories || []);

    // Keep first option ("Todas")
    while (select.options.length > 1) select.remove(1);

    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = String(cat.id);
      opt.textContent = cat.name;
      select.appendChild(opt);
      _categoriesById.set(cat.id, { name: cat.name, color: cat.color });
    });
  } catch (err) {
    console.error('[URLoft] _loadCategoryFilter error:', err);
    // Silently ignore — filter categories are optional
  }
}

function _setLoading(on) {
  const loadingEl = document.getElementById('search-loading');
  if (loadingEl) loadingEl.classList.toggle('hidden', !on);
}
