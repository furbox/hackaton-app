/**
 * Auth module — handles email/password login and session token storage.
 * @module auth
 */

import { login } from './api.js';
import * as storage from './storage.js';

/**
 * Initialize the auth view.
 * Attaches submit handler to #auth-form.
 * On success, calls onSuccess({ apiKey, userEmail }).
 * On failure (wrong credentials, network error, etc.), calls onError() so the
 * caller can reset any auth-in-progress guards.
 *
 * @param {Function} onSuccess - Callback called after successful auth
 * @param {Function} [onError]  - Callback called after a failed auth attempt
 */
export function initAuth(onSuccess, onError) {
  const form          = document.getElementById('auth-form');
  const emailInput    = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');
  const errorDiv      = document.getElementById('auth-error');
  const submitBtn     = document.getElementById('auth-submit-btn');

  if (!form) return;

  // Clear any previous state
  _clearError(errorDiv);
  if (emailInput)    emailInput.value    = '';
  if (passwordInput) passwordInput.value = '';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    _clearError(errorDiv);

    const email    = emailInput?.value?.trim()   ?? '';
    const password = passwordInput?.value         ?? '';

    // 1. Basic client-side validation
    if (!email || !password) {
      showAuthError('Completá email y contraseña.', errorDiv);
      return;
    }

    // 2. Disable button and show loading state
    if (submitBtn) {
      submitBtn.disabled    = true;
      submitBtn.textContent = 'Conectando...';
    }

    try {
      // 3. Login against backend POST /api/auth/login
      const result = await login(email, password);

      // Better Auth retorna { token, user } en el body
      const token = result?.token;
      const user  = result?.user;

      if (!token) {
        throw new Error('Respuesta inválida del servidor.');
      }

      // 4. Persist session token in storage as "apiKey" (compatibility)
      await storage.set({
        apiKey:        token,
        userEmail:     user?.email ?? email,
        lastValidated: new Date().toISOString(),
      });

      // 5. Notify parent
      onSuccess({ apiKey: token, userEmail: user?.email ?? email });

    } catch (err) {
      if (err.code === 'UNAUTHORIZED' || err.status === 401) {
        showAuthError('Email o contraseña incorrectos.', errorDiv);
      } else if (err.code === 'RATE_LIMIT') {
        showAuthError('Demasiados intentos. Esperá unos segundos.', errorDiv);
      } else {
        showAuthError(
          `Error al conectar: ${err.message || 'Revisá tu conexión.'}`,
          errorDiv
        );
      }
      // Notify the caller so it can reset any auth-in-progress guards.
      // The user is still on the auth screen and can retry.
      onError?.();
    } finally {
      if (submitBtn) {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Iniciar sesión';
      }
    }
  });
}

/**
 * Show an error message in the auth view.
 *
 * @param {string} msg - Error message to display
 * @param {HTMLElement} [errorEl] - Target element (defaults to #auth-error)
 */
export function showAuthError(msg, errorEl) {
  const el = errorEl || document.getElementById('auth-error');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

/** @private */
function _clearError(el) {
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}
