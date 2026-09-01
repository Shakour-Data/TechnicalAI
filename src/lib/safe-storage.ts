/**
 * Safe localStorage/sessionStorage wrapper that NEVER throws.
 *
 * In sandboxed iframes (e.g. Z.ai preview panel), localStorage access
 * can throw SecurityError / DOMException. This wrapper catches all errors
 * and degrades gracefully (returns null / no-op).
 */

const isStorageAvailable = (() => {
  try {
    // Test actual write/read in case the storage quota is exceeded
    const testKey = '__safe_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
})();

function safeGetItem(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // Storage full, sandboxed iframe, etc. — silently ignore
  }
}

function safeRemoveItem(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // Silently ignore
  }
}

function safeClear(storage: Storage): void {
  try {
    storage.clear();
  } catch {
    // Silently ignore
  }
}

/** Safe localStorage that never throws */
export const safeLocalStorage = {
  get available() { return isStorageAvailable; },
  getItem: (key: string) => safeGetItem(window.localStorage, key),
  setItem: (key: string, value: string) => safeSetItem(window.localStorage, key, value),
  removeItem: (key: string) => safeRemoveItem(window.localStorage, key),
  clear: () => safeClear(window.localStorage),
  get length() {
    try { return window.localStorage.length; } catch { return 0; }
  },
  key: (index: number) => {
    try { return window.localStorage.key(index); } catch { return null; }
  },
};

/** Safe sessionStorage that never throws */
export const safeSessionStorage = {
  get available() { return isStorageAvailable; },
  getItem: (key: string) => safeGetItem(window.sessionStorage, key),
  setItem: (key: string, value: string) => safeSetItem(window.sessionStorage, key, value),
  removeItem: (key: string) => safeRemoveItem(window.sessionStorage, key),
  clear: () => safeClear(window.sessionStorage),
  get length() {
    try { return window.sessionStorage.length; } catch { return 0; }
  },
  key: (index: number) => {
    try { return window.sessionStorage.key(index); } catch { return null; }
  },
};

/**
 * Safe ResizeObserver wrapper that never throws on creation or observation.
 * Returns a no-op observer if ResizeObserver is unavailable or throws.
 */
export function createSafeResizeObserver(callback: ResizeObserverCallback): ResizeObserver | null {
  try {
    if (typeof ResizeObserver === 'undefined') return null;
    return new ResizeObserver(callback);
  } catch {
    return null;
  }
}

/**
 * Safely observe an element with ResizeObserver.
 * Handles the case where the observer or element is null.
 */
export function safeObserve(
  observer: ResizeObserver | null,
  element: Element | null,
): void {
  if (!observer || !element) return;
  try {
    observer.observe(element);
  } catch {
    // Silently ignore
  }
}

/**
 * Safely unobserve an element.
 */
export function safeUnobserve(
  observer: ResizeObserver | null,
  element: Element | null,
): void {
  if (!observer || !element) return;
  try {
    observer.unobserve(element);
  } catch {
    // Silently ignore
  }
}

/**
 * Safely disconnect an observer.
 */
export function safeDisconnect(observer: ResizeObserver | null): void {
  if (!observer) return;
  try {
    observer.disconnect();
  } catch {
    // Silently ignore
  }
}
