import { describe, it, expect } from 'vitest';

import { buildBreadcrumbs } from './breadcrumbs';

/**
 * FN-22: telas de segundo nível não tinham trilha nenhuma. A trilha sai da
 * rota e usa os rótulos do menu, para não poder divergir do caminho que o
 * usuário clicou.
 */
describe('buildBreadcrumbs', () => {
  it('is empty at the root — não há para onde subir', () => {
    expect(buildBreadcrumbs('/')).toEqual([]);
  });

  it('builds the trail of a second-level screen with the menu labels', () => {
    expect(buildBreadcrumbs('/financeiro/lancamentos')).toEqual([
      { label: 'Início', href: '/' },
      { label: 'Financeiro', href: '/financeiro' },
      { label: 'Despesas e Receitas', href: null },
    ]);
  });

  it('leaves the current page without a link', () => {
    const crumbs = buildBreadcrumbs('/configuracoes/metodos-pagamento');

    expect(crumbs[crumbs.length - 1].href).toBeNull();
    expect(crumbs[crumbs.length - 1].label).toBe('Métodos Pagamento');
  });

  it('labels an id segment as "Detalhe" instead of showing the cuid', () => {
    const crumbs = buildBreadcrumbs('/clientes/cmsalvjwn00025141i74pt1lt');

    expect(crumbs.map((c) => c.label)).toEqual(['Início', 'Clientes', 'Detalhe']);
  });

  it('humanises a segment the menu does not know', () => {
    const crumbs = buildBreadcrumbs('/estoque/produtos/novo');

    expect(crumbs.map((c) => c.label)).toEqual([
      'Início',
      'Estoque',
      'Produtos',
      'Novo',
    ]);
  });

  it('keeps every ancestor clickable', () => {
    const crumbs = buildBreadcrumbs('/vendas/pedidos');

    expect(crumbs[0].href).toBe('/');
    expect(crumbs[1].href).toBe('/vendas');
  });
});
