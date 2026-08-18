import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect } from 'vitest';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

/**
 * DS-03: 18 dos 22 `DialogContent` do sistema não declaravam `max-h`. Em
 * 390×667 três já estouravam a tela — contas 746px, lançamentos 738px, métodos
 * 762px — com `overflow-y: visible` e o diálogo `fixed`: o rodapé, e portanto o
 * botão de confirmar, ficava fora de alcance. Os dois que declaravam
 * `max-h-[85vh]` clampavam corretamente em 566,95px.
 *
 * A regra do CLAUDE.md ("Dialogs: max-h-[85vh], corpo rolável, rodapé fixo") já
 * existia — o que faltava era ela morar no primitivo em vez de depender de cada
 * chamador lembrar. FN-14 e AE-26 são a mesma história.
 */
describe('DialogContent', () => {
  function renderDialog(className?: string) {
    render(
      <Dialog open>
        <DialogContent className={className}>
          <DialogHeader>
            <DialogTitle>Título</DialogTitle>
          </DialogHeader>
          <p>corpo</p>
          <DialogFooter>
            <button type="button">Confirmar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
    return screen.getByRole('dialog');
  }

  it('should constrain its height by default', () => {
    expect(renderDialog().className).toContain('max-h-[85vh]');
  });

  it('should scroll its own content instead of growing past the viewport', () => {
    expect(renderDialog().className).toContain('overflow-y-auto');
  });

  it('should still accept a caller className', () => {
    expect(renderDialog('max-w-3xl').className).toContain('max-w-3xl');
  });

  /**
   * `cn()` resolve conflitos pelo último valor: um chamador que precise de outro
   * limite (um diálogo de importação em tela cheia, por exemplo) tem que
   * conseguir sobrescrever, senão a regra vira uma camisa de força.
   */
  it('should let a caller override the default height limit', () => {
    const el = renderDialog('max-h-screen');
    expect(el.className).toContain('max-h-screen');
    expect(el.className).not.toContain('max-h-[85vh]');
  });
});

/**
 * A folha ancorada existe para os filtros no celular: empilhado, o painel
 * empurrava a tabela para fora da tela.
 *
 * A posição é uma string inteira por variante, e não um remendo sobre a
 * centralizada, porque `left-[50%] … translate-x-[-50%]` mais as animações de
 * entrada formam um conjunto. Desmontá-lo pelo `className` depende de o
 * `tailwind-merge` reconhecer cada par — e ele não reconhece as variantes de
 * `slide-in-from-*`. Pedida assim, a folha nasceu 69px acima do rodapé.
 */
describe('DialogContent position', () => {
  function renderAt(position?: 'center' | 'bottom') {
    render(
      <Dialog open>
        <DialogContent position={position}>
          <DialogTitle>Título</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    return screen.getByRole('dialog').className;
  }

  it('should center the dialog by default', () => {
    const cls = renderAt();
    expect(cls).toContain('left-[50%]');
    expect(cls).toContain('translate-y-[-50%]');
  });

  it('should anchor a bottom sheet to the viewport edge', () => {
    const cls = renderAt('bottom');
    expect(cls).toContain('bottom-0');
    expect(cls).toContain('inset-x-0');
  });

  it('should drop the centering transform on a bottom sheet', () => {
    // O que produziu a folha flutuando no meio da tela.
    const cls = renderAt('bottom');
    expect(cls).not.toContain('translate-y-[-50%]');
    expect(cls).not.toContain('translate-x-[-50%]');
  });

  it('should slide a bottom sheet up instead of down from the top', () => {
    const cls = renderAt('bottom');
    expect(cls).toContain('data-[state=open]:slide-in-from-bottom');
    expect(cls).not.toContain('slide-in-from-top-[48%]');
  });
});
