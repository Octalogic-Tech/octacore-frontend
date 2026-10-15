import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { threadId } from 'node:worker_threads';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// Multi-step flows (sign in, sign out, sign in again) can take over a second when the machine is busy; the 1000 ms
// default made findBy*/waitFor flaky under CPU load. 4 s of headroom, well inside Vitest's 5 s test timeout.
configure({ asyncUtilTimeout: 4000 });

// Vitest runs test files in worker threads of one process, and Node's BroadcastChannel delivers across threads: a
// sign-out in one file would sign out a provider in another file running at the same time. Scope every channel to
// its worker, so tabs are simulated only within one test file.
const NativeBroadcastChannel = globalThis.BroadcastChannel;
if (NativeBroadcastChannel) {
  globalThis.BroadcastChannel = class extends NativeBroadcastChannel {
    constructor(name: string) {
      super(`${name}#${threadId}`);
    }
  };
}

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
