import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';

import { DataTable, type ColumnDef, type PaginationState } from './data-table';


/**
 * The table renders Radix tooltips, which throw outside a provider. The app
 * mounts one in `providers.tsx`; the tests need the same wrapper.
 */
function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

interface TestItem {
  id: string;
  name: string;
  value: number;
}

const columns: ColumnDef<TestItem>[] = [
  { id: 'name', header: 'Name', accessor: 'name', sortable: true },
  { id: 'value', header: 'Value', accessor: 'value' },
];

const testData: TestItem[] = [
  { id: '1', name: 'Item A', value: 100 },
  { id: '2', name: 'Item B', value: 200 },
  { id: '3', name: 'Item C', value: 300 },
];

const defaultPagination: PaginationState = {
  page: 1,
  limit: 20,
  total: 3,
};

describe('DataTable', () => {
  it('should render data rows', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText('Item A')).toBeInTheDocument();
    expect(screen.getByText('Item B')).toBeInTheDocument();
    expect(screen.getByText('Item C')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('300')).toBeInTheDocument();
  });

  it('should render column headers', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('should render loading skeleton when isLoading is true', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
        isLoading={true}
      />
    );

    // Skeleton rows should have animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no data', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
        emptyMessage="No records found"
        emptyDescription="Try different filters"
      />
    );

    expect(screen.getByText('No records found')).toBeInTheDocument();
    expect(screen.getByText('Try different filters')).toBeInTheDocument();
  });

  it('should render default empty message', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
  });

  it('should show pagination info', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText(/Mostrando 1-3 de 3 registros/)).toBeInTheDocument();
  });

  it('should call onPageChange when next page button is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 1, limit: 2, total: 6 }}
        onPageChange={onPageChange}
      />
    );

    // Find the next page button (ChevronRight)
    const buttons = screen.getAllByRole('button');
    // Pagination buttons: first, prev, next, last
    // next is the 3rd pagination button
    buttons.find(
      (b) => !b.hasAttribute('disabled') && b.querySelector('svg')
    );
    // Click the last non-disabled button
    const paginationButtons = buttons.filter((b) => b.className.includes('h-8'));
    // page 1 of 3: first and prev disabled, next and last enabled
    const nextButton = paginationButtons[2]; // 0:first, 1:prev, 2:next, 3:last
    if (nextButton) {
      await user.click(nextButton);
      expect(onPageChange).toHaveBeenCalledWith(2);
    }
  });

  it('should disable previous/first buttons on first page', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={{ page: 1, limit: 2, total: 6 }}
        onPageChange={vi.fn()}
      />
    );

    const paginationButtons = screen.getAllByRole('button').filter(
      (b) => b.className.includes('h-8')
    );

    // First and prev buttons should be disabled
    expect(paginationButtons[0]).toBeDisabled(); // first
    expect(paginationButtons[1]).toBeDisabled(); // prev
  });

  describe('search', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce search input', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const onSearchChange = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
          searchValue=""
          onSearchChange={onSearchChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('Buscar...');
      await user.type(searchInput, 'test');

      // Should not have been called yet (debounce is 300ms)
      expect(onSearchChange).not.toHaveBeenCalledWith('test');

      // Advance timer past debounce
      vi.advanceTimersByTime(400);

      // The last call should be with the full typed value
      expect(onSearchChange).toHaveBeenCalled();
    });
  });

  describe('sort', () => {
    it('should call onSortChange when sortable header is clicked', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
          sort={null}
          onSortChange={onSortChange}
        />
      );

      // Click the "Name" header (sortable)
      await user.click(screen.getByText('Name'));

      expect(onSortChange).toHaveBeenCalledWith({
        column: 'name',
        direction: 'asc',
      });
    });

    it('should toggle sort direction on second click', async () => {
      const user = userEvent.setup();
      const onSortChange = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
          sort={{ column: 'name', direction: 'asc' }}
          onSortChange={onSortChange}
        />
      );

      await user.click(screen.getByText('Name'));

      expect(onSortChange).toHaveBeenCalledWith({
        column: 'name',
        direction: 'desc',
      });
    });
  });

  describe('CSV export', () => {
    it('should render export button when exportCsv is true', () => {
      render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
          exportCsv={true}
        />
      );

      expect(screen.getByText('Exportar CSV')).toBeInTheDocument();
    });

    it('should call onExportCsv when custom handler provided', async () => {
      const user = userEvent.setup();
      const onExportCsv = vi.fn();

      render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
          exportCsv={true}
          onExportCsv={onExportCsv}
        />
      );

      await user.click(screen.getByText('Exportar CSV'));
      expect(onExportCsv).toHaveBeenCalledTimes(1);
    });

    it('should generate CSV when no custom handler provided', async () => {
      const user = userEvent.setup();

      // Mock URL.createObjectURL and document.createElement
      const mockUrl = 'blob:test';
      const mockCreateObjectURL = vi.fn(() => mockUrl);
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      const mockClick = vi.fn();
      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        const el = origCreateElement(tag);
        if (tag === 'a') {
          Object.defineProperty(el, 'click', { value: mockClick });
        }
        return el;
      });

      render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
          exportCsv={true}
        />
      );

      await user.click(screen.getByText('Exportar CSV'));

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockUrl);

      vi.restoreAllMocks();
    });
  });

  it('should render cell using custom cell renderer', () => {
    const customColumns: ColumnDef<TestItem>[] = [
      {
        id: 'name',
        header: 'Name',
        cell: (row) => React.createElement('strong', null, row.name),
      },
    ];

    render(
      <DataTable
        columns={customColumns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    const strongElements = screen.getAllByText('Item A');
    expect(strongElements[0].tagName).toBe('STRONG');
  });

  // ─── AE-28: a 403 is not an empty list ──────────────────────────────────

  describe('error states', () => {
    function forbidden() {
      const error = new AxiosError('Forbidden');
      error.response = {
        status: 403,
        statusText: 'Forbidden',
        headers: {},
        config: { headers: {} } as never,
        data: { message: 'Permissão insuficiente para esta ação' },
      };
      return error;
    }

    it('says "sem permissão" instead of "nenhum registro" on a 403', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          pagination={{ page: 1, limit: 20, total: 0 }}
          onPageChange={vi.fn()}
          error={forbidden()}
        />
      );

      expect(screen.getByTestId('permission-denied')).toBeInTheDocument();
      expect(screen.queryByText('Nenhum registro encontrado')).not.toBeInTheDocument();
    });

    it('does not claim a record count it could not fetch', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          pagination={{ page: 1, limit: 20, total: 0 }}
          onPageChange={vi.fn()}
          error={forbidden()}
        />
      );

      expect(screen.queryByText('Nenhum registro')).not.toBeInTheDocument();
    });

    it('shows a generic failure — not a denial — for a 500', () => {
      const error = new AxiosError('Server error');
      error.response = {
        status: 500,
        statusText: '',
        headers: {},
        config: { headers: {} } as never,
        data: {},
      };

      render(
        <DataTable
          columns={columns}
          data={[]}
          pagination={{ page: 1, limit: 20, total: 0 }}
          onPageChange={vi.fn()}
          error={error}
        />
      );

      expect(screen.getByText('Não foi possível carregar estes dados')).toBeInTheDocument();
      expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
    });

    it('still shows the empty state for a successful request with no rows', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          pagination={{ page: 1, limit: 20, total: 0 }}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
      expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
    });

    it('prefers the loading skeleton while the request is still in flight', () => {
      render(
        <DataTable
          columns={columns}
          data={[]}
          pagination={{ page: 1, limit: 20, total: 0 }}
          onPageChange={vi.fn()}
          isLoading
          error={forbidden()}
        />
      );

      expect(screen.queryByTestId('permission-denied')).not.toBeInTheDocument();
    });
  });

  // ─── AE-20 / VD-13: conteúdo real não pode quebrar o layout ────────────

  describe('long and monetary content', () => {
    it('truncates a long text cell instead of pushing the other columns out', () => {
      // Um nome de 255 caracteres (o schema permite) expandiu a tabela e jogou
      // Categoria, Preço, Estoque, Status e Ações para fora da tela — todas as
      // linhas ficaram inutilizáveis, não só a longa.
      const longName = 'A'.repeat(255);
      render(
        <DataTable
          columns={columns}
          data={[{ id: '1', name: longName, value: 100 }]}
          pagination={{ page: 1, limit: 20, total: 1 }}
          onPageChange={vi.fn()}
        />
      );

      // O truncamento fica no wrapper interno; o <td> guarda o texto completo.
      expect(screen.getByText(longName).className).toContain('truncate');
    });

    it('keeps the full text reachable through the title attribute', () => {
      const longName = 'B'.repeat(255);
      render(
        <DataTable
          columns={columns}
          data={[{ id: '1', name: longName, value: 100 }]}
          pagination={{ page: 1, limit: 20, total: 1 }}
          onPageChange={vi.fn()}
        />
      );

      // O `title` vive no <td>, que é o alvo do hover — o wrapper é só o
      // recorte visual.
      const cell = screen.getByText(longName).closest('td');
      expect(cell).toHaveAttribute('title', longName);
    });

    /**
     * A célula de nome quase nunca é texto puro — é um <Link>, um ícone mais o
     * nome, uma árvore de categorias. Essas caíam fora do `title` e o texto
     * cortado não tinha como ser lido: medido em /estoque/categorias e
     * /estoque/alertas, onde o nome vazava por cima da coluna vizinha.
     */
    it('keeps the full text reachable when the cell renders custom JSX', () => {
      const longName = 'C'.repeat(255);
      const jsxColumns: ColumnDef<TestItem>[] = [
        {
          id: 'name',
          header: 'Name',
          accessor: 'name',
          cell: (row) => <a href="/x">{row.name}</a>,
        },
      ];

      render(
        <DataTable
          columns={jsxColumns}
          data={[{ id: '1', name: longName, value: 100 }]}
          pagination={{ page: 1, limit: 20, total: 1 }}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText(longName).closest('td')).toHaveAttribute('title', longName);
    });

    it('does not put a title on a column with nothing textual to show', () => {
      const actionColumns: ColumnDef<TestItem>[] = [
        { id: 'name', header: 'Name', accessor: 'name' },
        {
          id: 'actions',
          header: '',
          role: 'actions',
          cell: () => <button type="button">Editar</button>,
        },
      ];

      render(
        <DataTable
          columns={actionColumns}
          data={[{ id: '1', name: 'Camiseta', value: 100 }]}
          pagination={{ page: 1, limit: 20, total: 1 }}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByRole('button', { name: 'Editar' }).closest('td')).not.toHaveAttribute(
        'title'
      );
    });

    it('does not wrap a column declared as nowrap (VD-13)', () => {
      const moneyColumns: ColumnDef<TestItem>[] = [
        { id: 'name', header: 'Name', accessor: 'name' },
        { id: 'value', header: 'Preço', accessor: 'value', nowrap: true },
      ];

      render(
        <DataTable
          columns={moneyColumns}
          data={[{ id: '1', name: 'Item', value: 89.9 }]}
          pagination={{ page: 1, limit: 20, total: 1 }}
          onPageChange={vi.fn()}
        />
      );

      expect(screen.getByText('89.9').className).toContain('whitespace-nowrap');
    });

    it('does not truncate a cell that renders JSX', () => {
      // Truncar um badge ou uma linha de botões esconderia o conteúdo em vez
      // de encurtá-lo.
      const jsxColumns: ColumnDef<TestItem>[] = [
        { id: 'name', header: 'Name', cell: () => <button>Ação</button> },
      ];

      render(
        <DataTable
          columns={jsxColumns}
          data={[{ id: '1', name: 'x', value: 1 }]}
          pagination={{ page: 1, limit: 20, total: 1 }}
          onPageChange={vi.fn()}
        />
      );

      const cell = screen.getByRole('button', { name: 'Ação' }).closest('td');
      expect(cell?.className).not.toContain('truncate');
    });

    it('uses a fixed layout only when some column declares a width', () => {
      // `table-fixed` sem largura declarada distribuiria as colunas
      // igualmente e pioraria o layout — por isso é condicional.
      const plain = render(
        <DataTable
          columns={columns}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
        />
      );
      expect(
        plain.container.querySelector('table')?.className
      ).not.toContain('table-fixed');
      plain.unmount();

      const sized = render(
        <DataTable
          columns={[{ ...columns[0], width: '200px' }, columns[1]]}
          data={testData}
          pagination={defaultPagination}
          onPageChange={vi.fn()}
        />
      );
      expect(sized.container.querySelector('table')?.className).toContain('table-fixed');
    });
  });
});

// ─── T9: erro com saída, vazio que fala do que foi buscado ────────────────

describe('DataTable · estado de erro', () => {
  it('should offer a retry when the caller can refetch', async () => {
    const onRetry = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
        error={new Error('boom')}
        onRetry={onRetry}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not promise a retry it cannot deliver', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
        error={new Error('boom')}
      />
    );

    expect(
      screen.queryByRole('button', { name: /tentar novamente/i })
    ).not.toBeInTheDocument();
  });

  it('should hide the pagination footer when the request failed', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
        error={new Error('boom')}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Primeira página' })
    ).not.toBeInTheDocument();
  });
});

describe('DataTable · estado vazio', () => {
  it('should echo the search term so the user knows what came up empty', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
        onSearchChange={vi.fn()}
        searchValue="zzzzznadaaqui"
      />
    );

    expect(screen.getByText(/zzzzznadaaqui/)).toBeInTheDocument();
  });

  it('should offer to clear the search that produced nothing', async () => {
    const onSearchChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
        onSearchChange={onSearchChange}
        searchValue="zzzzznadaaqui"
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /limpar busca/i }));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('should keep the generic empty message when nothing was searched', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /limpar busca/i })
    ).not.toBeInTheDocument();
  });

  it('should hide the pagination footer with zero results', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        pagination={{ page: 1, limit: 20, total: 0 }}
        onPageChange={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Primeira página' })
    ).not.toBeInTheDocument();
  });
});

// ─── T3: a coluna de ações não pode sair da tela ──────────────────────────

describe('DataTable · orçamento de largura', () => {
  it('should pin an actions column to the right edge', () => {
    const withActions: ColumnDef<TestItem>[] = [
      ...columns,
      { id: 'actions', header: 'Ações', role: 'actions', cell: () => <button>Ver</button> },
    ];
    const { container } = render(
      <DataTable
        columns={withActions}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    const header = container.querySelector('th:last-child');
    expect(header?.className).toContain('sticky');
    expect(header?.className).toContain('right-0');
  });

  it('should truncate a long text cell by default, and tighter than before', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={[{ id: '1', name: 'x'.repeat(255), value: 1 }]}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    const wrapper = container.querySelector('tbody span.truncate');
    expect(wrapper?.className).toContain('max-w-[32ch]');
  });

  it('should let a column declare its own width budget', () => {
    const narrow: ColumnDef<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: 'name', maxCh: 14 },
      ...columns.slice(1),
    ];
    const { container } = render(
      <DataTable
        columns={narrow}
        data={[{ id: '1', name: 'x'.repeat(80), value: 1 }]}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    // Orçamento declarado vai por estilo inline: `max-w-[14ch]` seria uma
    // classe que o JIT do Tailwind nunca geraria.
    expect(
      container.querySelector<HTMLElement>('tbody span.truncate')?.style.maxWidth
    ).toBe('14ch');
  });
});

// ─── T2: modo cartão abaixo de md ─────────────────────────────────────────

describe('DataTable · modo cartão', () => {
  const mobileColumns: ColumnDef<TestItem>[] = [
    { id: 'name', header: 'Name', accessor: 'name', role: 'primary' },
    { id: 'value', header: 'Value', accessor: 'value', role: 'value' },
  ];

  it('should render a card list beside the table when roles are declared', () => {
    const { container } = render(
      <DataTable
        columns={mobileColumns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(container.querySelector('[data-testid="card-list"]')).toBeInTheDocument();
  });

  it('should hide the card list from md up, and the table below it', () => {
    const { container } = render(
      <DataTable
        columns={mobileColumns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(container.querySelector('[data-testid="card-list"]')?.className).toContain('md:hidden');
    expect(container.querySelector('[data-testid="table-wrapper"]')?.className).toContain('hidden');
  });

  it('should not build cards when no column says what it is', () => {
    const { container } = render(
      <DataTable
        columns={columns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(container.querySelector('[data-testid="card-list"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="table-wrapper"]')?.className).not.toContain('hidden');
  });

  it('should show the primary column in every card', () => {
    render(
      <DataTable
        columns={mobileColumns}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    // uma vez na tabela, uma vez no cartão
    expect(screen.getAllByText('Item A')).toHaveLength(2);
  });

  /**
   * O cartão é a única visão abaixo de md, e o título dele é a coluna primária —
   * quase sempre um <Link>. Sem recorte ele era pintado por cima do status à
   * direita em 390px (medido em /estoque/produtos e /estoque).
   */
  it('should clip a long card title and keep it readable through the title attribute', () => {
    const longName = 'D'.repeat(255);
    const linkColumns: ColumnDef<TestItem>[] = [
      {
        id: 'name',
        header: 'Name',
        accessor: 'name',
        role: 'primary',
        cell: (row) => <a href="/x">{row.name}</a>,
      },
      { id: 'value', header: 'Value', accessor: 'value', role: 'value' },
    ];

    const { container } = render(
      <DataTable
        columns={linkColumns}
        data={[{ id: '1', name: longName, value: 100 }]}
        pagination={{ page: 1, limit: 20, total: 1 }}
        onPageChange={vi.fn()}
      />
    );

    const card = container.querySelector('[data-testid="card-list"]') as HTMLElement;
    const title = card.querySelector('[data-card-title]') as HTMLElement;
    expect(title.className).toContain('truncate');
    expect(title).toHaveAttribute('title', longName);
  });

  it('should leave a hidden-mobile column out of the cards', () => {
    const withHidden: ColumnDef<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: 'name', role: 'primary' },
      { id: 'value', header: 'Value', accessor: 'value', role: 'hidden-mobile' },
    ];
    render(
      <DataTable
        columns={withHidden}
        data={testData}
        pagination={defaultPagination}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getAllByText('Item A')).toHaveLength(2);
    expect(screen.getAllByText('100')).toHaveLength(1);
  });
});
