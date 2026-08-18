import { render as rtlRender, screen } from '@testing-library/react';
import { Pencil } from 'lucide-react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import { Tooltip, TooltipProvider } from './tooltip';

function render(ui: React.ReactElement) {
  return rtlRender(<TooltipProvider>{ui}</TooltipProvider>);
}

/**
 * DS-01: o `content` chegava só ao `Content` do Radix, que liga por
 * `aria-describedby` — descrição, não **nome**. Resultado medido pelo QA:
 * 60 de 60 botões de ação da tabela de produtos sem nome acessível, e
 * `getByRole("button", { name: "Editar" })` retornando zero em todas as cinco
 * listagens. São 35 dos 45 controles só-ícone do repositório.
 */
describe('Tooltip', () => {
  it('should name an icon-only trigger with its content', () => {
    render(
      <Tooltip content="Editar">
        <button type="button">
          <Pencil className="h-4 w-4" />
        </button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('should not override an aria-label the caller already set', () => {
    render(
      <Tooltip content="Editar este produto">
        <button type="button" aria-label="Editar produto Camiseta">
          <Pencil className="h-4 w-4" />
        </button>
      </Tooltip>
    );

    expect(
      screen.getByRole('button', { name: 'Editar produto Camiseta' })
    ).toBeInTheDocument();
  });

  /**
   * WCAG 2.5.3: o nome acessível precisa conter o rótulo visível. Um botão que
   * já diz "Salvar" não pode passar a se chamar "Salvar e voltar à lista" só
   * porque o tooltip explica mais — quem usa comando de voz perde o controle.
   */
  it('should keep the visible label as the name when the trigger has text', () => {
    render(
      <Tooltip content="Salvar e voltar à lista">
        <button type="button">Salvar</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('should name a trigger that mixes an icon with text by its text', () => {
    render(
      <Tooltip content="Adicionar um novo produto ao catálogo">
        <button type="button">
          <Pencil className="h-4 w-4" />
          Novo produto
        </button>
      </Tooltip>
    );

    expect(
      screen.getByRole('button', { name: 'Novo produto' })
    ).toBeInTheDocument();
  });

  it('should render children untouched when content is empty', () => {
    render(
      <Tooltip content="">
        <button type="button">Salvar</button>
      </Tooltip>
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });
});
