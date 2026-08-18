import { render as rtlRender, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { Toaster, useToast } from './toast';
import { TooltipProvider } from './tooltip';

/**
 * The component renders Radix tooltips, which throw outside a provider.
 * `providers.tsx` mounts one in the app; the tests need the same wrapper.
 */
function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

// Helper component that uses toast context
function ToastConsumer() {
  const { addToast, toasts } = useToast();
  return (
    <div>
      <button onClick={() => addToast('Test message', 'success', 5000)}>
        Add Toast
      </button>
      <span data-testid="toast-count">{toasts.length}</span>
    </div>
  );
}

describe('useToast', () => {
  it('should throw when used outside Toaster provider', () => {
    // Suppress React error boundary console output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function BadComponent() {
      useToast();
      return null;
    }

    expect(() => {
      render(React.createElement(BadComponent));
    }).toThrow('useToast deve ser usado dentro de um Toaster');

    consoleSpy.mockRestore();
  });
});

describe('Toaster', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render children', () => {
    render(
      <Toaster>
        <div>Child content</div>
      </Toaster>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should add and display a toast', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <Toaster>
        <ToastConsumer />
      </Toaster>
    );

    await user.click(screen.getByText('Add Toast'));

    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('should auto-dismiss toast after duration', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <Toaster>
        <ToastConsumer />
      </Toaster>
    );

    await user.click(screen.getByText('Add Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // Advance past the 5000ms duration
    act(() => {
      vi.advanceTimersByTime(5500);
    });

    expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('should remove toast when close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <Toaster>
        <ToastConsumer />
      </Toaster>
    );

    await user.click(screen.getByText('Add Toast'));
    expect(screen.getByText('Test message')).toBeInTheDocument();

    // DS-01: o botão de fechar é só um ícone, e antes não tinha nome nenhum —
    // este teste o procurava por `{ name: '' }`. Agora o `Tooltip` empresta o
    // seu `content` ao gatilho, então ele se chama "Fechar" como deve.
    await user.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });
});
