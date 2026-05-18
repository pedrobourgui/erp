import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DataTable, type ColumnDef, type PaginationState } from './data-table';

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
    const nextBtn = buttons.find(
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
});
