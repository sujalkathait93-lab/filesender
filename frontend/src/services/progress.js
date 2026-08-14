/**
 * SecureShare Progress Throttler
 * Progress callbacks can fire on every network chunk (dozens per second),
 * causing excessive React re-renders. This helper limits callback frequency
 * to ~8 per second while always emitting the final update.
 */

const THROTTLE_MS = 125;

export function createProgressThrottle(onUpdate, intervalMs = THROTTLE_MS) {
  let lastEmit = 0;
  let pending = null;
  let timer = null;

  const emit = () => {
    if (pending === null) return;
    const value = pending;
    pending = null;
    timer = null;
    lastEmit = Date.now();
    onUpdate(value);
  };

  return {
    /** Call with the latest progress value; throttled internally. */
    push(value) {
      const now = Date.now();
      pending = value;
      if (now - lastEmit >= intervalMs) {
        emit();
      } else if (!timer) {
        timer = setTimeout(emit, intervalMs - (now - lastEmit));
      }
    },
    /** Flush any pending value immediately (call on completion). */
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      emit();
    },
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
  };
}
