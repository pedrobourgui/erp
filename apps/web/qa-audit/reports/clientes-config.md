# QA UX/UI — Clientes, Configurações e Autenticação (prefixo `CFG`)

**Escopo**: `/login`, `/convite/[token]`, `/clientes` (lista, novo, detalhe, edição),
`/configuracoes` (+ `perfil`, `condicoes-pagamento`, `metodos-pagamento`).
**Suite**: `apps/web/qa-audit/clientes-config.spec.ts` — 22 testes, todos verdes. O
suite observa e mede: o achado vive no `console.log` e no screenshot, não numa
asserção, então "verde" quer dizer "a medição foi feita", não "a tela está certa".
**Artefatos**: `apps/web/qa-audit/artifacts/cfg/`.
**Ambiente**: web `localhost:3100`, API `localhost:3001/api/v1`, Chrome 1440×900
salvo indicação, tema claro, papel `owner` salvo indicação. Os registros criados
usam o sufixo `qa-cfg-<timestamp>` e CPFs gerados com dígito verificador válido; os
dois efeitos colaterais em dados de seed (telefone do admin e a condição de
pagamento desativada em CFG-H2) foram revertidos pela API ao final.

| Severidade | Qtd |
|---|---|
| Crítico | 1 |
| Alto | 8 |
| Médio | 10 |
| Baixo | 4 |
| **Total** | **23** |

Positivos confirmados por medição (não são achados, mas foram testados e passam):
máscaras de CPF/CNPJ/telefone/CEP com `maxLength` e dígito verificador de verdade
(`111.111.111-11` → "CPF inválido"); `noValidate` em todos os formulários do escopo;
AE-10 — o toast de erro repete a mensagem do backend em `/clientes/novo`
(`Já existe um cliente com o documento "775.741.080-05"`), em `/configuracoes/perfil`
(`A senha atual está incorreta`) e no diálogo de métodos; botão de submit travado
durante a mutação (duplo clique gerou **1** POST); `permissions === null` renderiza
spinner e não "Acesso negado"; debounce da busca de clientes (9 teclas → 1 request);
nenhum `pageerror` em nenhuma tela.

---

## Crítico

### [CRÍTICO] CFG-01: o login engole o erro de credencial e apaga o que o usuário digitou

- **Tela**: `/login` (1440×900, claro, anônimo)
- **Evidência** (`CFG-A2`, `artifacts/cfg/CFG-A2-login-credencial-errada.png`,
  `CFG-A2-login-carregando.png`):
  - `POST /auth/login` responde **401** com
    `{"message":"Email ou senha inválidos"}`.
  - Enquanto o request está no ar o **formulário inteiro desaparece**: `form` = `false`,
    `div.flex.h-screen.items-center.justify-center` (spinner de tela cheia) = `true`,
    `document.body.innerText` = `""` durante todo o request.
  - Quando o 401 chega, o formulário volta com `#email` = `""`, `#password` = `""` e
    **nenhum** banner de erro: `form.innerText` = `"E-mail Senha Entrar"`,
    `form.querySelector("div.animate-slide-down")` = `null`.
  - Medido em 10 amostras de 600 ms; o estado nunca muda depois disso.
- **Esperado**: "toda mutação precisa de toast de sucesso **e** de erro" e
  "silent failures are forbidden" (`apps/web/CLAUDE.md`, *Error Handling*); a própria
  página tem o `catch` que monta a mensagem — ela nunca chega à tela.
- **Causa raiz**: `useAuthStore.login()` faz `set({ isLoading: true })` na primeira
  linha; `AuthLayout` responde a `isLoading` **desmontando** `children`. O `LoginPage`
  é destruído, e com ele o `useState` que guarda `error` e os valores do
  `react-hook-form`. Ao remontar, `error` volta a `null`.
- **Arquivo**:
  - `apps/web/app/(auth)/layout.tsx:32-38` — `if (isLoading || isAuthenticated) return <spinner/>`
  - `apps/web/stores/auth.store.ts:68` — `set({ isLoading: true })` na primeira linha de `login`
  - `apps/web/app/(auth)/login/page.tsx:36` (`useState` local do erro), `:48-57`
    (`setError` no `catch`), `:91-93` (o banner que nunca renderiza)
- **Correção**: `isLoading` do store é o estado de **hidratação da sessão**, não o de
  submit. Não reutilizá-lo em `login()`: usar um `isSubmitting` próprio (o
  `formState.isSubmitting` do RHF já existe e já alimenta o botão) e deixar
  `AuthLayout` olhar só para a hidratação inicial. Alternativa equivalente: mover o
  `error` para o store (`loginError`), que sobrevive à desmontagem — mas os campos
  digitados continuariam sendo apagados, então a correção certa é a primeira.

---

## Alto

### [ALTO] CFG-02: o filtro "Tipo" de `/clientes` não filtra nada

- **Tela**: `/clientes` (1440×900, claro, owner)
- **Evidência** (`CFG-C1`, `artifacts/cfg/CFG-C1-clientes-filtro-cnpj.png`):
  - Selecionando "Pessoa Jurídica" sai
    `GET /customers?page=1&limit=20&documentType=CNPJ`; o gatilho mostra
    "Pessoa Jurídica"; a tabela devolve as **mesmas** linhas, todas "Pessoa Física"
    (`788.104.752-67`, `788.102.342-27`, …).
  - Direto na API: `documentType=CNPJ` → `meta.total = 102`;
    `documentType=CPF` → `102`; sem filtro → `102`. O parâmetro é aceito
    (`@IsEnum(['CPF','CNPJ'])`) e descartado.
- **Esperado**: "um filtro que a UI oferece e a API ignora responde 'nenhum registro'
  exatamente como um resultado legítimo" — é a família FT-01/FT-02 do
  `CLAUDE.md` (*Filters*). Aqui é pior: não filtra e nem esvazia, então o usuário
  conclui que todo cliente é PF.
- **Arquivo**:
  - `apps/web/app/(dashboard)/clientes/page.tsx:208-212` (envia `documentType`)
  - `apps/api/src/modules/crm/customers.service.ts:36-45` — o destructuring de
    `query` pega `search, sortBy, sortOrder, segment, tag` e **não** `documentType`;
    `where` nunca recebe o campo. O DTO o declara em
    `apps/api/src/modules/crm/dto/customer.dto.ts:187-190`.
- **Correção**: no service, `const { …, documentType } = query;` e
  `if (documentType) where.documentType = documentType;`. Um teste de contrato do
  `CustomerQueryDto` contra o `where` evitaria o próximo campo órfão — é o mesmo
  "diff o `*QueryDto` contra o painel" que a regra já pede.

### [ALTO] CFG-03: o filtro "Situação" devolve o oposto do que promete

- **Tela**: `/configuracoes/metodos-pagamento` e `/configuracoes/condicoes-pagamento`
  (1440×900, claro, owner)
- **Evidência** (`CFG-H1`/`CFG-H3` + verificação direta na API com o token do owner):
  - `GET /payment-methods?isActive=false&limit=50` → `meta.total = 7`, e o conjunto
    de valores de `isActive` nas 7 linhas é `[true]`.
  - `GET /payment-methods?isActive=true&limit=50` → **exatamente as mesmas 7 linhas**.
  - Sem filtro: 20 linhas (13 inativas). Ou seja: "Somente inativos" mostra só os
    ativos, e as 13 inativas ficam inalcançáveis pela tela.
  - Mesmo comportamento em `/payment-conditions`: sem filtro 6 linhas (1 inativa),
    `isActive=false` → 5 linhas, todas ativas.
- **Esperado**: o próprio comentário do código diz por que o filtro existe —
  "o lote 4 **desativou** as duplicatas em vez de apagá-las, e sem ele essa decisão
  fica invisível" (`metodos-pagamento/page.tsx:155-158`). Com o filtro quebrado a
  decisão continua invisível, e agora com uma tela que jura o contrário.
- **Arquivo**:
  - `apps/web/app/(dashboard)/configuracoes/metodos-pagamento/page.tsx:164-167`
  - `apps/web/app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:109-111`
  - Causa raiz na API: `apps/api/src/main.ts:31-36` liga
    `transformOptions: { enableImplicitConversion: true }`, que converte a query
    string `'false'` com `Boolean('false') === true` **antes** de o
    `@Transform(({value}) => value === 'true' || value === true)` de
    `apps/api/src/modules/payment-methods/dto/payment-method.dto.ts:137-141`
    (e o equivalente em `payment-conditions`) ter chance de rodar.
- **Correção**: tirar o `isActive` da conversão implícita — declarar o campo como
  `string` no DTO e converter à mão, ou usar
  `@Type(() => String) @Transform(({ value }) => value === 'true')`. Enquanto isso não
  cai, o front não tem como consertar: o valor já chega errado no service.

### [ALTO] CFG-04: `isError` desenhado como estado vazio em três telas (AE-28)

- **Tela**: `/clientes/[id]`, `/configuracoes/metodos-pagamento`,
  `/configuracoes/condicoes-pagamento` (1440×900, claro, owner)
- **Evidência** (`CFG-E1`, `CFG-H4a`; `artifacts/cfg/CFG-E1-detalhe-500.png`,
  `CFG-E1-detalhe-403.png`, `CFG-H4a-metodos-500.png`, `CFG-H4a-condicoes-500.png`):
  - `/clientes/{id}` com a resposta forçada a **500** → a tela mostra
    `"Cliente não encontrado / Voltar"`.
  - O mesmo id com **403** (`Permissão insuficiente para esta ação`) → também
    `"Cliente não encontrado"`; `[data-testid="permission-denied"]` ausente.
  - `/configuracoes/metodos-pagamento` com **500** → `"Nenhum método de pagamento
    cadastrado"`.
  - `/configuracoes/condicoes-pagamento` com **500** → `"Nenhuma condição de
    pagamento cadastrada"`.
  - Comparação interna: `/clientes/[id]/edit` **acerta** — com 403 renderiza
    "Você não tem permissão para ver este cliente".
- **Esperado**: "**`isError` must never be rendered as an empty state.** A list shows
  'nenhum registro' only for a request that *succeeded* with zero rows"
  (`CLAUDE.md`, AE-28); e "`getApiErrorMessage()` já transforma um 403 em 'Você não
  tem permissão…' (FN-71)".
- **Arquivo**:
  - `apps/web/app/(dashboard)/clientes/[id]/page.tsx:57` — `useCustomer` é
    desestruturado só como `{ data, isLoading }`; `isError`/`error` são ignorados, e
    a linha 76 (`if (!customer)`) mistura "não existe" com "falhou".
  - `apps/web/app/(dashboard)/configuracoes/metodos-pagamento/page.tsx:161` e
    `:278-286` — `{ data, isLoading }` e `methods.length === 0` → vazio.
  - `apps/web/app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:106` e
    `:231-239` — idem.
- **Correção**: copiar o que `/clientes/[id]/edit` já faz
  (`app/(dashboard)/clientes/[id]/edit/page.tsx:64-74`): ler `isError`/`error`,
  ramificar com `isPermissionError()` para `<PermissionDeniedState>` e, no resto,
  mostrar `getMutationErrorMessage(error, …)`. Nas duas tabelas de configuração, o
  caminho mais curto é passar `error` adiante e reaproveitar o bloco de erro do
  `<DataTable>` (`components/tables/data-table.tsx:487-496`), que já trata o caso.

### [ALTO] CFG-05: o vendedor é barrado de telas que a API entrega a ele

- **Tela**: `/configuracoes/metodos-pagamento` e `/configuracoes/condicoes-pagamento`
  (1440×900, claro, papel **seller**)
- **Evidência** (`CFG-F1`, `artifacts/cfg/CFG-F1-seller-_configuracoes_metodos-pagamento.png`):
  - Permissões reais do seller (`GET /auth/me`): inclui
    `payment-methods:read` e `payment-conditions:read`.
  - API com o token do seller: `GET /payment-methods` → **200** com dados;
    `GET /payment-conditions` → **200** com dados.
  - Navegando direto pela URL, as duas telas mostram
    `[data-testid="permission-denied"]`: "Você não tem permissão para ver os métodos
    de pagamento".
  - O menu também esconde as duas entradas (`menuSeller` = Dashboard, Clientes).
- **Esperado**: as permissões vêm de `@erp/constants`, "a mesma lista que o seed
  escreve e que os guards da API exigem" (`CLAUDE.md`, *Permissions*). O guard da
  página está exigindo uma permissão de **escrita** (`financial:create`) para uma tela
  cuja leitura a API libera com `payment-methods:read` — a negação é falsa, e uma
  negação falsa é o mesmo problema do AE-28 visto de outro ângulo.
- **Arquivo**:
  - `apps/web/app/(dashboard)/configuracoes/metodos-pagamento/page.tsx:619` —
    `<RequirePermission permission="financial:create" …>`
  - `apps/web/app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:629` — idem
  - `apps/web/lib/nav-items.ts:82-91` — o menu usa a mesma permissão errada
  - Contrato real: `apps/api/src/modules/payment-methods/payment-methods.controller.ts:34-35`
    (`@RequirePermissions('payment-methods:read')` no `GET`) e `:55-56`
    (`financial:create` só no `POST`)
- **Correção**: trocar o guard da página e o item do menu para
  `payment-methods:read` / `payment-conditions:read`, e gatear "Novo Método" /
  "Nova Condição" e os botões de editar/excluir com
  `<Can permission="financial:create" mode="disable">` — que é a forma preferida pela
  regra ("disabled + tooltip" em vez de sumir).

### [ALTO] CFG-06: em Condições de Pagamento a busca e os filtros estão dentro da linha do título

- **Tela**: `/configuracoes/condicoes-pagamento` (1440×900, claro, owner)
- **Evidência** (`CFG-H1`, `artifacts/cfg/CFG-H1-condicoes-1440.png`):
  - Contêiner do cabeçalho: `class="flex items-center justify-between"`,
    caixa `{x:296, y:132, w:1112, h:60}`.
  - `h1` "Condições de Pagamento": `{x:296, y:132, w:385, h:36}`.
  - Campo de busca: `{x:774, y:144, w:198, h:36}` — **dentro** do flex do cabeçalho
    (`buscaDentroDoHeaderFlex: true`), na mesma linha do título, espremido a 198 px.
  - Botão "Filtros" idem (`filtrosDentroDoHeaderFlex: true`).
  - Tela irmã, mesmo padrão de conteúdo: em `/configuracoes/metodos-pagamento` a busca
    fica em `{x:296, y:216, w:384}` — linha própria, largura dobrada,
    `buscaDentroDoHeaderFlex: false`.
- **Esperado**: "padding de card, gap de grid e altura de controle têm que bater entre
  telas equivalentes" (BRIEFING). São duas telas gêmeas com o mesmo conjunto de
  controles e layouts diferentes; além disso, o painel de filtros expandido nasce
  dentro de um `flex items-center`, o que o achata.
- **Arquivo**: `apps/web/app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:128-187`
  — o `</div>` que fecha o cabeçalho está na linha **187**, depois do `ListSearch`
  (138), do `FilterPanel` (145-182) e do botão "Nova Condição" (183). Aninhamento
  errado do JSX; compare com `metodos-pagamento/page.tsx:183-203`, onde o cabeçalho
  abre em 183, fecha em 196 e só então vêm `ListSearch` (198) e `FilterPanel` (205).
- **Correção**: fechar o `<div className="flex items-center justify-between">` logo
  após o botão "Nova Condição" e mover `ListSearch` + `FilterPanel` para fora, como já
  está em Métodos de Pagamento.

### [ALTO] CFG-07: o botão principal do login tem contraste 2,59:1 (e a assinatura, 2,2:1)

- **Tela**: `/login` (1440×900; a tela é sempre escura, nos dois temas)
- **Evidência** (`CFG-A1` — `measure(page).lowContrast` e a sonda
  `contrasteLogin`, que compõe o alpha sobre a base do `.gradient-mesh`
  `hsl(225 33% 7%)` = `rgb(12,15,24)`; `artifacts/cfg/CFG-A1-login-1440-light.png`):
  - `button "Entrar"`: `rgb(255,255,255)` sobre `rgb(16,183,127)` →
    **ratio 2.59**, exigido 4.5. `rgb(16,183,127)` é `--accent: 160 84% 39%`
    renderizado; o mesmo par branco-sobre-accent aparece no avatar "E" do card.
  - `p "Plataforma de gestão para marketplaces"` (`text-white/25`): cor composta
    `rgb(73,75,82)` sobre `rgb(12,15,24)` → **ratio 2.20**, exigido 4.5 — no
    screenshot o texto é praticamente invisível.
  - Os demais textos brancos com alpha da tela **passam** quando compostos
    corretamente (`text-white/70` dos rótulos, `text-white/50` da descrição): a
    sonda só devolveu estes dois.
- **Esperado**: "contraste AA (4.5:1 / 3:1 grande)" (BRIEFING, *Acessibilidade*).
  É o único CTA da única tela pública do produto.
- **Arquivo**:
  - `apps/web/app/(auth)/login/page.tsx:131-134` — `bg-accent … text-white`
  - `apps/web/app/(auth)/login/page.tsx:153-155` — `text-white/25`
  - `apps/web/app/globals.css:27-28` — `--accent: 160 84% 39%` com
    `--accent-foreground: 0 0% 100%`
- **Correção**: escurecer o token para o uso em superfície (`160 84% 28%` dá 4,76:1 com
  branco; 39% dá 2,59:1) ou trocar o par para `--accent-foreground` escuro. Como o token é
  compartilhado, o caminho seguro é criar `--accent-strong` para fundos com texto e
  manter `--accent` para realces sem texto (barra ativa da sidebar, anéis de foco).
  Na assinatura, `text-white/25` (2,20:1) → `text-white/50`, que já dá 5,33:1.

### [ALTO] CFG-08: o perfil salva um telefone inválido e não mostra erro nenhum

- **Tela**: `/configuracoes/perfil` (1440×900, claro, owner)
- **Evidência** (`CFG-G2`, `artifacts/cfg/CFG-G2-perfil-telefone-curto.png`):
  - Digitado `119` → o campo mostra `(11) 9`; "Salvar alterações" →
    toast **"Perfil atualizado com sucesso!"**, zero mensagens de erro
    (`p.text-destructive` = `[]`).
  - Conferido no backend logo depois: `GET /users/me` → `phone: "(11) 9"`.
    (O teste restaura o valor original em seguida.)
  - Na mesma base de código, `/clientes/novo` recusa o mesmo valor com
    "Telefone inválido".
- **Esperado**: "Validate masked fields using `.refine()` on unmasked digit count"
  (`CLAUDE.md`, *Input Masks*) e "**Every registered field renders its own error**"
  (FN-13).
- **Arquivo**:
  - `apps/web/app/(dashboard)/configuracoes/perfil/_components/profile-form.tsx:21` —
    `phone: z.string().max(20).optional().or(z.literal(""))`, sem `.refine()`
  - idem `:88-100` — o bloco do telefone não tem `{errors.phone ? … : null}`, e o
    input nem é registrado (`value` + `setValue`, sem `{...register("phone")}`)
  - referência correta: `apps/web/components/forms/customer-form.tsx:36-45`
- **Correção**: reutilizar o mesmo `.refine()` de 10–11 dígitos do
  `customer-form.tsx` (idealmente extraído para um `phoneSchema` compartilhado),
  registrar o campo e renderizar `errors.phone`. `maxLength` também deveria ser `15`
  (o tamanho da máscara), não `20` (o tamanho da coluna).

### [ALTO] CFG-09: texto de interface sem acento em Métodos e Condições de Pagamento (FN-27)

- **Tela**: `/configuracoes/metodos-pagamento` e `/configuracoes/condicoes-pagamento`
  (1440×900, claro, owner)
- **Evidência** (`CFG-H1`/`CFG-H2`/`CFG-H3`, lido do DOM renderizado —
  `artifacts/cfg/CFG-H1-condicoes-dialog.png`, `CFG-H3-metodos-dialog.png`,
  `CFG-H2-confirm-excluir.png`):
  - Diálogo de condição: `"Nome * Codigo * Tipo *"`.
  - Diálogo de excluir condição: `"Excluir Condicao — Deseja excluir a condicao
    \"Entrada 30% + 2x\"? Esta acao nao pode ser desfeita."`
  - Toast após excluir: `"Condicao excluida com sucesso!"`.
  - Diálogo de método: `"Vendas com este metodo serao direcionadas a esta conta."`,
    `"Exige autorizacao"`, placeholder `"Ex: Cartao Visa"`.
- **Esperado**: "Ship user-facing text without accents: 'Metodos', 'Condicoes',
  'obrigatorio'" está na lista **Do NOT** do `CLAUDE.md` (FN-27).
- **Arquivo**:
  - `condicoes-pagamento/page.tsx:373` ("Condicao atualizada"), `:376`
    ("Condicao criada"), `:418` ("Codigo *"), `:601` ("Condicao excluida"),
    `:616` ("Excluir Condicao"), `:617` ("a condicao … Esta acao nao pode ser desfeita")
  - `metodos-pagamento/page.tsx:439` ("Metodo atualizado"), `:442` ("Metodo criado"),
    `:477` ("Ex: Cartao Visa"), `:573` ("este metodo serao"), `:584`
    ("Exige autorizacao")
- **Correção**: acentuar as 11 strings. Um `grep -nE
  "(Codigo|Condicao|Metodo|autorizacao|serao|Cartao|acao nao)"` sobre `app/` fecha o
  caso e serve de guarda no lint.

---

## Médio

### [MÉDIO] CFG-10: nenhum `<label>` do escopo está associado ao seu input

- **Tela**: `/clientes/novo`, `/clientes/[id]/edit`, `/convite/[token]`,
  `/configuracoes` (Empresa e diálogo de convite), `/configuracoes/perfil`,
  diálogos de método e de condição (1440×900, claro, owner)
- **Evidência** (`labelAudit` em `CFG-B1`, `CFG-D1`, `CFG-E1`, `CFG-G1`, `CFG-G2`,
  `CFG-H1`, `CFG-H3`): todos os campos abaixo saem com
  `labelledBy: "NONE"` — sem `id`, sem `label[for]`, sem `aria-label`:
  - `/clientes/novo`: `name`, `document`, `email`, `phone` (4 de 4)
  - `/convite/[token]`: `name`, `password`, `confirmPassword` (3 de 3)
  - `/configuracoes/perfil`: `name`, `email`, telefone, `currentPassword`,
    `newPassword`, `confirmPassword` (6 de 6)
  - `/clientes/[id]/edit`: os mesmos 4 (é o mesmo `CustomerForm`)
  - `/configuracoes` Empresa: 11 de 12 (só `#tenant-cep` tem `for`)
  - diálogo de convite: `email` + o select de perfil
  - diálogo "Nova Condição": `name`, `code` e o select de tipo (3 de 3)
  - diálogo "Novo Método": `name`, `feePercentage`, `settlementDays`, `fiscalCode` e
    os dois selects (6 de 6; só os dois checkboxes têm label por envolvimento)
  - endereço do cliente: 7 de 9 (só `#address-cep` tem `for`; o checkbox é envolvido)
  - Contra-exemplo dentro do próprio escopo: `/login` faz certo
    (`labelledBy: "for"` nos dois campos).
- **Esperado**: "`<label>` associado" (BRIEFING, *Acessibilidade*). Sem associação, o
  leitor de tela anuncia "campo de edição" sem nome, e o clique no rótulo não foca.
- **Arquivo** (o padrão se repete; estes são os pontos de correção mais rentáveis):
  - `apps/web/components/forms/customer-form.tsx:144,155,178,190`
  - `apps/web/app/(dashboard)/configuracoes/_components/company-tab.tsx:273-289`
    (o helper `Field` — corrigir aqui conserta 11 campos de uma vez)
  - `apps/web/app/(dashboard)/configuracoes/perfil/_components/profile-form.tsx:78,84,89`
    e `password-form.tsx:94,100,106`
  - `apps/web/app/convite/[token]/page.tsx:118,124,133`
- **Correção**: extrair o `Field` do `company-tab.tsx` para
  `components/forms/field.tsx`, gerando o `id` com `React.useId()` e passando-o via
  `cloneElement`/render-prop, e trocar os `<div className="space-y-1"><label>…` por
  ele. Um único componente resolve os ~30 campos.

### [MÉDIO] CFG-11: o toast é invisível para leitor de tela e usa cor fora dos tokens

- **Tela**: qualquer mutação do escopo (medido em `/clientes/novo`, 1440×900, claro)
- **Evidência** (`CFG-D3`, `artifacts/cfg/CFG-D3-cpf-duplicado.png`):
  - `toastA11y`: `wrapperRole: null`, `wrapperAriaLive: null`, `itemRole: null`,
    `itemAriaLive: null`, botão de fechar com `aria-label: null`.
  - `measure(page).hardcodedColors` com o toast na tela:
    `["border-red-200","bg-red-50","text-red-900","border-red-800","bg-red-950","text-red-100"]`.
- **Esperado**: "Cor **só** via token (`bg-background`, `text-muted-foreground`,
  `border-border`, `bg-success`, …)" e "`aria-*` em dialogs" (BRIEFING). Um toast é
  exatamente o caso de uso de `aria-live`: a informação aparece longe do foco e
  some em 4 s.
- **Arquivo**: `apps/web/components/ui/toast.tsx:29-34` (paleta literal),
  `:36-41` (ícones com `text-red-600`, `text-emerald-600`, …),
  `:72-89` (item sem `role`), `:119` (wrapper sem `aria-live`),
  `:81-87` (botão "Fechar" só com `Tooltip`).
- **Correção**: `role="status" aria-live="polite"` (e `aria-live="assertive"` na
  variante `error`) no wrapper do portal; `aria-label="Fechar"` no botão; e trocar a
  paleta por `bg-success/10 text-success-foreground border-success/30` e equivalentes
  com `--destructive`, `--warning`, que já existem em `globals.css:27-40` nos dois temas.

### [MÉDIO] CFG-12: o diálogo de confirmação não é um diálogo para a tecnologia assistiva

- **Tela**: excluir condição de pagamento e excluir cliente (1440×900, claro, owner)
- **Evidência** (`CFG-H2`, `artifacts/cfg/CFG-H2-confirm-excluir.png`):
  `div.fixed.inset-0.z-50` → `role: null`, `aria-modal: null`,
  `aria-labelledby: null`; após a abertura, `focoDentro: false` — o foco continua no
  botão que abriu, fora do diálogo.
- **Esperado**: "`aria-*` em dialogs" (BRIEFING). É o mesmo componente usado por
  *todos* os "Excluir" do sistema.
- **Arquivo**: `apps/web/components/ui/confirm-dialog.tsx:91-131` — markup manual
  (`<div className="fixed inset-0 …">`), sem `role`, sem `aria-modal`, sem
  `aria-labelledby`, sem foco inicial nem *focus trap*; o `<h3>` do título (`:126`)
  não tem `id`. O botão de fechar (`:103-109`) também não tem `aria-label`.
- **Correção**: o projeto já tem Radix (`components/ui/dialog.tsx`) — reescrever o
  `ConfirmDialog` sobre `Dialog`/`AlertDialog` traz `role`, `aria-modal`, rótulo,
  foco e *trap* de graça, e ainda remove o `document.body.style.overflow` manual das
  linhas 76-85. Se a reescrita não couber agora: `role="alertdialog"`,
  `aria-modal="true"`, `aria-labelledby` apontando para um `id` no `<h3>` e
  `autoFocus` no botão de cancelar.

### [MÉDIO] CFG-13: o login não tem `autocomplete`, foco inicial nem mostrar/ocultar senha

- **Tela**: `/login` (1440×900, claro, anônimo)
- **Evidência** (`CFG-A1`):
  - `labelAudit`: `email` → `autocomplete: "(ausente)"`; `password` →
    `autocomplete: "(ausente)"`.
  - `document.activeElement` ao carregar: `body` — nenhum campo focado.
  - Botões dentro do `<form>` que não sejam o submit: **0** — não existe alternar
    visibilidade da senha.
  - (A navegação só pelo teclado funciona: Tab → `#email` → `#password` → "Entrar",
    e Enter faz login — `CFG-A3`.)
- **Esperado**: gerenciadores de senha e o preenchimento do navegador dependem de
  `autocomplete="username"`/`"current-password"`; o próprio sistema já faz isso em
  `password-form.tsx:95,101,107`, então o login é a exceção. Foco inicial e o olho de
  revelar senha são o padrão da tela pública.
- **Arquivo**: `apps/web/app/(auth)/login/page.tsx:102-108` (e-mail) e `:119-125` (senha)
- **Correção**: `autoComplete="username"` + `autoFocus` no e-mail,
  `autoComplete="current-password"` na senha, e um botão de alternar
  `type="password" ↔ "text"` com `aria-label="Mostrar senha"` / `"Ocultar senha"`
  (não esquecendo `aria-pressed`).

### [MÉDIO] CFG-14: o formulário de login não tem espaçamento vertical nenhum

- **Tela**: `/login` (1440×900, claro)
- **Evidência** (`CFG-A1`, `artifacts/cfg/CFG-A1-login-1440-light.png`):
  `form.className` = `"(sem classe)"`, `row-gap: normal`; medindo os três filhos:
  bloco do e-mail `top 404.8 → bottom 480.8`, bloco da senha `top 480.8`, botão
  `top 556.8` → **deltas `[0, 0]`**. Rótulo "Senha" encosta no input de e-mail e o
  botão encosta no input de senha.
- **Esperado**: "Espaçamento na escala de 4px" (BRIEFING); todos os outros
  formulários do sistema usam `space-y-4` (`customer-form.tsx:113`,
  `profile-form.tsx:74`, `convite/[token]/page.tsx:116`, diálogos de
  método/condição). O login é o único sem.
- **Arquivo**: `apps/web/app/(auth)/login/page.tsx:88-90` —
  `<form onSubmit={handleSubmit(onSubmit)} noValidate>` sem `className`.
- **Correção**: `className="space-y-4"`. Aproveitar e trocar o `p-3.5` (14 px, fora da
  escala) do banner de erro na linha 91 por `p-4`, e o `text-[0.9rem]` da
  `CardDescription` (linha 83) por `text-sm`.

### [MÉDIO] CFG-15: o `Card` é o único componente que não usa `--radius`

- **Tela**: todas as do escopo (1440×900, claro)
- **Evidência** (`measure(page).inconsistentRadius` em `CFG-A1`, `CFG-B1`, `CFG-D1`,
  `CFG-E1`, `CFG-G1`, `CFG-G2`):
  - `div.rounded-xl.border.border-border/60.bg-card` → `border-radius: 12px`
  - no mesmo DOM: `input` 10 px, `button` 10 px, `[role=combobox]` 10 px,
    `[role=dialog]` 10 px (`CFG-H1`).
  - `--radius: 0.625rem` = **10 px**; `rounded-xl` é o 12 px fixo da escala do
    Tailwind, não o token.
- **Esperado**: "`--radius: 0.625rem`. Card, input, botão, badge e dialog precisam
  concordar; borda sempre `border-border`" (BRIEFING).
- **Arquivo**: `apps/web/components/ui/card.tsx:12` —
  `"rounded-xl border border-border/60 …"`. Além do raio, a borda é
  `border-border/60`, e não `border-border`.
- **Correção**: `rounded-lg` (que mapeia para `var(--radius)` em
  `tailwind.config.ts:76-80`) e `border-border`. Se 12 px é o desejado para cards,
  então o token é que deve mudar — mas aí muda para todos, que é justamente o ponto.

### [MÉDIO] CFG-16: input e select têm alturas diferentes na mesma linha do grid

- **Tela**: diálogo "Novo Método" em `/configuracoes/metodos-pagamento`
  (1440×900, claro, owner)
- **Evidência** (`CFG-H3`, `artifacts/cfg/CFG-H3-metodos-dialog.png`): no mesmo
  `div.grid.sm:grid-cols-2`, "Nome" e "Tipo" começam no mesmo `top: 326`, mas o
  `input` termina em `bottom: 366` (h = 40) e o `[role=combobox]` em `bottom: 362`
  (h = 36) — **4 px de desalinhamento** visível entre campos vizinhos.
  O mesmo par aparece no painel de filtros de `/clientes` e em Condições.
- **Esperado**: "altura de controle têm que bater entre telas equivalentes"
  (BRIEFING); aqui nem dentro da mesma linha batem.
- **Arquivo**: `apps/web/components/ui/input.tsx:13` (`h-10` = 40 px) vs
  `apps/web/components/ui/select.tsx:20` (`h-9` = 36 px). O `Button` `default` é
  `h-10` e o `sm` é `h-9` (`components/ui/button.tsx:39-40`), então a divergência é do
  design system, não da tela.
- **Correção**: alinhar `SelectTrigger` em `h-10`, ou definir um token de altura de
  controle (`--control-h`) e aplicá-lo em Input, SelectTrigger e Button `default`.

### [MÉDIO] CFG-17: botões só-ícone sem tooltip e sem `aria-label` em Condições de Pagamento

- **Tela**: `/configuracoes/condicoes-pagamento` (1440×900, claro, owner)
- **Evidência** (`CFG-H2`, `probeTooltip`): hover sobre o botão de excluir da
  primeira linha → `{ tooltip: null, title: null, ariaLabel: null }`. O mesmo vale
  para o lápis de editar. Contra-exemplo na tela irmã: o botão de editar de
  `/configuracoes/metodos-pagamento` responde `ariaLabel: "Editar Boleto"`
  (`CFG-H3`), e em `/clientes` o olho responde `tooltip: "Ver detalhes"` (`CFG-C1`).
- **Esperado**: "todo botão só-ícone precisa de tooltip ou `aria-label`" (BRIEFING).
  São dois lápis/lixeiras idênticos, um ao lado do outro, sem nome acessível.
- **Arquivo**: `apps/web/app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:272-277`
- **Correção**: envolver em `<Tooltip content="Editar">` / `"Excluir"` e acrescentar
  `aria-label={\`Editar ${c.name}\`}` / `aria-label={\`Excluir ${c.name}\`}`, como o
  arquivo de métodos já faz na linha 343.

### [MÉDIO] CFG-18: as "abas" não são abas para a tecnologia assistiva

- **Tela**: `/configuracoes` (Empresa/Usuários/Plano) e `/clientes/[id]`
  (Informações/Endereços/Pedidos) — 1440×900, claro, owner
- **Evidência** (`CFG-G1`): os botões "Empresa" e "Usuários" saem com
  `role: null` e `aria-selected: null`; não há `role="tablist"` nem `role="tabpanel"`,
  e as setas do teclado não navegam entre eles.
- **Esperado**: "`aria-*`" e "ordem de tabulação" (BRIEFING). Sem `aria-selected`, o
  leitor de tela não informa qual aba está ativa — a única pista é a cor da borda
  inferior, que é também um problema de "cor como único canal".
- **Arquivo**:
  - `apps/web/app/(dashboard)/configuracoes/page.tsx:35-52`
  - `apps/web/app/(dashboard)/clientes/[id]/page.tsx:146-162`
- **Correção**: `role="tablist"` no contêiner, `role="tab"` + `aria-selected` +
  `aria-controls` nos botões, `role="tabpanel"` + `aria-labelledby` no conteúdo, e
  navegação por setas. Um componente `Tabs` compartilhado evita a terceira cópia.

### [MÉDIO] CFG-19: "excluir" uma condição de pagamento na verdade a desativa — e o diálogo garante o contrário

- **Tela**: `/configuracoes/condicoes-pagamento` (1440×900, claro, owner)
- **Evidência** (`CFG-H2`, `artifacts/cfg/CFG-H2-confirm-excluir.png`,
  `CFG-H2-exclusao-resultado.png`):
  - Diálogo: "Deseja excluir a condicao \"Entrada 30% + 2x\"? **Esta acao nao pode ser
    desfeita.**"
  - `DELETE /payment-conditions/{id}` → **200**
    `{"success":true,"message":"Payment condition deactivated"}`.
  - A condição continua no banco: `GET /payment-conditions` ainda a devolve, agora com
    `isActive: false` — e foi reativada por `PATCH { isActive: true }`.
  - Agravante: como o filtro "Somente inativas" está quebrado (CFG-03), o registro
    desativado fica inalcançável pela interface.
- **Esperado**: "Anticipate the error when the screen already knows" e, mais
  simples, não afirmar o que não é verdade. A ação é reversível e o texto diz que não é.
- **Arquivo**:
  - `apps/web/app/(dashboard)/configuracoes/condicoes-pagamento/page.tsx:612-621`
    (texto do diálogo) e `:601` (toast "Condicao excluida com sucesso!")
  - `apps/api/src/modules/payment-conditions/payment-conditions.service.ts:155-176`
    (`// Soft deactivation rather than hard delete`)
- **Correção**: renomear a ação para "Desativar", com mensagem "A condição deixa de
  aparecer nas vendas, mas continua no histórico e pode ser reativada", e toast
  "Condição desativada com sucesso!". Uma vez que CFG-03 esteja resolvido, o filtro
  "Somente inativas" fecha o ciclo.

---

## Baixo

### [BAIXO] CFG-20: `--muted-foreground` fica 0,01 abaixo do AA em todas as telas

- **Tela**: todas as do escopo, tema claro (1440×900)
- **Evidência** (`measure(page).lowContrast`, repetido em `CFG-C1`, `CFG-D1`,
  `CFG-E1`, `CFG-G1`, `CFG-G2`): `color: rgb(101,117,139)` sobre
  `bg: rgb(249,250,251)` → **ratio 4.49**, exigido 4.5. Atinge todo
  `text-muted-foreground` de 16 px e 14 px (subtítulos das páginas, breadcrumb
  "Início", cabeçalhos das tabelas). Na variante `rgba(…, 0.7)` do `kbd` "Ctrl K" a
  medida é a mesma.
- **Esperado**: 4.5:1 para texto normal (BRIEFING). É reprovação marginal, mas é
  reprovação — e é o token de texto secundário do produto inteiro.
- **Arquivo**: `apps/web/app/globals.css:25` — `--muted-foreground: 215 16% 47%`
  sobre `--background: 210 20% 98%` (linha 9).
- **Correção**: `215 16% 45%` leva a razão a 4,84:1 sem mudança visual perceptível.

### [BAIXO] CFG-21: os links da sidebar não têm foco visível

- **Tela**: todas as telas autenticadas do escopo (1440×900, claro)
- **Evidência** (`measure(page).missingFocusRing`, presente em toda navegação
  autenticada): `a "Dashboard"`, `a "Clientes"`, `button "Estoque"`,
  `button "Vendas"`, `button "Financeiro"`, `a "ERP System"` — nenhum tem classe
  `focus:`/`focus-visible:` e `outline-style: none`.
- **Esperado**: "foco visível" (BRIEFING). Quem navega por teclado atravessa o menu
  inteiro sem saber onde está.
- **Arquivo**: `apps/web/components/layouts/sidebar.tsx:130`, `:212-216`, `:250-253`
  — as classes vão de `hover:bg-white/[0.04]` direto para o estado ativo, sem `focus-visible`.
- **Nota**: é o *shell*, compartilhado com o escopo dos outros agentes; registrado
  aqui porque aparece em todas as medições deste relatório.
- **Correção**: acrescentar
  `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-active focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar-bg`
  ao `cn()` dos três pontos.

### [BAIXO] CFG-22: `Badge` `success`/`warning` e a aba Plano usam a paleta literal do Tailwind, e um aviso fica em 3,19:1

- **Tela**: `/configuracoes` → abas "Usuários" e "Plano" (1440×900, claro, owner)
- **Evidência** (`CFG-G1`, `artifacts/cfg/CFG-G1-configuracoes-plano.png`,
  `CFG-G1-configuracoes-usuários.png`):
  - `hardcodedColors` na aba Usuários: `div "Ativo"` →
    `["bg-emerald-500","text-emerald-700","text-emerald-400"]` — é o
    `<Badge variant="success">`, ou seja, todo badge de sucesso do sistema.
  - Aba Plano: `div "Inicial"` (mesmo badge), `div.h-full.rounded-full` →
    `["bg-amber-500"]` (barra de uso) e `p "Você está utilizando 267% do limite"` →
    `["text-amber-600","text-amber-400"]`.
  - `lowContrast`: esse mesmo `p` → `color: rgb(217,119,6)` sobre
    `rgb(255,255,255)` → **ratio 3.19**, exigido 4.5. É o texto que avisa que o
    limite do plano estourou.
- **Esperado**: "Cor só via token (`bg-background`, `text-muted-foreground`,
  `border-border`, `bg-success`, …). `text-gray-500` ou `bg-[#fff]` é achado"
  (BRIEFING). `--success` e `--warning` existem em `globals.css:33-38` nos dois temas
  e não são usados por quem mais precisaria deles.
- **Arquivo**:
  - `apps/web/components/ui/badge.tsx:19-22` — variantes `success` e `warning`
    (as variantes `destructive`, `default` e `secondary` logo acima usam token; só
    estas duas fogem)
  - `apps/web/app/(dashboard)/configuracoes/_components/plan-tab.tsx:95` (barra) e
    `:101` (aviso)
  - `apps/web/components/forms/password-strength.tsx:16,18`
    (`bg-amber-500`, `bg-green-600`) — visível em `/convite/[token]` e na troca de senha
- **Correção**: `bg-success/15 text-success dark:text-success` e
  `bg-warning/15 text-warning-foreground` no `Badge`; `bg-warning` na barra. Para o
  aviso, `--warning` (`38 92% 50%`) como texto sobre branco também não passa AA —
  criar um `--warning-strong` (`38 92% 32%` dá 4,7:1) ou inverter para
  `bg-warning/15 text-warning-foreground`, que é o par já pensado no tema.

### [BAIXO] CFG-23: `/convite/[token]` só descobre que o token é inválido depois do formulário inteiro

- **Tela**: `/convite/token-invalido-…` (1440×900, claro, anônimo)
- **Evidência** (`CFG-B1`, `artifacts/cfg/CFG-B1-convite-invalido.png`,
  `CFG-B1-convite-erro-submit.png`):
  - Ao abrir com um token inequivocamente inválido, a página renderiza o formulário
    completo ("Aceitar convite / Nome completo / Senha / Confirmar senha / Criar
    conta") sem nenhuma verificação prévia — nenhum request sai no carregamento.
  - Só depois de preencher nome + senha + confirmação e clicar em "Criar conta" vem
    `POST /auth/accept-invite` → **400**
    `{"message":"Convite inválido ou expirado"}`, e a mensagem aparece corretamente
    no toast (`getMutationErrorMessage` está bem cabeado aqui).
  - `hardcodedColors` na mesma tela: `["bg-green-600"]` na barra de força da senha
    (`components/forms/password-strength.tsx`).
- **Esperado**: "Anticipate the error when the screen already knows"
  (`CLAUDE.md`, *Error Handling*). O estado de erro existe, mas chega tarde: o
  usuário escolhe e confirma uma senha antes de saber que o link não vale.
- **Arquivo**: `apps/web/app/convite/[token]/page.tsx:62-149` — nenhum `useQuery` de
  validação do token no carregamento; o único caminho é o `catch` do submit (`:95-103`).
- **Correção**: um `GET /auth/invite/:token` (ou equivalente) no carregamento, com
  três estados: carregando, convite válido (formulário) e convite inválido/expirado
  (mensagem + link para `/login`). Trocar também o `bg-green-600` do
  `password-strength` por `bg-success`.

---

## Verificado e sem achado

Registrado para não ser reauditado no próximo ciclo:

- **Máscaras brasileiras** (`CFG-D1`, `CFG-E1`, `CFG-G1`): CPF `529.982.247-25`
  (`maxLength=14`), CNPJ `11.222.333/0001-81` (`maxLength=18`), telefone
  `(11) 98765-4321` (`maxLength=15`), CEP `01310-100` (`maxLength=9`). Digitar 4
  dígitos a mais no CNPJ não estoura a máscara. `111.111.111-11` é recusado com
  "CPF inválido" (AE-04 fechado). O documento aparece mascarado na tabela
  (`788.104.752-67`), no detalhe e pré-preenchido na edição.
- **AE-10** (`CFG-D3`, `CFG-G2`, `CFG-H3`): o toast repete literalmente o corpo do
  409/400 do backend em clientes (documento e e-mail duplicados), na troca de senha e
  no diálogo de métodos.
- **FN-26**: `noValidate` presente em `/login`, `/convite`, customer-form,
  company-tab, profile-form, password-form e nos dois diálogos de pagamento; as
  mensagens exibidas são as do zod, em pt-BR.
- **FN-13 / `onInvalid`**: submit inválido nunca é silencioso — nos diálogos o
  `useInvalidSubmit()` emite "Existem 2 campos obrigatórios não preenchidos ou
  inválidos." e cada campo mostra o próprio erro (única exceção: o telefone do
  perfil, CFG-08).
- **Loading/duplo clique** (`CFG-D4`): botão desabilitado + spinner durante a mutação;
  dois cliques geraram **1** POST.
- **`permissions === null`** (`CFG-F2`): com `/auth/me` retido por 6 s, a tela mostra
  spinner em t=1,2 s / 2,5 s / 4,0 s, `permission-denied` ausente, e só então
  renderiza o conteúdo.
- **Responsivo** (`CFG-A3`, `CFG-C3`, `CFG-H4b`): 390 / 768 / 1440 em `/login`,
  `/clientes`, `/configuracoes/*` — `horizontalOverflow: false` e nenhum
  `clippedNoScroll` real (os dois únicos hits são `span.sr-only`, falso positivo do
  medidor).
- **Dark mode** (`CFG-A3`, `CFG-C3`, `CFG-H4b`): `/login`, `/clientes` e
  `/clientes/novo` no tema escuro — `lowContrast: []` e `hardcodedColors: []`.
- **Ruído**: nenhum `pageerror` em nenhuma das execuções; os únicos erros de
  console e HTTP ≥ 400 são os que o próprio teste provocou.

### Itens do escopo que não se aplicam (verificado, não é achado)

- **AE-11 (erro em aba escondida badgeia a aba)**: nenhum formulário deste escopo é dividido em
  abas. `/configuracoes` e `/clientes/[id]` têm abas, mas cada aba é um formulário
  independente (`company-tab`, `users-tab`, `plan-tab`) — não existe um submit único
  cujo erro possa cair numa aba fora da vista. `lib/form-tabs.ts` existe e não é
  importado por nenhum arquivo do escopo, corretamente.
- **"Excluir método de pagamento em uso"**: não há como forçar esse erro. A API não
  expõe `DELETE /payment-methods` (`payment-methods.controller.ts` tem `@Get`,
  `@Post` e `@Patch`, nenhum `@Delete`) e a tela não tem botão de excluir — só o
  lápis de editar. A checagem do toast de erro de mutação nessa tela foi feita com um
  409 injetado (`CFG-H3`, `artifacts/cfg/CFG-H3-metodos-erro-409.png`): o toast
  reproduz o texto do backend. O caminho de "em uso" real foi exercitado em Condições
  de Pagamento (CFG-19), onde o `DELETE` existe.
- **Campo de CEP em `/clientes/novo`**: o cadastro de cliente não tem endereço — o CEP
  vive no diálogo de endereços do detalhe (`/clientes/[id]` → aba Endereços), onde foi
  testado e passa (`01310-100`, `maxLength=9`, `label[for]` presente).
- **Perfil do seller**: `/configuracoes/perfil` **não** é gateado e renderiza normal
  para o papel `seller` (`CFG-F1b`, `artifacts/cfg/CFG-F1b-seller-perfil.png`) — o
  "Meu perfil" com os dois formulários e nenhum 4xx no `noise`.
