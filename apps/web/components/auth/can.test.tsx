import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/auth.store';

import { Can } from './can';
import { RequirePermission } from './require-permission';


function setSession(permissions: string[] | null, roleName: string | null = 'seller') {
  act(() => {
    useAuthStore.setState({ permissions, roleName });
  });
}

describe('Can', () => {
  beforeEach(() => setSession(null, null));

  it('renders the children when the permission is granted', () => {
    setSession(['products:create']);
    render(
      <Can permission="products:create">
        <button>Novo Produto</button>
      </Can>
    );

    expect(screen.getByRole('button', { name: 'Novo Produto' })).toBeInTheDocument();
  });

  it('hides the children when it is not', () => {
    setSession(['products:read']);
    render(
      <Can permission="products:create">
        <button>Novo Produto</button>
      </Can>
    );

    expect(screen.queryByRole('button', { name: 'Novo Produto' })).not.toBeInTheDocument();
  });

  it('renders the fallback instead of nothing when one is given', () => {
    setSession([]);
    render(
      <Can permission="products:create" fallback={<span>sem acesso</span>}>
        <button>Novo Produto</button>
      </Can>
    );

    expect(screen.getByText('sem acesso')).toBeInTheDocument();
  });

  it('renders nothing at all while the permissions are unknown', () => {
    setSession(null);
    const { container } = render(
      <Can permission="products:create">
        <button>Novo Produto</button>
      </Can>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the children disabled in disable mode instead of hiding them', () => {
    setSession(['products:read']);
    render(
      <TooltipProvider>
        <Can permission="products:create" mode="disable">
          <button>Novo Produto</button>
        </Can>
      </TooltipProvider>
    );

    expect(screen.getByRole('button', { name: 'Novo Produto' })).toBeInTheDocument();
    expect(screen.getByTestId('permission-disabled')).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not disable anything when the permission is granted', () => {
    setSession(['products:create']);
    render(
      <TooltipProvider>
        <Can permission="products:create" mode="disable">
          <button>Novo Produto</button>
        </Can>
      </TooltipProvider>
    );

    expect(screen.queryByTestId('permission-disabled')).not.toBeInTheDocument();
  });

  it('lets owner through with an empty grant list', () => {
    setSession([], 'owner');
    render(
      <Can permission="settings:update">
        <button>Salvar</button>
      </Can>
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('accepts anyOf', () => {
    setSession(['orders:read']);
    render(
      <Can anyOf={['financial:read', 'orders:read']}>
        <span>visível</span>
      </Can>
    );

    expect(screen.getByText('visível')).toBeInTheDocument();
  });

  it('requires every permission in allOf', () => {
    setSession(['orders:read']);
    render(
      <Can allOf={['orders:read', 'orders:delete']}>
        <span>visível</span>
      </Can>
    );

    expect(screen.queryByText('visível')).not.toBeInTheDocument();
  });
});

describe('RequirePermission', () => {
  beforeEach(() => setSession(null, null));

  it('renders the page when the permission is granted', () => {
    setSession(['financial:read']);
    render(
      <RequirePermission permission="financial:read">
        <h1>Contas</h1>
      </RequirePermission>
    );

    expect(screen.getByRole('heading', { name: 'Contas' })).toBeInTheDocument();
  });

  it('renders "acesso negado" instead of the page when it is not', () => {
    setSession(['orders:read']);
    render(
      <RequirePermission permission="financial:read" subject="as contas financeiras">
        <h1>Contas</h1>
      </RequirePermission>
    );

    expect(screen.queryByRole('heading', { name: 'Contas' })).not.toBeInTheDocument();
    expect(screen.getByTestId('permission-denied')).toBeInTheDocument();
    expect(
      screen.getByText(/Você não tem permissão para ver as contas financeiras/)
    ).toBeInTheDocument();
  });

  it('offers a way back home from the denial screen', () => {
    setSession([]);
    render(
      <RequirePermission permission="financial:read">
        <h1>Contas</h1>
      </RequirePermission>
    );

    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });

  it('shows a loader — never a denial — while the permissions are unknown', () => {
    setSession(null);
    render(
      <RequirePermission permission="financial:read">
        <h1>Contas</h1>
      </RequirePermission>
    );

    expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Contas' })).not.toBeInTheDocument();
  });
});
