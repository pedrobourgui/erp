import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';

import { TooltipProvider } from './tooltip';
import { TruncatedText } from './truncated-text';

function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

/**
 * jsdom has no layout: every box measures 0×0, which reads as "nothing is ever
 * clipped". These helpers force the two states the component branches on.
 */
function forceClipping({ scrollWidth = 800, clientWidth = 200 } = {}) {
  // A node that left the document measures 0×0 in a real browser — the
  // behaviour the component has to survive, so the fake reproduces it.
  const spies = [
    vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.isConnected ? scrollWidth : 0;
      }),
    vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return this.isConnected ? clientWidth : 0;
      }),
  ];
  return () => spies.forEach((s) => s.mockRestore());
}

const LONG = 'Camiseta polo masculina manga longa algodão egípcio premium edição limitada';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TruncatedText', () => {
  it('should render the text it was given', () => {
    render(<TruncatedText text="Camiseta polo" />);

    expect(screen.getByText('Camiseta polo')).toBeInTheDocument();
  });

  it('should clip with an ellipsis instead of overflowing its container', () => {
    render(<TruncatedText text={LONG} />);

    expect(screen.getByText(LONG).className).toContain('truncate');
  });

  it('should not flag text that fits as truncated', () => {
    render(<TruncatedText text="Camiseta polo" />);

    expect(screen.getByText('Camiseta polo')).toHaveAttribute('data-truncated', 'false');
  });

  it('should flag text as truncated once it no longer fits', async () => {
    forceClipping();
    render(<TruncatedText text={LONG} />);

    await waitFor(() =>
      expect(screen.getByText(LONG)).toHaveAttribute('data-truncated', 'true')
    );
  });

  it('should reveal the full text in a tooltip when it is clipped', async () => {
    forceClipping();
    render(<TruncatedText text={LONG} />);

    const el = screen.getByText(LONG);
    await waitFor(() => expect(el).toHaveAttribute('data-truncated', 'true'));
    el.focus();

    // Radix renders the content plus a visually hidden copy for screen readers.
    await waitFor(() => expect(screen.getAllByText(LONG).length).toBeGreaterThan(1));
  });

  it('should let a keyboard user reach clipped text to read it in full', async () => {
    forceClipping();
    render(<TruncatedText text={LONG} />);

    await waitFor(() => expect(screen.getByText(LONG)).toHaveAttribute('tabindex', '0'));
  });

  it('should not put text that fits in the tab order', () => {
    render(<TruncatedText text="Camiseta polo" />);

    expect(screen.getByText('Camiseta polo')).not.toHaveAttribute('tabindex');
  });

  it('should clamp to several lines when asked, keeping long words breakable', () => {
    render(<TruncatedText text={LONG} lines={3} />);

    const el = screen.getByText(LONG);
    expect(el.className).toContain('line-clamp-3');
    expect(el.className).not.toContain('truncate');
  });

  /**
   * Showing the tooltip **remounts the text**: it goes from a bare `<p>` to a
   * `<p>` inside Radix's trigger, so React throws the first node away. Measuring
   * through a plain ref left the observer pinned to that discarded node — which
   * reports 0×0, reads as "it fits", and killed the tooltip that had just
   * appeared (browser log: sw 5256 / cw 749, then sw 0 / cw 0, then silence:
   * the column could shrink to nothing and no one was watching any more).
   */
  it('should keep watching the node that is on screen after the tooltip wraps it', async () => {
    const observed: Element[] = [];
    class ControllableResizeObserver {
      constructor(private cb: () => void) {}
      observe(node: Element) {
        observed.push(node);
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', ControllableResizeObserver);
    forceClipping();

    render(<TruncatedText text={LONG} />);
    await waitFor(() =>
      expect(screen.getByText(LONG)).toHaveAttribute('data-truncated', 'true')
    );

    const live = observed.filter((node) => node.isConnected);
    expect(live).toHaveLength(1);
    expect(live[0]).toBe(screen.getByText(LONG));
    vi.unstubAllGlobals();
  });

  it('should render the fallback when there is no text', () => {
    render(<TruncatedText text={null} fallback="—" />);

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('should render as the requested element so headings stay headings', () => {
    render(<TruncatedText as="h1" text="Camiseta polo" />);

    expect(screen.getByRole('heading', { name: 'Camiseta polo' })).toBeInTheDocument();
  });

  it('should keep caller classes alongside the clipping ones', () => {
    render(<TruncatedText text="Camiseta polo" className="text-3xl font-bold" />);

    const el = screen.getByText('Camiseta polo');
    expect(el.className).toContain('text-3xl');
    expect(el.className).toContain('truncate');
  });
});
