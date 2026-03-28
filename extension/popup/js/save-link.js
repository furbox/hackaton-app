/**
 * Save Link module — handles the "Guardar" tab.
 * Extracts metadata from the active tab, checks for duplicates,
 * loads categories, and submits to POST /api/links.
 * @module save-link
 */

import { lookupLink, createLink, getCategories, createCategory } from './api.js';
import * as storage from './storage.js';
import { showToast, generateShortCode } from './utils.js';
import { emitUnauthorized } from './app.js';

// Track whether this tab was already initialized
let _initialized = false;

/**
 * Initialize the save-link tab.
 * Safe to call multiple times — re-runs on each tab activation.
 *
 * @param {{ apiKey: string|null, userEmail: string|null }} state
 */
export function initSaveLink(state) {
  // Always reset so each tab activation is fresh
  _initialized = false;
  _init(state);
}

async function _init(state) {
  if (_initialized) return;
  _initialized = true;

  const form          = document.getElementById('save-link-form');
  const urlInput      = document.getElementById('link-url');
  const titleInput    = document.getElementById('link-title');
  const descInput     = document.getElementById('link-description');
  const catSelect     = document.getElementById('link-category');
  const publicCheck   = document.getElementById('link-public');
  const saveBtn       = document.getElementById('save-submit-btn');
  const saveError     = document.getElementById('save-error');
  const dupWarning    = document.getElementById('duplicate-warning');
  const dupTitle      = document.getElementById('dup-link-title');
  const dupCategory   = document.getElementById('dup-link-category');
  const dupViewBtn    = document.getElementById('dup-view-btn');
  const dupCancelBtn  = document.getElementById('dup-cancel-btn');
  const newCatBtn     = document.getElementById('new-category-btn');
  const newCatForm    = document.getElementById('new-category-form');
  const catNameInput  = document.getElementById('cat-name');
  const catCreateBtn  = document.getElementById('cat-create-btn');
  const catCancelBtn  = document.getElementById('cat-cancel-btn');
  const catError      = document.getElementById('cat-error');
  const colorSwatches = document.getElementById('color-swatches');

  // Reset visibility
  if (form)       form.classList.remove('hidden');
  if (dupWarning) dupWarning.classList.add('hidden');
  if (newCatForm) newCatForm.classList.add('hidden');
  _hideError(saveError);

  // Step 1: Get active tab metadata
  let currentTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    if (urlInput)   _setReadonly(urlInput,   tab.url   || '');
    if (titleInput) titleInput.value = tab.title || '';

    // Step 2: Extract meta description via scripting
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const meta = document.querySelector('meta[name="description"]');
          return meta?.getAttribute('content') ?? '';
        },
      });
      if (descInput) descInput.value = results?.[0]?.result || '';
    } catch {
      // Restricted page (chrome://, extensions, etc.) — silently ignore
      if (descInput) descInput.value = '';
    }

    // Step 3: Duplicate check
    if (tab.url) {
      await _checkDuplicate(tab.url, state, {
        form, dupWarning, dupTitle, dupCategory, dupViewBtn,
      });
    }
  } catch (err) {
    console.warn('[URLoft] Could not read active tab:', err);
  }

  // Step 4: Load categories
  await _loadCategories(state, catSelect);

  // ── Cancel duplicate ────────────────────────────────────────────
  dupCancelBtn?.addEventListener('click', () => {
    if (dupWarning) dupWarning.classList.add('hidden');
    if (form)       form.classList.remove('hidden');
  });

  // ── New category toggle ─────────────────────────────────────────
  newCatBtn?.addEventListener('click', () => {
    if (newCatForm) {
      newCatForm.classList.toggle('hidden');
      if (!newCatForm.classList.contains('hidden')) {
        catNameInput?.focus();
      }
    }
  });

  catCancelBtn?.addEventListener('click', () => {
    if (newCatForm) newCatForm.classList.add('hidden');
    _hideError(catError);
  });

  // ── Color swatch selection ──────────────────────────────────────
  let selectedColor = '#ef4444';
  colorSwatches?.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      colorSwatches.querySelectorAll('.color-swatch').forEach(s =>
        s.classList.remove('color-swatch--selected')
      );
      swatch.classList.add('color-swatch--selected');
      selectedColor = swatch.dataset.color;
    });
  });

  // ── Create category ────────────────────────────────────────────
  catCreateBtn?.addEventListener('click', async () => {
    _hideError(catError);
    const name = catNameInput?.value?.trim() || '';
    if (!name) {
      _showError(catError, 'Ingresá un nombre para la categoría.');
      return;
    }

    catCreateBtn.disabled = true;
    catCreateBtn.textContent = 'Creando...';

    try {
      const res = await createCategory({ name, color: selectedColor }, state.apiKey);
      const newCat = res?.data?.category || res?.category || res;

      if (newCat?.id) {
        // Add to select and auto-select
        const opt = document.createElement('option');
        opt.value = String(newCat.id);
        opt.textContent = newCat.name;
        catSelect?.appendChild(opt);
        if (catSelect) catSelect.value = String(newCat.id);
      }

      if (newCatForm) newCatForm.classList.add('hidden');
      if (catNameInput) catNameInput.value = '';
      showToast('Categoría creada ✓', 'success');
    } catch (err) {
      _handleApiError(err, catError, 'Error al crear la categoría.');
    } finally {
      if (catCreateBtn) {
        catCreateBtn.disabled = false;
        catCreateBtn.textContent = 'Crear';
      }
    }
  });

  // ── Form submit ─────────────────────────────────────────────────
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    _hideError(saveError);

    const url         = urlInput?.value?.trim()  || '';
    const title       = titleInput?.value?.trim() || '';
    const description = descInput?.value?.trim()  || null;
    const categoryId  = catSelect?.value ? parseInt(catSelect.value, 10) : null;
    const isPublic    = publicCheck?.checked ?? true;

    if (!url || !title) {
      _showError(saveError, 'URL y título son obligatorios.');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
    }

    try {
      const shortCode = generateShortCode(url);
      await createLink({ url, title, shortCode, description, categoryId, isPublic }, state.apiKey);

      // Increment badge counter
      await _incrementBadge();

      showToast('¡Link guardado! 🎉', 'success');

      // Reset form
      if (titleInput)  titleInput.value  = '';
      if (descInput)   descInput.value   = '';
      if (catSelect)   catSelect.value   = '';
      if (publicCheck) publicCheck.checked = true;

    } catch (err) {
      if (err.status === 409) {
        _showError(saveError, 'Ya existe este link.');
      } else {
        _handleApiError(err, saveError, 'Error al guardar el link. Intentá de nuevo.');
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Guardar Link';
      }
    }
  });
}

// ── Duplicate check ────────────────────────────────────────────────
async function _checkDuplicate(url, state, els) {
  const { form, dupWarning, dupTitle, dupCategory, dupViewBtn } = els;
  try {
    const res = await lookupLink(url, state.apiKey);

    const link = res?.data?.link ?? null;

    if (link) {
      // Show duplicate warning, hide form
      if (dupTitle) {
        dupTitle.textContent = '';
        dupTitle.textContent = link.title || 'Sin título';
      }
      if (dupCategory) {
        dupCategory.textContent = '';
        dupCategory.textContent = link.category?.name || 'Sin categoría';
      }
      if (dupViewBtn && link.shortCode) {
        dupViewBtn.href = `http://localhost:3000/api/s/${link.shortCode}`;
      } else if (dupViewBtn) {
        dupViewBtn.href = link.url || '#';
      }
      if (form)       form.classList.add('hidden');
      if (dupWarning) dupWarning.classList.remove('hidden');
    }
  } catch {
    // Silently proceed — duplicate check is best-effort.
    // A 401 here means the endpoint doesn't support API Key auth;
    // don't treat it as an expired session.
  }
}

// ── Load categories ────────────────────────────────────────────────
async function _loadCategories(state, select) {
  if (!select) return;
  try {
    const res = await getCategories(state.apiKey);
    // Backend returns { data: CategoryWithLinksCountDTO[] }
    // data is the array directly — NOT { data: { categories: [...] } }
    const cats = Array.isArray(res?.data) ? res.data : (res?.data?.categories || []);

    // Clear existing non-default options
    while (select.options.length > 1) select.remove(1);

    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = String(cat.id);
      opt.textContent = cat.name;
      select.appendChild(opt);
    });
  } catch (err) {
    // Log for debug — categories are optional so we don't break the UI.
    console.error('[URLoft] _loadCategories error:', err?.message || err);
  }
}

// ── Badge counter ──────────────────────────────────────────────────
async function _incrementBadge() {
  const stored = await storage.get(['stats']);
  const today  = new Date().toISOString().split('T')[0];
  const stats  = stored.stats || { linksAddedToday: 0, lastResetDate: '' };

  if (stats.lastResetDate !== today) {
    stats.linksAddedToday = 0;
    stats.lastResetDate   = today;
  }

  stats.linksAddedToday++;
  await storage.set({ stats });

  // Notify background service worker
  try {
    chrome.runtime.sendMessage({ type: 'UPDATE_BADGE' });
  } catch {
    // Silently ignore if SW is not ready
  }
}

// ── Helpers ────────────────────────────────────────────────────────
function _setReadonly(input, value) {
  input.value = value;
}

function _showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function _hideError(el) {
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

function _handleApiError(err, el, fallbackMsg) {
  if (err.code === 'UNAUTHORIZED') {
    emitUnauthorized();
    return;
  }
  if (err.code === 'RATE_LIMIT') {
    _showError(el, err.message || 'Demasiadas solicitudes. Esperá un momento.');
    return;
  }
  _showError(el, err.message || fallbackMsg);
}
