import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Toaster, useToast } from './toast';

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

    // Click the X button (the close button inside the toast)
    const closeButton = screen.getByRole('button', { name: '' }); // X icon button
    // There might be multiple buttons; find the one inside the toast portal
    const allButtons = screen.getAllByRole('button');
    const closeBtn = allButtons.find(
      (btn) => btn !== screen.getByText('Add Toast')
    );
    if (closeBtn) {
      await user.click(closeBtn);
    }

    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });
});
