import '@testing-library/jest-dom';

/**
 * jsdom does not implement the Pointer Events API, and Radix's `Select` calls
 * into it on every open. Without these stubs any test that opens a select dies
 * with `target.hasPointerCapture is not a function` — which reads as a bug in
 * the component instead of a gap in the environment.
 *
 * `scrollIntoView` is the same story: Radix scrolls the highlighted item into
 * view and jsdom has no layout.
 */
if (typeof window !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  /**
   * Same story for `ResizeObserver`: jsdom has no layout to observe. Radix's
   * tooltip positioning calls it, and so does `TruncatedText`, which re-measures
   * whether a text is clipped whenever its column changes width. Without the
   * stub the render throws before a single assertion runs.
   */
  if (!('ResizeObserver' in globalThis)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
}
