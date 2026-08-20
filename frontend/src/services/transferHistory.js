/**
 * FileShare Sender Transfer History Service
 * Primary Responsibility: Manage client-side storage of active transfers sent from this device.
 * Stores metadata (fileId, transferCode, filename, size, expiry, maxDownloads, ownerToken)
 * so sender can monitor remaining downloads, live expiry, and cancel transfers anytime.
 */

const STORAGE_KEY = 'fileshare_sender_history';
const MAX_HISTORY_ITEMS = 20;

/**
 * Get all stored transfer history records, filtering out items older than 24 hours
 */
export function getSenderHistory() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return [];

    const now = Date.now();
    // Keep items created within the last 24h
    const valid = items.filter((item) => {
      const expiresAt = item.expiresAt ? new Date(item.expiresAt).getTime() : 0;
      const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return (expiresAt > now - 3600000) || (createdAt > now - 86400000);
    });

    if (valid.length !== items.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
    }
    return valid;
  } catch (_) {
    return [];
  }
}

/**
 * Save a newly created transfer into sender's local history
 */
export function saveTransferToHistory(transfer) {
  if (typeof localStorage === 'undefined' || !transfer?.fileId) return;
  try {
    const history = getSenderHistory();
    // Check if already exists
    const filtered = history.filter((item) => item.fileId !== transfer.fileId);

    const createdAt = transfer.createdAt || transfer.created_at || new Date().toISOString();
    const expiresAt = transfer.expiresAt || transfer.expires_at || null;

    const newRecord = {
      fileId: transfer.fileId,
      transferCode: transfer.transferCode,
      fileName: transfer.fileName || transfer.original_name || 'Shared File',
      fileSize: transfer.fileSize || transfer.original_size || 0,
      fileCount: transfer.fileCount || 1,
      createdAt,
      expiresAt,
      burnOnRead: Boolean(transfer.burnOnRead ?? transfer.burn_on_read),
      ownerToken: transfer.ownerToken || transfer.owner_token || null,
      status: transfer.status || 'active', // 'active' | 'cancelled' | 'expired' | 'completed'
    };

    const updated = [newRecord, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not save transfer to history:', err);
  }
}

/**
 * Update the status or metrics of an existing transfer
 */
export function updateTransferInHistory(fileId, updates) {
  if (typeof localStorage === 'undefined' || !fileId) return;
  try {
    const history = getSenderHistory();
    const updated = history.map((item) => {
      if (item.fileId === fileId) {
        return { ...item, ...updates };
      }
      return item;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Remove a transfer completely from history
 */
export function removeTransferFromHistory(fileId) {
  if (typeof localStorage === 'undefined' || !fileId) return;
  try {
    const history = getSenderHistory();
    const filtered = history.filter((item) => item.fileId !== fileId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (_) {}
}

/**
 * Clear all transfer history
 */
export function clearAllTransferHistory() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (_) {}
}
