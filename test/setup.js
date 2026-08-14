// jest-canvas-mock calls jest.fn() at module-evaluation time, but there is no
// `jest` global in Vitest. We must inject the shim onto the global object
// before jest-canvas-mock is first evaluated.
//
// ES module imports are hoisted, so we cannot simply write `globalThis.jest = ...`
// before the import statement. Instead we use a dynamic import to ensure our
// shim assignment runs first.

import { vi } from 'vitest';

// Install the shim synchronously before any other code runs.
if (typeof globalThis.jest === 'undefined') {
  globalThis.jest = {
    fn: (...args) => vi.fn(...args),
    spyOn: (...args) => vi.spyOn(...args),
    isMockFunction: (fn) => vi.isMockFunction(fn),
  };
}

// Now dynamically load jest-canvas-mock so it sees our `jest` global.
await import('jest-canvas-mock');

// Stub URL.createObjectURL and URL.revokeObjectURL if jsdom does not provide them.
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = (_blob) => `blob:mock-url-${Math.random()}`;
}

if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = (_url) => { /* no-op */ };
}
