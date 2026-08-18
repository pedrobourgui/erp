"use client";

import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Download,
  Inbox,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import React, { useState, useCallback, useEffect, useRef } from "react";

import { PermissionDeniedState } from "@/components/auth/permission-denied-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { isPermissionError } from "@/lib/api-errors";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  id: string;
  header: string;
  accessor?: keyof T | ((row: T) => unknown);
  cell?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
  /**
   * Largura da coluna (`table-layout: fixed`). Sem isto, o navegador
   * dimensiona pelo conteúdo e um nome de 255 caracteres empurra todas as
   * outras colunas para fora da tela (AE-20).
   */
  width?: string;
  /**
   * Conteúdo que não pode quebrar nem truncar — valores monetários, datas.
   * VD-13: "R$ 89,90" saía como "R$ 89" já em 1440 px.
   */
  nowrap?: boolean;
  /**
   * Não truncar esta coluna. O padrão é truncar, porque a alternativa (AE-20)
   * é um nome de 255 caracteres empurrar todas as outras colunas para fora da
   * tela. Use em colunas de ação, onde o conteúdo já é estreito.
   */
  noTruncate?: boolean;
  /**
   * Orçamento de largura da coluna, em caracteres.
   *
   * T3: o padrão de 42ch é generoso demais em fonte de 14px — a coluna
   * "Produto" ficava com 462px e empurrava Status e Ações inteiramente para
   * fora da viewport em 1440px (197px escondidos em `/estoque/produtos`).
   * Truncar resolve o estouro; **orçar** resolve a disputa entre colunas.
   */
  maxCh?: number;
  /**
   * O papel da coluna no cartão de mobile e na fixação horizontal.
   *
   * T2: abaixo de `md` a tabela é inutilizável — em 390px `/vendas/pedidos`
   * mostra "Pedido" e "Cliente" e esconde status, total e ações atrás de
   * scroll horizontal. Declarando o papel de cada coluna, a mesma definição
   * serve para a linha e para o cartão.
   *
   * `actions` também fixa a coluna à direita: a ação da linha nunca pode sair
   * da tela, seja por scroll ou por disputa de largura.
   */
  role?:
    | "primary"
    | "status"
    | "secondary"
    | "meta"
    | "value"
    | "actions"
    | "hidden-mobile";
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

export interface SortState {
  column: string;
  direction: "asc" | "desc";
}

export interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: (selectedIds: string[]) => void;
}

export interface DataTableProps<T extends { id: string }> {
  columns: ColumnDef<T>[];
  data: T[];
  pagination: PaginationState;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  sort?: SortState | null;
  onSortChange?: (sort: SortState) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  selectable?: boolean;
  bulkActions?: BulkAction[];
  exportCsv?: boolean;
  onExportCsv?: () => void;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  /**
   * The query's error, when it failed. A 403 renders as "sem permissão"
   * instead of as an empty table (AE-28) — `isError` must never be drawn as
   * "nenhum registro".
   */
  error?: unknown;
  /**
   * Refaz a consulta que falhou. Sem isto o estado de erro dizia "Tente
   * novamente em instantes" e não oferecia nenhum controle para tentar —
   * só recarregar a página inteira.
   */
  onRetry?: () => void;
  /** Extra classes per row — used to flag rows that need attention (FN-03). */
  rowClassName?: (row: T) => string | undefined;
  toolbar?: React.ReactNode;
  /**
   * O painel de filtros da tela.
   *
   * T1: o gatilho "Filtros" ocupava uma faixa horizontal só dele, logo acima da
   * faixa de busca — duas linhas, 120px, para dois controles que pertencem ao
   * mesmo gesto. Passando o painel por aqui, o gatilho entra na linha da busca
   * e o painel expandido abre entre ela e a tabela, que é onde o usuário já
   * está olhando.
   */
  filters?: React.ReactNode;
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-4">
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
        </td>
      ))}
    </tr>
  );
}

// ─── Estados ────────────────────────────────────────────────────────────

/**
 * Erro com saída.
 *
 * O estado já era distinto do vazio (AE-28) — o que faltava era o controle: a
 * tela dizia "Tente novamente em instantes" e não oferecia nenhuma forma de
 * tentar, sobrando recarregar a página inteira.
 */
function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <AlertCircle className="h-10 w-10 text-destructive/60" />
      <p className="text-sm font-medium text-muted-foreground">
        Não foi possível carregar estes dados
      </p>
      <p className="text-xs text-muted-foreground/70">
        {onRetry ? "A consulta falhou." : "Tente novamente em instantes."}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Vazio que fala do que foi buscado.
 *
 * "Nenhum registro encontrado / Tente ajustar os filtros" é a mesma frase para
 * quem filtrou por uma categoria sem produtos e para quem digitou um termo com
 * erro de digitação. Ecoar o termo responde qual dos dois aconteceu, e o botão
 * desfaz a busca sem obrigar a apagar o campo caractere por caractere.
 */
function EmptyState({
  message,
  description,
  searchTerm,
  onClearSearch,
}: {
  message: string;
  description: string;
  searchTerm: string;
  onClearSearch?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Inbox className="h-10 w-10 text-muted-foreground/50" />
      {searchTerm ? (
        <>
          <p className="text-sm font-medium text-muted-foreground">
            Nada encontrado para “{searchTerm}”
          </p>
          <p className="text-xs text-muted-foreground/70">
            Confira a grafia ou tente um termo mais curto.
          </p>
          {onClearSearch ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearSearch}
              className="mt-2"
            >
              Limpar busca
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-muted-foreground">{message}</p>
          <p className="text-xs text-muted-foreground/70">{description}</p>
        </>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  columns,
  data,
  pagination,
  onPageChange,
  onLimitChange,
  sort,
  onSortChange,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  selectable = false,
  bulkActions = [],
  exportCsv = false,
  onExportCsv,
  isLoading = false,
  emptyMessage = "Nenhum registro encontrado",
  emptyDescription = "Tente ajustar os filtros ou criar um novo registro.",
  error,
  onRetry,
  rowClassName,
  toolbar,
  filters,
}: DataTableProps<T>) {
  const deniedByPermission = isPermissionError(error);
  // `table-fixed` só ajuda quando alguma largura foi declarada; sem isso ele
  // distribuiria as colunas igualmente e pioraria o layout.
  const hasDeclaredWidths = columns.some((col) => col.width);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [localSearch, setLocalSearch] = useState(searchValue ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external search value
  useEffect(() => {
    if (searchValue !== undefined) {
      setLocalSearch(searchValue);
    }
  }, [searchValue]);

  // Debounced search
  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (onSearchChange) {
        if (debounceRef.current) {clearTimeout(debounceRef.current);}
        debounceRef.current = setTimeout(() => {
          onSearchChange(value);
        }, 300);
      }
    },
    [onSearchChange]
  );

  /**
   * Limpar a busca é uma ação explícita, não digitação: passa por fora do
   * debounce. Esperar 300ms depois de clicar em "Limpar busca" faz a tela
   * parecer travada exatamente no momento em que o usuário já concluiu que a
   * busca não deu em nada.
   */
  const clearSearch = useCallback(() => {
    if (debounceRef.current) {clearTimeout(debounceRef.current);}
    setLocalSearch("");
    onSearchChange?.("");
  }, [onSearchChange]);

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) {clearTimeout(debounceRef.current);}
    };
  }, []);

  // Selection
  const allSelected =
    data.length > 0 && data.every((row) => selectedIds.has(row.id));
  const someSelected =
    data.some((row) => selectedIds.has(row.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.map((row) => row.id)));
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Sort
  const handleSort = (columnId: string) => {
    if (!onSortChange) {
      return;
    }
    if (sort?.column === columnId) {
      onSortChange({
        column: columnId,
        direction: sort.direction === "asc" ? "desc" : "asc",
      });
    } else {
      onSortChange({ column: columnId, direction: "asc" });
    }
  };

  // Pagination helpers
  const totalPages = Math.ceil(pagination.total / pagination.limit) || 1;
  const startRecord = (pagination.page - 1) * pagination.limit + 1;
  const endRecord = Math.min(
    pagination.page * pagination.limit,
    pagination.total
  );

  // Get cell value
  const getCellValue = (row: T, col: ColumnDef<T>): React.ReactNode => {
    if (col.cell) {
      return col.cell(row, 0);
    }
    if (col.accessor) {
      if (typeof col.accessor === "function") {
        return String(col.accessor(row) ?? "");
      }
      return String((row as Record<string, unknown>)[col.accessor as string] ?? "");
    }
    return "";
  };

  /**
   * O texto da célula, quando existe um — independente de a célula ser
   * renderizada como JSX. A coluna de nome quase nunca é texto puro (é um
   * <Link>, um ícone com o nome, uma árvore de categorias) e era exatamente ela
   * que ficava cortada sem nenhuma forma de ler o valor inteiro. Uma coluna sem
   * `accessor` (ações) continua sem `title`: não há texto a mostrar.
   */
  const getCellText = (row: T, col: ColumnDef<T>): string | undefined => {
    if (!col.accessor) {return undefined;}
    const raw =
      typeof col.accessor === "function"
        ? col.accessor(row)
        : (row as Record<string, unknown>)[col.accessor as string];
    if (raw === null || raw === undefined || typeof raw === "object") {return undefined;}
    const text = String(raw);
    return text.length > 0 ? text : undefined;
  };

  // Default CSV export
  const handleExportCsv = () => {
    if (onExportCsv) {
      onExportCsv();
      return;
    }
    const headers = columns.map((c) => c.header);
    const rows = data.map((row) =>
      columns.map((col) => {
        if (col.accessor) {
          const val =
            typeof col.accessor === "function"
              ? col.accessor(row)
              : (row as Record<string, unknown>)[col.accessor as string];
          return String(val ?? "");
        }
        return "";
      })
    );
    const csv = [headers, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedArray = Array.from(selectedIds);
  const colCount = columns.length + (selectable ? 1 : 0);

  // ── T2: cartões abaixo de `md` ──────────────────────────────────────
  // Só monta cartões quando as colunas dizem o que são. Uma tabela que não
  // declarou papéis continua exatamente como estava — nada de adivinhar qual
  // coluna é o título do registro.
  const hasRoles = columns.some(
    (col) => col.role && col.role !== "actions" && col.role !== "hidden-mobile"
  );
  const cardColumns = {
    primary: columns.find((c) => c.role === "primary"),
    status: columns.find((c) => c.role === "status"),
    secondary: columns.find((c) => c.role === "secondary"),
    meta: columns.filter((c) => c.role === "meta"),
    value: columns.find((c) => c.role === "value"),
    actions: columns.find((c) => c.role === "actions"),
  };

  // Estados que valem para as duas apresentações.
  const showEmpty = !isLoading && !error && data.length === 0;
  const searchTerm = (searchValue ?? localSearch).trim();
  // Um rodapé de paginação sobre zero resultados ("« ‹ 1/1 › »", "20 por
  // página") é cromo sobre o vazio — e sobre um erro é uma contagem que a
  // requisição nunca chegou a devolver.
  const showPagination = !error && pagination.total > 0;

  // O orçamento declarado vai por estilo inline de propósito: `max-w-[${n}ch]`
  // é uma classe que o JIT do Tailwind não enxerga no código-fonte e portanto
  // nunca gera — a classe apareceria no HTML sem nenhuma regra por trás.
  const budget = (col: ColumnDef<T>) => ({
    className: col.maxCh ? undefined : "max-w-[32ch]",
    style: col.maxCh ? { maxWidth: `${col.maxCh}ch` } : undefined,
  });

  return (
    <div className="space-y-4">
      {/*
        Faixa dos filtros: nada disputa a linha com ela.
        O "Exportar CSV" morava aqui à direita e cobrava ~150px do painel a
        cada tela — um botão que se usa uma vez por sessão custando largura a
        seis campos que se usam o tempo todo. Ele desceu para junto da tabela,
        que é sobre o que ele age.
      */}
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange ? <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div> : null}
        {filters}
        {toolbar}
      </div>

      {/* Ações sobre a lista, encostadas na tabela a que se referem. */}
      {exportCsv ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      ) : null}

      {/* Bulk actions bar */}
      {selectable && selectedIds.size > 0 ? <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                variant={(action.variant as "default") ?? "outline"}
                size="sm"
                onClick={() => action.onClick(selectedArray)}
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto"
          >
            Limpar seleção
          </Button>
        </div> : null}

      {/* T2: cartões abaixo de `md`.
          Em 390px a tabela mostra duas colunas — "Pedido" e "Cliente" — e
          esconde status, total e ações atrás de scroll horizontal, com as
          alturas de linha quebrando de forma irregular. O balcão e o estoque
          usam 390px de fato; a mesma definição de coluna alimenta as duas
          apresentações, então nenhuma tela precisa declarar o layout duas
          vezes. */}
      {hasRoles ? (
        <div data-testid="card-list" className="space-y-2 md:hidden">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/40" />
            ))
          ) : deniedByPermission ? (
            <div className="rounded-lg border py-10">
              <PermissionDeniedState subject="estes registros" />
            </div>
          ) : error ? (
            <div className="rounded-lg border py-12">
              <ErrorState onRetry={onRetry} />
            </div>
          ) : showEmpty ? (
            <div className="rounded-lg border py-12">
              <EmptyState
                message={emptyMessage}
                description={emptyDescription}
                searchTerm={searchTerm}
                onClearSearch={
                  onSearchChange ? clearSearch : undefined
                }
              />
            </div>
          ) : (
            data.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "rounded-lg border bg-card p-3",
                  rowClassName?.(row)
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* O título do cartão é a coluna primária — quase sempre um
                      <Link>, que é inline e transborda por cima do status sem
                      `truncate` aqui. O `title` é o que devolve o texto inteiro. */}
                  <div
                    data-card-title
                    className="min-w-0 flex-1 truncate font-medium"
                    title={
                      cardColumns.primary
                        ? getCellText(row, cardColumns.primary)
                        : undefined
                    }
                  >
                    {cardColumns.primary
                      ? getCellValue(row, cardColumns.primary)
                      : null}
                  </div>
                  {cardColumns.status
                    ? getCellValue(row, cardColumns.status)
                    : null}
                </div>

                {cardColumns.secondary ? (
                  <div
                    className="mt-1 truncate text-sm text-muted-foreground"
                    title={getCellText(row, cardColumns.secondary)}
                  >
                    {getCellValue(row, cardColumns.secondary)}
                  </div>
                ) : null}

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {cardColumns.meta.map((col) => (
                      <span key={col.id} className="truncate" title={getCellText(row, col)}>
                        {getCellValue(row, col)}
                      </span>
                    ))}
                  </div>
                  {cardColumns.value ? (
                    <div className="shrink-0 text-base font-semibold">
                      {getCellValue(row, cardColumns.value)}
                    </div>
                  ) : null}
                </div>

                {cardColumns.actions ? (
                  <div className="mt-2 flex justify-end border-t pt-2">
                    {getCellValue(row, cardColumns.actions)}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}

      {/* Table */}
      <div
        data-testid="table-wrapper"
        className={cn("rounded-md border", hasRoles && "hidden md:block")}
      >
        {/* AE-07/AE-20: o conteúdo largo rola dentro do próprio container em
            vez de estourar a página. */}
        <div className="w-full overflow-x-auto">
          <table
            className={cn(
              "w-full caption-bottom text-sm",
              hasDeclaredWidths && "table-fixed"
            )}
          >
            <thead className="border-b bg-muted/50">
              <tr>
                {selectable ? <th className="w-12 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) {el.indeterminate = someSelected;}
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </th> : null}
                {columns.map((col) => (
                  <th
                    key={col.id}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 text-left font-medium text-muted-foreground",
                      col.sortable && "cursor-pointer select-none",
                      // T3: a ação da linha nunca sai da tela — nem por scroll
                      // horizontal, nem por disputa de largura entre colunas.
                      col.role === "actions" &&
                        "sticky right-0 z-10 bg-muted/50 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
                      col.headerClassName
                    )}
                    onClick={col.sortable ? () => handleSort(col.id) : undefined}
                  >
                    <div className={cn(
                      "flex items-center gap-1",
                      col.headerClassName?.includes("text-right") && "justify-end"
                    )}>
                      {col.header}
                      {col.sortable ? <span className="ml-1">
                          {sort?.column === col.id ? (
                            sort.direction === "asc" ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </span> : null}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: pagination.limit }).map((_, i) => (
                  <SkeletonRow key={i} cols={colCount} />
                ))
              ) : deniedByPermission ? (
                <tr>
                  <td colSpan={colCount} className="py-10">
                    <PermissionDeniedState subject="estes registros" />
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center">
                    <ErrorState onRetry={onRetry} />
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center">
                    <EmptyState
                      message={emptyMessage}
                      description={emptyDescription}
                      searchTerm={searchTerm}
                      onClearSearch={
                        onSearchChange ? clearSearch : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b transition-colors hover:bg-muted/50",
                      selectedIds.has(row.id) && "bg-primary/5",
                      rowClassName?.(row)
                    )}
                  >
                    {selectable ? <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </td> : null}
                    {columns.map((col) => {
                      const value = getCellValue(row, col);
                      return (
                        <td
                          key={col.id}
                          style={col.width ? { width: col.width } : undefined}
                          className={cn(
                            // T1: 57px de altura de linha davam 9 registros
                            // visíveis numa tela de 836px. 44px dão 14, e o
                            // alvo de toque continua acima do mínimo.
                            "px-4 py-2.5",
                            col.nowrap && "whitespace-nowrap",
                            col.role === "actions" &&
                              "sticky right-0 z-10 bg-card shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]",
                            col.className
                          )}
                          title={getCellText(row, col)}
                        >
                          {/* AE-20: `max-w-0 truncate` no <td> só funciona com
                              `table-fixed`. O wrapper com largura máxima em
                              `ch` trunca em qualquer layout — e o `title`
                              acima mantém o texto completo alcançável.
                              Vale para JSX também: a célula de nome costuma
                              ser um <Link>, e era ela que estourava a tabela. */}
                          {col.nowrap || col.noTruncate || col.role === "actions" ? (
                            value
                          ) : (
                            <span
                              className={cn("block truncate", budget(col).className)}
                              style={budget(col).style}
                            >
                              {value}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination — só quando há o que paginar. Um "« ‹ 1/1 › »" e um
          "20 por página" sobre zero resultados são cromo sobre o vazio; sobre
          um erro, são uma contagem que a requisição nunca devolveu (AE-28). */}
      {showPagination ? <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-sm text-muted-foreground">
          Mostrando {startRecord}-{endRecord} de {pagination.total} registros
        </div>
        <div className="flex items-center gap-2">
          {onLimitChange ? <Select
              value={String(pagination.limit)}
              onValueChange={(val) => onLimitChange(Number(val))}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size} por página
                  </SelectItem>
                ))}
              </SelectContent>
            </Select> : null}
          <div className="flex items-center gap-1">
            <Tooltip content="Primeira página">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 md:h-8 md:w-8"
                aria-label="Primeira página"
                onClick={() => onPageChange(1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Página anterior">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 md:h-8 md:w-8"
                aria-label="Página anterior"
                onClick={() => onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
            <span className="px-3 text-sm font-medium">
              {pagination.page} / {totalPages}
            </span>
            <Tooltip content="Próxima página">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 md:h-8 md:w-8"
                aria-label="Próxima página"
                onClick={() => onPageChange(pagination.page + 1)}
                disabled={pagination.page >= totalPages || isLoading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Tooltip>
            <Tooltip content="Última página">
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 md:h-8 md:w-8"
                aria-label="Última página"
                onClick={() => onPageChange(totalPages)}
                disabled={pagination.page >= totalPages || isLoading}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </Tooltip>
          </div>
        </div>
      </div> : null}
    </div>
  );
}
