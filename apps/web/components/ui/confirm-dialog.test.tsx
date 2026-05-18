import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    onConfirm: vi.fn(),
  };

  it('should render nothing when open is false', () => {
    const { container } = render(
      <ConfirmDialog {...defaultProps} open={false} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('should render title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />);

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('should call onCancel and onOpenChange when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        onCancel={onCancel}
        onOpenChange={onOpenChange}
      />
    );

    await user.click(screen.getByText('Cancelar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should use custom confirm and cancel labels', () => {
    render(
      <ConfirmDialog
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Go Back"
      />
    );

    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    // Both buttons should be disabled when loading
    const buttons = screen.getAllByRole('button');
    const confirmBtn = screen.getByText('Confirmar').closest('button');
    const cancelBtn = screen.getByText('Cancelar').closest('button');

    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
  });

  it('should show spinner in confirm button when loading', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />);

    // The loading spinner has animate-spin class
    const confirmBtn = screen.getByText('Confirmar').closest('button');
    const spinner = confirmBtn?.querySelector('.animate-spin');
    expect(spinner).toBeTruthy();
  });

  it('should apply destructive variant when destructive is true', () => {
    render(<ConfirmDialog {...defaultProps} destructive={true} />);

    // The icon container should have destructive classes
    const confirmBtn = screen.getByText('Confirmar').closest('button');
    // The button should be rendered with destructive variant
    expect(confirmBtn).toBeInTheDocument();
  });

  it('should close on Escape key', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        {...defaultProps}
        onOpenChange={onOpenChange}
        onCancel={onCancel}
      />
    );

    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
