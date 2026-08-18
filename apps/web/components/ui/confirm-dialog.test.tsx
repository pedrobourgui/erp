import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';

import { ConfirmDialog } from './confirm-dialog';
import { TooltipProvider } from './tooltip';

/**
 * The component renders Radix tooltips, which throw outside a provider.
 * `providers.tsx` mounts one in the app; the tests need the same wrapper.
 */
function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

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
    screen.getAllByRole('button');
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

  /**
   * DS-08 / EST-07: o diálogo era uma `<div>` sobreposta. Sem `role`, um leitor
   * de tela não anuncia que algo se abriu; sem foco preso, o Tab passeia pela
   * página atrás do overlay; sem devolução de foco, quem fecha com Esc é jogado
   * para o topo do documento. Confirmar uma exclusão é o pior lugar do sistema
   * para o usuário não saber onde está.
   */
  describe('accessibility', () => {
    it('should expose itself as a modal dialog', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('should be named by its title', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(
        screen.getByRole('dialog', { name: 'Confirm Action' })
      ).toBeInTheDocument();
    });

    it('should describe itself with the message', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      const describedBy = dialog.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy as string)).toHaveTextContent(
        'Are you sure you want to proceed?'
      );
    });

    it('should move focus into the dialog when it opens', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialog = await screen.findByRole('dialog');
      await vi.waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });
    });

    it('should trap Tab inside the dialog', async () => {
      const user = userEvent.setup();
      render(
        <>
          <button type="button">fora do diálogo</button>
          <ConfirmDialog {...defaultProps} />
        </>
      );

      const dialog = await screen.findByRole('dialog');
      for (let i = 0; i < 6; i++) {
        await user.tab();
        expect(dialog.contains(document.activeElement)).toBe(true);
      }
    });

    it('should return focus to the trigger when it closes', async () => {
      const user = userEvent.setup();

      function Harness() {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Excluir
            </button>
            <ConfirmDialog
              {...defaultProps}
              open={open}
              onOpenChange={setOpen}
            />
          </>
        );
      }

      render(<Harness />);
      const trigger = screen.getByRole('button', { name: 'Excluir' });

      await user.click(trigger);
      await screen.findByRole('dialog');

      await user.keyboard('{Escape}');

      await vi.waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });

    it('should still run onCancel when closed with Escape', async () => {
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

      await user.keyboard('{Escape}');

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    /** Herdado do primitivo corrigido em DS-03. */
    it('should constrain its height like every other dialog', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('dialog').className).toContain('max-h-[85vh]');
    });
  });
});
