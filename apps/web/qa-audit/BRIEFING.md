# Briefing — Ciclo de QA UX/UI

## Ambiente (já está no ar, não suba nada)

| Serviço | URL |
|---|---|
| Web (Next dev) | `http://localhost:3100` |
| API (NestJS) | `http://localhost:3001/api/v1` |

Credenciais: `admin@admin.com` / `123456` (owner, todas as permissões) e
`vendedor@exemplo.com` / `Vendedor@123` (seller, permissões reduzidas — use para
validar estados de 403, `<Can>` e o filtro do menu).

**Não reinicie a API nem o web.** A API só aceita CORS de `localhost:3100`; se você
derrubá-la, todos os outros agentes param.

## Como rodar

Sempre a partir de `/Users/mac/work/erp/apps/web`:

```bash
npx playwright test -c qa-audit/playwright.qa.config.ts qa-audit/<seu-arquivo>.spec.ts \
  --reporter=list --output=qa-audit/artifacts/<seu-prefixo>
```

Escreva **um único arquivo** `qa-audit/<seu-prefixo>.spec.ts`. Não edite arquivos de
outros agentes, não edite `qa-fixtures.ts` nem `playwright.qa.config.ts` (outros
agentes estão rodando ao mesmo tempo). Se precisar de um helper próprio, declare-o
dentro do seu spec.

## Helpers disponíveis (`./qa-fixtures`)

```ts
import { test, expect, authenticate, captureNoise, visit, measure, probeTooltip } from "./qa-fixtures";

test("...", async ({ page }) => {
  const noise = captureNoise(page);        // arme ANTES de authenticate
  await authenticate(page);                 // owner + tema claro
  await authenticate(page, "seller");       // outro papel
  await authenticate(page, "owner", "dark");// dark mode
  await visit(page, "/estoque/produtos");   // navega e espera o React Query
  const m = await measure(page);            // medições do DOM renderizado
  const t = await probeTooltip(page, "button[aria-label='Editar']");
});
```

`measure(page)` devolve, medido do DOM real:
`horizontalOverflow`, `clippedNoScroll` (conteúdo cortado sem scroll — AE-07),
`smallHitTargets` (<24px), `oddSpacing` (fora da escala de 4px), `lowContrast`
(razão WCAG calculada com o fundo efetivo), `hardcodedColors` (cor literal em vez
de token), `missingFocusRing`, `inconsistentRadius`.

`noise` acumula `console` (erros), `pageerror` e `http` (respostas >= 400).
Um 500 silencioso atrás de um spinner é exatamente a classe de bug deste ciclo.

## O padrão da casa (o que conta como bug)

O design system está em `app/globals.css` (tokens HSL) e `tailwind.config.ts`.
As regras que o time já escreveu estão em `apps/web/CLAUDE.md` — **leia antes de
abrir um achado**, porque quase todo item abaixo tem um ID de ciclo anterior:

- **Cor** só via token (`bg-background`, `text-muted-foreground`, `border-border`,
  `bg-success`, …). `text-gray-500` ou `bg-[#fff]` é achado.
- **Espaçamento** na escala de 4px. Padding de card, gap de grid e altura de
  controle têm que bater entre telas equivalentes.
- **Borda e raio**: `--radius: 0.625rem`. Card, input, botão, badge e dialog
  precisam concordar; borda sempre `border-border`.
- **Tooltip com retorno de requisição**: todo botão só-ícone precisa de tooltip
  ou `aria-label`; todo controle desabilitado por permissão deve dizer *por quê*
  (`<Can mode="disable">`); toda mutação precisa de toast de sucesso **e** de erro
  passando por `getMutationErrorMessage` — um toast genérico que engole a mensagem
  do backend é o AE-10.
- **`isError` nunca é estado vazio** (AE-28): "nenhum registro" só depois de uma
  requisição que respondeu 200 com zero linhas.
- **Loading**: skeleton ou spinner em toda busca; botão de submit desabilitado e
  em estado de carregando durante a mutação (duplo clique não pode criar dois).
- **Responsivo**: 390px, 768px e 1440px. Conteúdo largo rola no próprio container.
- **Dark mode**: toda tela precisa funcionar nos dois temas.
- **Acessibilidade**: foco visível, contraste AA (4.5:1 / 3:1 grande),
  `<label>` associado, ordem de tabulação, `aria-*` em dialogs.
- **Texto**: pt-BR com acento, sem "1 itens" (use `pluralize`), rótulos de status
  vindos de `@erp/constants`.

## Formato do relatório

Grave em `/Users/mac/work/erp/apps/web/qa-audit/reports/<seu-prefixo>.md`.

Cada achado, ordenado por severidade (Crítico > Alto > Médio > Baixo):

```md
### [SEVERIDADE] <ID>: título curto
- **Tela**: /rota  (viewport, tema, papel)
- **Evidência**: o que foi medido/observado — número, screenshot, log
- **Esperado**: a regra que foi violada e onde ela está escrita
- **Arquivo**: caminho:linha do código responsável
- **Correção**: a mudança concreta
```

Use IDs com o seu prefixo (`EST-01`, `VND-01`, …). Um achado sem evidência medida
ou sem arquivo apontado não entra no relatório.

**Verifique antes de reportar.** Rode o teste, olhe o screenshot, abra o arquivo
e confirme que o código faz o que você diz que faz. Falso positivo custa mais caro
que achado perdido — na dúvida, marque como "a confirmar" e explique a dúvida.
