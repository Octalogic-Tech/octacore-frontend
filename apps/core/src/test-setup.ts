import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom lacks these browser APIs. Radix and the form controls call them, so tests get inert stand-ins.
class ResizeObserverStub {
  observe() {
    /* inert stand-in */
  }
  unobserve() {
    /* inert stand-in */
  }
  disconnect() {
    /* inert stand-in */
  }
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
window.HTMLElement.prototype.scrollIntoView ??= () => {
  /* inert stand-in */
};
window.HTMLElement.prototype.hasPointerCapture ??= () => false;
window.HTMLElement.prototype.releasePointerCapture ??= () => {
  /* inert stand-in */
};

// React Router 6 prints a notice about v7 opt-in flags on every router mount. It is not about this code,
// and it buries real warnings, so those two notices (and only those) are dropped.
const warn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].startsWith('⚠️ React Router Future Flag Warning')) return;
  warn(...args);
};
