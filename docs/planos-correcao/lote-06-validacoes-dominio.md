# Lote 6 — Validações de domínio e dados brasileiros

> Um ERP brasileiro que aceita CPF `111.111.111-11` e NCM `ABCDEFG` gera rejeição de NF-e e cadastro sujo
> irrecuperável. Este lote fecha as portas de entrada. Estimativa: **4 dias**. Sem dependências.

| Bug | Sev. | Resumo |
|---|---|---|
| AE-04 | 🟠 Alto | CPF e CNPJ inválidos são aceitos (sem dígito verificador) |
| AE-15 | 🟡 Médio | Duplicidade de documento burlável mudando a formatação |
| AE-08 | 🟠 Alto | NCM `ABCDEFG` e EAN `123` aceitos; não existe campo CFOP |
| AE-05 | 🟠 Alto | Preço de venda menor que o custo aceito sem aviso |
| AE-02 | 🟠 Alto | Produto com saldo é excluído sem bloqueio, deixando alerta órfão |
| AE-11 | 🟡 Médio | Erros em abas ocultas: o formulário de produto "não faz nada" |
| AE-12c | 🟡 Médio | Vários depósitos marcados como "Padrão" ao mesmo tempo |
| AE-24 | 🔵 Baixo | "Preço de venda é obrigatório" quando o campo está preenchido com 0 |
| FN-13 | 🟡 Médio | Validações de métodos/condições falham em silêncio |
| FN-14 | 🟡 Médio | Condição com 999 parcelas estoura a viewport; botões inacessíveis |
| FN-24 | 🔵 Baixo | Preview de condição aceita entrada > 100% |
| FN-25 | 🔵 Baixo | Política de senha fraca (mínimo 6, sem complexidade) |
| FN-26 | 🔵 Baixo | Validação de e-mail delegada ao browser, em inglês |

---

## 6.1 — AE-04 + AE-15: documentos brasileiros

**Onde está furado**
- Front: `clientes/novo/page.tsx:23-29` valida só a **contagem** de dígitos (11 ou 14).
- Back: `crm/dto/customer.dto.ts` valida `@IsString() @MaxLength(18)`.
- `customers.service.ts:134-142` compara `document` como string literal → `12345678909` e
  `123.456.789-09` convivem como clientes diferentes.

**Passos**
1. Criar validadores compartilhados em `packages/validators`: `isValidCPF`, `isValidCNPJ`,
   `isValidDocument(doc, type)` — com dígito verificador e rejeição de sequências repetidas
   (`111.111.111-11`, `000…`). Um único código para os dois lados, importado por zod (front) e por um
   `@IsCPFOrCNPJ()` custom decorator (back).
2. **Normalizar no armazenamento**: gravar `document` apenas com dígitos e formatar na exibição. Migration
   para normalizar os registros existentes, detectando e reportando as duplicatas que aparecerem.
3. Índice único `(tenantId, document)` no Prisma — a unicidade tem que ser garantida pelo banco, não só
   pela consulta prévia (que ainda perde em concorrência).
4. Mesma validação em todos os pontos de entrada de documento: cadastro, edição (lote 8), importação CSV e
   cadastro de fornecedor.

**Aceite:** CPF `111.111.111-11` e CNPJ `11.111.111/1111-11` rejeitados no front (mensagem sob o campo) e no
back (400); `12345678909` e `123.456.789-09` reconhecidos como o mesmo documento.

**Teste:** tabela de CPFs/CNPJs válidos e inválidos conhecidos, nos dois workspaces.

---

## 6.2 — AE-08: campos fiscais

Produto foi criado com `ncm: 'ABCDEFG'` e `ean: '123'` — em produção isso é NF-e rejeitada pela SEFAZ.
Não existe campo **CFOP** em nenhuma aba.

**Passos**
1. NCM: exatamente 8 dígitos, aceitando máscara `0000.00.00`; armazenar só dígitos.
2. EAN/GTIN: 8, 12, 13 ou 14 dígitos **com dígito verificador** (algoritmo GTIN); campo opcional, mas se
   preenchido, válido.
3. CEST: 7 dígitos, opcional (o `CLAUDE.md` do front já cita o limite 9 — alinhar com o schema).
4. Adicionar **CFOP** (4 dígitos) no cadastro, com os códigos usuais de venda pré-listados; validar contra
   a tabela oficial (constante em `packages/constants`).
5. Validar nos dois lados (zod + DTO), com as mesmas funções compartilhadas.

**Aceite:** nenhum produto com NCM/EAN/CFOP inválido entra no banco; produtos existentes com dado inválido
aparecem numa listagem de "pendências fiscais" (ou, no mínimo, num relatório de migration).

---

## 6.3 — AE-05 + AE-24 + AE-11: formulário de produto

- **AE-05** — custo R$ 500.000 e venda R$ 100.000 foram aceitos sem aviso. Adicionar `superRefine` cruzando
  `costPrice`/`salePrice`: margem negativa exige confirmação explícita ("Confirmo a venda com margem
  negativa") — bloquear de vez pode atrapalhar liquidação, mas o silêncio atual é pior. Exibir a margem
  calculada em tempo real no formulário, em vermelho quando negativa.
- **AE-24** — preço zero mostra "Preço de venda é obrigatório" (`novo/page.tsx:48-51`); trocar para "Preço de
  venda deve ser maior que zero".
- **AE-11** — com Nome e SKU preenchidos, "Publicar Produto" **não faz nada**: o erro está na aba Preços,
  oculta. Corrigir:
  1. badge de erro na aba (contador de pendências);
  2. focar automaticamente a primeira aba com erro no submit;
  3. toast "Existem campos obrigatórios não preenchidos";
  4. asterisco no label "Preço de Custo", que é obrigatório no zod e não está sinalizado.
  Aplicar o mesmo tratamento a qualquer formulário com abas (padrão para o time).

---

## 6.4 — AE-02: exclusão de produto com saldo

Produto com 4 un. em estoque foi excluído sem bloqueio, o alerta ficou **órfão** em `/estoque/alertas` e o
KPI "Estoque Crítico" continuou contando o item inexistente.

**Passos**
1. Backend: bloquear (409) a exclusão de produto com saldo > 0, com movimentações ou vinculado a pedido em
   aberto — mensagem dizendo o motivo e o saldo. Oferecer **inativar** como alternativa.
2. Se a exclusão for permitida (soft delete), resolver em cascata os alertas de estoque e excluir o item das
   agregações do dashboard.
3. O diálogo de confirmação deve informar o saldo e as pendências antes de confirmar.
4. Auditar os alertas órfãos já existentes (job de limpeza ou reseed).

---

## 6.5 — AE-12c: depósito padrão único

`createWarehouse` (`inventory.service.ts:70-89`) grava `isDefault` sem rebaixar o anterior — a tela chegou a
exibir **3 depósitos "Padrão"**, tornando ambíguo o depósito usado por vendas e balcão.

**Passos**
1. Ao marcar um depósito como padrão, rebaixar os demais **na mesma transação**.
2. Índice parcial único (`tenantId` where `isDefault = true`) no Postgres.
3. Corrigir os dados atuais (deixar apenas um padrão).
4. Mesma regra vale para conta financeira default e método de pagamento default, se existirem.

---

## 6.6 — FN-13 + FN-14 + FN-24: métodos e condições de pagamento

**FN-13 — falha silenciosa.** Taxa `-5`, liquidação `-10 dias`, taxa `150%`, `0` parcelas, entrada `200%`:
clicar em "Criar" **não faz nada** — sem mensagem, sem toast, sem requisição. Os schemas zod têm as regras,
mas os campos não renderizam `errors`:
- `configuracoes/metodos-pagamento/page.tsx:380-406` — `feePercentage`, `settlementDays`;
- `configuracoes/condicoes-pagamento/page.tsx:350-385` — `installments`, `daysBetweenInstallments`, `entryPercentage`.
→ Renderizar `{errors.X && <p className="text-xs text-destructive">…}` em todos eles. **E** varrer o projeto
inteiro atrás do mesmo padrão (`grep` por campos de formulário sem bloco de erro) — este é o tipo de defeito
que aparece em lote.
→ Adicionar, como rede: `onInvalid` no `handleSubmit` disparando um toast "Verifique os campos destacados".

**FN-14 — 999 parcelas.** O preview renderiza as 999 linhas, o `DialogContent` cresce indefinidamente e os
botões Cancelar/Criar ficam permanentemente fora da viewport (só ESC resolve).
→ `max-h-[85vh] overflow-y-auto` no `DialogContent` com o rodapé fixo; preview limitado a 6 linhas + "… e
mais N parcelas"; `.max(48)` no zod (o `max={48}` do HTML é contornável).

**FN-24 — entrada > 100%.** O preview mostra entrada de R$ 2.000 numa venda de R$ 1.000.
→ `entryPercentage` entre 0 e 100 no zod, com erro renderizado.

---

## 6.7 — FN-25 + FN-26: perfil e senha

- **FN-25** — política atual: mínimo 6 caracteres. Para o `owner` de um ERP é fraco. Exigir mínimo 8 com ao
  menos três das quatro classes (maiúscula, minúscula, dígito, símbolo), bloquear senhas óbvias
  (`123456`, `senha`, e-mail do usuário) e exibir medidor de força. Aplicar também no seed e no convite.
- **FN-26** — e-mail inválido cai na validação nativa do browser, em inglês. Adicionar `noValidate` no form e
  validar por zod, com mensagem em pt-BR (regra do `apps/web/CLAUDE.md`).

---

## Checklist de saída do lote

- [ ] Nenhum documento, NCM, EAN ou CFOP inválido entra no banco por nenhuma via
- [ ] Nenhum formulário do sistema bloqueia o submit sem mostrar o motivo
- [ ] Índices únicos criados: documento do cliente, código de conta, depósito padrão
- [ ] Migration de normalização de documentos executada com relatório de duplicatas
- [ ] Testes de validador compartilhado com tabela de casos válidos/inválidos
