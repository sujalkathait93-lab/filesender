/**
 * FileShare Cookie & Session Data Purge Utility
 * Primary Responsibility: Manage automatic and user-triggered purging of session cookies,
 * temporary storage keys, decrypted blob URLs, and expired client-side cache.
 */

/**
 * Remove all cookies accessible via document.cookie
 */
export function purgeAllCookies() {
  if (typeof document === 'undefined') return;
  try {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;SameSite=Strict`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname};SameSite=Strict`;
      }
    }
  } catch (err) {
    console.warn('Could not clear cookies:', err);
  }
}

/**
 * Clean up expired session storage entries and revoked memory object URLs
 */
export function cleanupExpiredSessionData(activeObjectUrls = []) {
  if (typeof window === 'undefined') return;

  // Revoke active object URLs passed in
  if (Array.isArray(activeObjectUrls)) {
    activeObjectUrls.forEach((url) => {
      try {
        if (url && url.startsWith('blob:')) {
          window.URL.revokeObjectURL(url);
        }
      } catch (_) {}
    });
  }

  // Clear expired sessionStorage owner tokens
  try {
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('fs_owner_') || key.startsWith('fs_blob_') || key.startsWith('fileshare_temp_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch (_) {}
}

/**
 * Full user-requested purge of all local storage, session storage, and cookies
 */
export function purgeAllUserStorage() {
  if (typeof window === 'undefined') return { success: false };
  try {
    purgeAllCookies();
    sessionStorage.clear();
    // Keep theme preference if desired, but clear all transfer records and temporary tokens
    const savedTheme = localStorage.getItem('fileshare_theme');
    localStorage.clear();
    if (savedTheme) {
      localStorage.setItem('fileshare_theme', savedTheme);
    }
    return { success: true, message: 'All cookies, session data, and temporary files have been permanently cleared.' };
  } catch (err) {
    return { success: false, message: err.message || 'Failed to clear local storage.' };
  }
}
