# PRD - ERP SaaS Multi-Tenant para Sellers de Marketplaces

**Versao:** 1.0
**Data:** 2026-03-21
**Status:** Em vigor
**Responsavel:** Product Team

---

## Sumario

1. [Visao do Produto](#1-visao-do-produto)
2. [Personas](#2-personas)
3. [Modulos e Funcionalidades](#3-modulos-e-funcionalidades)
4. [Requisitos Nao-Funcionais](#4-requisitos-nao-funcionais)
5. [Roadmap](#5-roadmap-sprints)
6. [Metricas de Sucesso](#6-metricas-de-sucesso)
7. [Riscos e Mitigacoes](#7-riscos-e-mitigacoes)
8. [Glossario](#8-glossario-de-termos-do-dominio)

---

## 1. Visao do Produto

### 1.1 Problema que Resolve

Pequenas e medias empresas brasileiras que vendem em marketplaces (Mercado Livre, Shopee, Amazon, Magalu, entre outros) enfrentam desafios criticos na gestao operacional:

- **Fragmentacao de dados:** Cada marketplace possui painel proprio, obrigando o lojista a alternar entre multiplas plataformas para ter visao do negocio.
- **Controle de estoque manual:** Sem um sistema centralizado, vendas simultaneas em canais diferentes geram rupturas de estoque e vendas sem produto disponivel.
- **Emissao fiscal complexa:** A legislacao tributaria brasileira (ICMS, IPI, PIS, COFINS, Simples Nacional) exige calculo correto por UF e NCM, o que e propenso a erros quando feito manualmente.
- **Falta de visao financeira:** Conciliacao de repasses de marketplaces, taxas, comissoes e frete e um processo doloroso e frequentemente impreciso.
- **Operacao logistica desorganizada:** Sem fluxo de picking/packing estruturado, o tempo de despacho aumenta e a taxa de erros compromete a reputacao nos marketplaces.

### 1.2 Publico-Alvo

**PMEs brasileiras que vendem em marketplaces**, com o seguinte perfil:

| Caracteristica | Detalhe |
|---|---|
| Faturamento mensal | R$ 50.000 a R$ 5.000.000 |
| Equipe | 3 a 50 colaboradores |
| Canais de venda | 2 a 6 marketplaces simultaneos |
| Volume de pedidos | 100 a 10.000 pedidos/dia |
| SKUs ativos | 100 a 50.000 |
| Regime tributario | Simples Nacional, Lucro Presumido ou Lucro Real |

### 1.3 Proposta de Valor

**"Um unico sistema para gerenciar todos os seus canais de venda, estoque, financeiro e fiscal -- do pedido a entrega."**

Diferenciais competitivos:

1. **Multi-tenant nativo** -- cada empresa opera em ambiente isolado, com planos escalaveis (Trial, Starter, Professional, Enterprise).
2. **Integracao profunda com marketplaces brasileiros** -- sincronizacao bidirecional de pedidos, estoque, precos e anuncios em tempo real.
3. **Motor fiscal brasileiro integrado** -- calculo automatico de impostos por NCM, UF de origem/destino e regime tributario, com emissao de NF-e/NFC-e/NFS-e.
4. **Operacao logistica guiada** -- fluxo de picking, packing e expedicao com rastreio completo.
5. **Financeiro com conciliacao automatica** -- DRE, contas a pagar/receber, centros de custo e conciliacao bancaria via OFX.

---

## 2. Personas

### 2.1 Dono da Loja (Owner)

| Atributo | Detalhe |
|---|---|
| **Papel** | Fundador ou socio-administrador |
| **Objetivo principal** | Visao 360 do negocio, tomada de decisao estrategica |
| **Necessidades** | Dashboard com KPIs de faturamento, ticket medio, margem; relatorios de DRE; controle de custos; gestao de planos e usuarios |
| **Dores** | Nao saber quanto realmente lucra apos taxas e impostos; depender de planilhas |
| **Frequencia de uso** | Diaria (dashboard), semanal (relatorios), mensal (DRE, fiscal) |
| **Permissoes** | Acesso total (role: `admin`) |

### 2.2 Gerente de Operacoes (Manager)

| Atributo | Detalhe |
|---|---|
| **Papel** | Responsavel por pedidos, estoque e logistica |
| **Objetivo principal** | Garantir que pedidos sejam processados e despachados no prazo |
| **Necessidades** | Fila de pedidos por status; alertas de estoque critico; gestao de depositos; rastreio de envios |
| **Dores** | Rupturas de estoque; atrasos no despacho; falta de visibilidade do pipeline |
| **Frequencia de uso** | Constante ao longo do dia |
| **Permissoes** | Produtos, pedidos, estoque, relatorios operacionais (role: `manager`) |

### 2.3 Vendedor (Seller)

| Atributo | Detalhe |
|---|---|
| **Papel** | Atendimento ao cliente, criacao de pedidos manuais e orcamentos |
| **Objetivo principal** | Converter leads em vendas, fidelizar clientes |
| **Necessidades** | CRM com historico do cliente; criacao rapida de orcamentos; consulta de estoque em tempo real |
| **Dores** | Nao ter historico unificado do cliente; demora para montar orcamentos |
| **Frequencia de uso** | Constante |
| **Permissoes** | Pedidos (criar/ler/atualizar), clientes, orcamentos, estoque (somente leitura) (role: `operator`) |

### 2.4 Operador de Deposito (Warehouse Operator)

| Atributo | Detalhe |
|---|---|
| **Papel** | Picking, packing e expedicao |
| **Objetivo principal** | Separar e embalar pedidos corretamente e no menor tempo |
| **Necessidades** | Lista de picking; conferencia de itens; impressao de etiquetas; registro de despacho |
| **Dores** | Erros de separacao; retrabalho; falta de priorizacao de pedidos urgentes |
| **Frequencia de uso** | Constante durante o turno |
| **Permissoes** | Pedidos (ler/atualizar status), estoque (ler/ajustar) (role: `operator` com escopo reduzido) |

### 2.5 Financeiro (Financial)

| Atributo | Detalhe |
|---|---|
| **Papel** | Contas a pagar/receber, conciliacao bancaria, obrigacoes fiscais |
| **Objetivo principal** | Manter o fluxo de caixa saudavel e as obrigacoes em dia |
| **Necessidades** | Contas a pagar/receber com aging; conciliacao bancaria automatica; DRE por periodo e centro de custo; emissao e gestao de NF-e |
| **Dores** | Conciliacao manual de repasses de marketplace; perda de prazos de vencimento; erros em calculo de impostos |
| **Frequencia de uso** | Diaria |
| **Permissoes** | Financeiro total, fiscal total, relatorios financeiros; sem acesso a estoque/produtos (role customizado) |

---

## 3. Modulos e Funcionalidades

### 3.1 Auth & Multi-Tenancy (P0)

**Descricao:** Sistema de autenticacao, autorizacao e isolamento de dados por tenant. Cada empresa (tenant) possui seus proprios usuarios, papeis e permissoes.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| AUTH-01 | Registro de tenant (empresa) com CNPJ, regime fiscal e plano | P0 | 1 |
| AUTH-02 | Login com email/senha (JWT com refresh token) | P0 | 1 |
| AUTH-03 | RBAC - papeis (admin, manager, operator, viewer) e permissoes granulares | P0 | 1 |
| AUTH-04 | Convite de usuarios por email | P0 | 1 |
| AUTH-05 | Recuperacao de senha (email + token) | P0 | 1 |
| AUTH-06 | Isolamento de dados por tenantId em todas as queries | P0 | 1 |
| AUTH-07 | Rate limiting por tenant (short: 20/s, medium: 100/10s, long: 300/min) | P0 | 1 |
| AUTH-08 | Audit log de acoes criticas (CREATE, UPDATE, DELETE, LOGIN, LOGOUT) | P1 | 3 |
| AUTH-09 | Login social (Google) | P2 | 9 |
| AUTH-10 | 2FA (TOTP) | P2 | 9 |
| AUTH-11 | Gestao de limites por plano (maxUsers, maxProducts, maxOrders, maxWarehouses) | P0 | 1 |

#### User Stories

**AUTH-US01** -- Como **dono da loja**, quero registrar minha empresa informando CNPJ, nome e regime fiscal, para comecar a usar o sistema com um periodo trial.
- **Criterios de aceite:**
  - Validacao de CNPJ (formato e digito verificador)
  - Criacao automatica do tenant com plano TRIAL e prazo de 14 dias
  - Usuario registrante recebe role `admin`
  - Deposito padrao criado automaticamente

**AUTH-US02** -- Como **dono da loja**, quero convidar membros da equipe e definir seus papeis, para que cada um acesse apenas o que precisa.
- **Criterios de aceite:**
  - Email de convite com link temporario (expira em 48h)
  - Escolha de role pre-definido ou customizado
  - Respeitar limite de `maxUsers` do plano
  - Log de auditoria registrado

**AUTH-US03** -- Como **administrador**, quero que os dados da minha empresa estejam completamente isolados de outros tenants, para garantir seguranca e privacidade.
- **Criterios de aceite:**
  - Toda query ao banco inclui filtro `tenantId`
  - Middleware de validacao impede acesso cross-tenant
  - Testes automatizados verificam isolamento

**AUTH-US04** -- Como **usuario**, quero redefinir minha senha por email, para recuperar o acesso caso esqueca.
- **Criterios de aceite:**
  - Token de reset expira em 1 hora
  - Link de uso unico
  - Senha antiga invalidada imediatamente apos reset

#### Dependencias

- Nenhuma (modulo base do sistema)

---

### 3.2 Cadastro de Produtos (P0)

**Descricao:** Gestao completa do catalogo de produtos, incluindo variantes (cor, tamanho), imagens, codigos fiscais (EAN, NCM, CEST) e precos.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| PROD-01 | CRUD de produtos (simples, variavel, kit, servico) | P0 | 1 |
| PROD-02 | Variantes de produto com atributos flexiveis (JSON) | P0 | 1 |
| PROD-03 | Upload de imagens (S3/MinIO) com ordenacao e imagem principal | P0 | 1 |
| PROD-04 | Categorias hierarquicas (arvore) | P0 | 1 |
| PROD-05 | Marcas | P1 | 2 |
| PROD-06 | Fornecedores com contatos | P1 | 2 |
| PROD-07 | Codigos fiscais: EAN/GTIN, NCM, CEST | P0 | 1 |
| PROD-08 | Precos: custo, venda, promocional, markup automatico | P0 | 1 |
| PROD-09 | Dimensoes e peso (para calculo de frete) | P0 | 1 |
| PROD-10 | Busca full-text (tsvector PostgreSQL) | P1 | 3 |
| PROD-11 | Importacao/exportacao em massa (CSV/XLSX) | P1 | 4 |
| PROD-12 | Historico de alteracoes de preco | P2 | 7 |

#### User Stories

**PROD-US01** -- Como **gerente de operacoes**, quero cadastrar produtos com SKU, nome, precos e codigos fiscais, para manter o catalogo atualizado e pronto para venda.
- **Criterios de aceite:**
  - SKU unico por tenant
  - Campos obrigatorios: SKU, nome, preco de venda
  - Status inicial: DRAFT (so publica quando ativar)
  - Respeitar limite `maxProducts` do plano

**PROD-US02** -- Como **gerente de operacoes**, quero criar variantes (ex: "Camiseta Azul - M") com SKU, preco e estoque independentes, para gerenciar produtos com multiplas opcoes.
- **Criterios de aceite:**
  - Atributos de variacao armazenados em JSON flexivel
  - Cada variante possui SKU proprio
  - Preco da variante pode sobrescrever preco do produto pai
  - Estoque controlado por variante + deposito

**PROD-US03** -- Como **gerente de operacoes**, quero importar produtos via planilha CSV, para agilizar o cadastro inicial de grandes catalogos.
- **Criterios de aceite:**
  - Template de CSV para download
  - Validacao linha a linha com relatorio de erros
  - Preview antes da importacao definitiva
  - Processamento assincrono via fila (BullMQ)

#### Dependencias

- **AUTH** (tenantId, permissoes `products:*`)

---

### 3.3 Gestao de Estoque (P0)

**Descricao:** Controle de estoque multi-deposito com rastreio completo de movimentacoes, alertas de estoque critico e inventario.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| INV-01 | Multi-deposito (warehouses) com deposito padrao | P0 | 1 |
| INV-02 | Saldo por produto/variante/deposito (quantidade, reservado, disponivel) | P0 | 1 |
| INV-03 | Movimentacoes: entrada, saida, transferencia, ajuste, devolucao, producao | P0 | 1 |
| INV-04 | Motivos de movimentacao rastreados (compra, venda, ajuste, dano, furto, etc.) | P0 | 1 |
| INV-05 | Reserva automatica de estoque ao confirmar pedido | P0 | 2 |
| INV-06 | Alertas de estoque minimo (StockAlert) | P0 | 2 |
| INV-07 | Custo medio automatico (recalculado a cada entrada) | P1 | 3 |
| INV-08 | Transferencia entre depositos | P1 | 3 |
| INV-09 | Contagem de inventario (stocktaking) | P1 | 5 |
| INV-10 | Dashboard de estoque: itens criticos, giro, cobertura | P1 | 5 |
| INV-11 | Estoque por lote e validade | P2 | 9 |

#### User Stories

**INV-US01** -- Como **gerente de operacoes**, quero ver o saldo disponivel de cada produto em cada deposito, para evitar vender mais do que tenho.
- **Criterios de aceite:**
  - Saldo exibido como: `disponivel = quantidade - reservado`
  - Filtros por deposito, categoria, status do produto
  - Exportacao para CSV

**INV-US02** -- Como **gerente de operacoes**, quero receber alertas quando o estoque de um produto atingir o minimo configurado, para acionar reposicao a tempo.
- **Criterios de aceite:**
  - Alerta criado automaticamente quando `available <= minStock`
  - Notificacao in-app e email para usuarios com permissao `inventory:read`
  - Alerta marcado como resolvido quando estoque normalizar

**INV-US03** -- Como **operador de deposito**, quero registrar ajustes de estoque com motivo obrigatorio, para manter rastreabilidade completa.
- **Criterios de aceite:**
  - Motivo obrigatorio (enum: ADJUSTMENT, DAMAGE, THEFT, COUNT, INITIAL)
  - Campo de observacao opcional
  - Movimento registrado com userId, timestamp e quantidades
  - Saldo atualizado atomicamente

**INV-US04** -- Como **gerente de operacoes**, quero transferir estoque entre depositos, para redistribuir produtos conforme demanda regional.
- **Criterios de aceite:**
  - Selecionar deposito origem e destino
  - Validar saldo disponivel no deposito origem
  - Criar dois movimentos: EXIT no origem, ENTRY no destino
  - Tipo: TRANSFER

#### Dependencias

- **AUTH** (tenantId, permissoes `inventory:*`, `warehouses:*`)
- **Produtos** (productId, variantId)

---

### 3.4 Pedidos de Venda (P0)

**Descricao:** Gestao completa do ciclo de vida do pedido, desde a criacao ate a entrega, com fluxo de status controlado e historico completo.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| ORD-01 | Criacao manual de pedidos | P0 | 2 |
| ORD-02 | Maquina de estados: DRAFT > PENDING > CONFIRMED > PICKING > PACKED > SHIPPED > DELIVERED > COMPLETED | P0 | 2 |
| ORD-03 | Cancelamento e devolucao com motivo | P0 | 2 |
| ORD-04 | Historico de transicoes de status (quem, quando, de/para) | P0 | 2 |
| ORD-05 | Calculo automatico de subtotal, desconto, frete e total | P0 | 2 |
| ORD-06 | Reserva de estoque automatica na confirmacao | P0 | 2 |
| ORD-07 | Liberacao de estoque no cancelamento | P0 | 2 |
| ORD-08 | Vinculacao com marketplace (marketplaceOrderId, origin) | P0 | 3 |
| ORD-09 | Rastreio de envio (tracking code, URL, transportadora) | P0 | 2 |
| ORD-10 | Orcamentos (Quotation) com conversao para pedido | P1 | 4 |
| ORD-11 | Fila de pedidos com filtros por status, canal, data | P0 | 2 |
| ORD-12 | Impressao de pedido / romaneio | P1 | 5 |
| ORD-13 | Pedidos em lote (picking coletivo) | P2 | 7 |

#### User Stories

**ORD-US01** -- Como **vendedor**, quero criar um pedido manual selecionando cliente, produtos e quantidades, para registrar vendas feitas fora de marketplaces.
- **Criterios de aceite:**
  - Selecao de cliente existente ou criacao rapida
  - Busca de produtos por SKU ou nome
  - Calculo automatico de valores
  - Status inicial: DRAFT ou PENDING (configuravel)
  - Numero do pedido sequencial por tenant

**ORD-US02** -- Como **gerente de operacoes**, quero acompanhar a fila de pedidos filtrada por status, para priorizar o processamento.
- **Criterios de aceite:**
  - Listagem paginada com filtros: status, origem, data, cliente
  - Contadores por status (badges)
  - Ordenacao por data de criacao (mais antigo primeiro por padrao)

**ORD-US03** -- Como **operador de deposito**, quero marcar um pedido como "em separacao" e depois como "embalado", para que o gerente acompanhe o progresso.
- **Criterios de aceite:**
  - Transicao de status respeita a maquina de estados
  - Registro no historico com userId e timestamp
  - Notificacao ao gerente quando status mudar

**ORD-US04** -- Como **gerente de operacoes**, quero cancelar um pedido informando o motivo, para manter registro e liberar o estoque reservado.
- **Criterios de aceite:**
  - Motivo de cancelamento obrigatorio
  - Estoque reservado liberado automaticamente
  - Status: CANCELLED (estado terminal)
  - Registro em audit log

#### Dependencias

- **AUTH** (tenantId, permissoes `orders:*`)
- **Produtos** (itens do pedido)
- **Estoque** (reserva e liberacao)
- **Clientes/CRM** (customerId)

---

### 3.5 Integracao Mercado Livre (P0)

**Descricao:** Integracao bidirecional com o Mercado Livre, principal marketplace brasileiro, para sincronizacao de pedidos, estoque, precos e anuncios.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| ML-01 | OAuth2 - conexao e renovacao automatica de tokens | P0 | 3 |
| ML-02 | Importacao de pedidos (polling + webhooks) | P0 | 3 |
| ML-03 | Atualizacao de estoque no ML ao movimentar estoque local | P0 | 3 |
| ML-04 | Sincronizacao de precos | P0 | 3 |
| ML-05 | Vinculacao de anuncios (listings) a produtos internos | P0 | 3 |
| ML-06 | Envio de tracking code para o ML | P0 | 3 |
| ML-07 | Recebimento e processamento de webhooks (orders, items, questions) | P0 | 3 |
| ML-08 | Resposta a perguntas do ML dentro do ERP | P1 | 5 |
| ML-09 | Criacao de anuncios a partir do catalogo interno | P1 | 5 |
| ML-10 | Rate limiting respeitando limites da API (60 req/min, 3000 req/h) | P0 | 3 |
| ML-11 | Log de sincronizacao com metricas (itens processados, falhas, duracao) | P0 | 3 |
| ML-12 | Retry automatico com backoff exponencial para falhas | P0 | 3 |

#### User Stories

**ML-US01** -- Como **dono da loja**, quero conectar minha conta do Mercado Livre via OAuth, para que pedidos e estoque sejam sincronizados automaticamente.
- **Criterios de aceite:**
  - Fluxo OAuth2 completo (redirect, callback, armazenamento de tokens)
  - Refresh automatico antes da expiracao do access token
  - Tokens armazenados de forma criptografada
  - Teste de conectividade apos autorizacao

**ML-US02** -- Como **gerente de operacoes**, quero que pedidos do Mercado Livre aparecam automaticamente na fila de pedidos, para processar tudo em um lugar so.
- **Criterios de aceite:**
  - Pedido criado com origin: MERCADO_LIVRE
  - Dados do marketplace armazenados em `marketplaceData` (JSON)
  - Produtos vinculados via listing > productId
  - Estoque reservado automaticamente

**ML-US03** -- Como **gerente de operacoes**, quero que ao dar baixa no estoque local, o estoque do Mercado Livre atualize automaticamente, para evitar vender produto indisponivel.
- **Criterios de aceite:**
  - Atualizacao disparada via evento (EventsModule)
  - Processamento assincrono via fila (BullMQ/JobsModule)
  - Em caso de falha, retry com backoff exponencial (3 tentativas)
  - Log de sincronizacao criado

**ML-US04** -- Como **operador de deposito**, quero que ao despachar um pedido e informar o codigo de rastreio, ele seja enviado automaticamente ao Mercado Livre.
- **Criterios de aceite:**
  - Tracking code enviado via API do ML ao transicionar para SHIPPED
  - Transportadora mapeada para o formato do ML
  - Erro registrado no log caso falhe

#### Dependencias

- **AUTH** (tenantId, permissoes `marketplace:*`)
- **Produtos** (vinculacao de listings)
- **Estoque** (sincronizacao de saldos)
- **Pedidos** (importacao e atualizacao de status)

---

### 3.6 Integracao Outros Marketplaces (P1)

**Descricao:** Expansao das integracoes para Shopee, Amazon, Magalu, Shopify e Nuvemshop, seguindo a mesma arquitetura da integracao com Mercado Livre.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| MKT-01 | Integracao Shopee (OAuth, pedidos, estoque, precos) | P1 | 4 |
| MKT-02 | Integracao Amazon (OAuth, pedidos, estoque, precos) | P1 | 5 |
| MKT-03 | Integracao Magalu (API, pedidos, estoque) | P2 | 7 |
| MKT-04 | Integracao Shopify (OAuth, pedidos, estoque, precos) | P2 | 8 |
| MKT-05 | Integracao Nuvemshop (OAuth, pedidos, estoque, precos) | P2 | 8 |
| MKT-06 | Painel unificado de conexoes de marketplace | P1 | 4 |
| MKT-07 | Rate limiting por marketplace (configuravel) | P1 | 4 |
| MKT-08 | Dashboard de saude das integracoes (status, ultima sync, erros) | P1 | 5 |

#### User Stories

**MKT-US01** -- Como **dono da loja**, quero conectar minha conta da Shopee ao ERP, para centralizar os pedidos de todos os canais.
- **Criterios de aceite:**
  - Mesmo fluxo da integracao ML (OAuth, sync de pedidos/estoque)
  - Rate limiting respeitando 40 req/min e 2000 req/h
  - Webhooks processados de forma independente
  - Logs de sincronizacao com metricas

**MKT-US02** -- Como **gerente de operacoes**, quero ver a saude de todas as integracoes em um painel unico, para identificar rapidamente problemas de sincronizacao.
- **Criterios de aceite:**
  - Status por conexao: ACTIVE/INACTIVE, ultima sincronizacao, erros recentes
  - Indicadores visuais (verde/amarelo/vermelho)
  - Acao rapida: resincronizar, reconectar

#### Dependencias

- **Integracao ML** (arquitetura base reutilizada)
- **Produtos, Estoque, Pedidos** (mesmas dependencias)

---

### 3.7 Financeiro (P1)

**Descricao:** Gestao financeira completa com contas a pagar/receber, contas bancarias, fluxo de caixa, conciliacao bancaria, centros de custo e plano de contas (DRE).

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| FIN-01 | Contas bancarias e caixas (checking, savings, cash, digital) | P1 | 5 |
| FIN-02 | Contas a receber com parcelas, juros e multa | P1 | 5 |
| FIN-03 | Contas a pagar com workflow de aprovacao | P1 | 5 |
| FIN-04 | Lancamentos financeiros (credito/debito) com saldo atualizado | P1 | 5 |
| FIN-05 | Geração automatica de recebiveis ao confirmar pedido | P1 | 5 |
| FIN-06 | Geracao automatica de pagar ao receber compra | P1 | 6 |
| FIN-07 | Metodos de pagamento (Dinheiro, PIX, Cartao, Boleto) | P1 | 5 |
| FIN-08 | Centros de custo | P1 | 6 |
| FIN-09 | Plano de contas hierarquico (para DRE) | P1 | 6 |
| FIN-10 | Conciliacao bancaria via OFX | P1 | 6 |
| FIN-11 | Fluxo de caixa projetado (recebiveis vs pagaveis por data) | P1 | 6 |
| FIN-12 | DRE por periodo e centro de custo | P1 | 6 |
| FIN-13 | Aging de recebiveis e pagaveis (vencimento) | P1 | 5 |
| FIN-14 | Conciliacao de repasses de marketplace | P2 | 8 |

#### User Stories

**FIN-US01** -- Como **financeiro**, quero visualizar as contas a receber com filtro por status (pendente, vencido, pago) e data de vencimento, para controlar o fluxo de caixa.
- **Criterios de aceite:**
  - Listagem paginada com filtros: status, cliente, periodo de vencimento
  - Totalizadores por status
  - Destaque visual para titulos vencidos (OVERDUE)
  - Suporte a parcelas (installment / totalInstallments)

**FIN-US02** -- Como **financeiro**, quero registrar o recebimento parcial ou total de uma conta a receber, para manter os saldos atualizados.
- **Criterios de aceite:**
  - Valor pago registrado (paidAmount)
  - Lancamento financeiro criado automaticamente (CREDIT)
  - Status atualizado: PARTIALLY_PAID ou PAID
  - Saldo da conta bancaria atualizado atomicamente

**FIN-US03** -- Como **financeiro**, quero importar o extrato bancario em formato OFX e conciliar com os lancamentos do sistema, para evitar conciliacao manual.
- **Criterios de aceite:**
  - Parser de arquivo OFX
  - Matching automatico por valor, data e descricao
  - Status: MATCHED, UNMATCHED, IGNORED
  - Interface para resolver itens nao conciliados manualmente

**FIN-US04** -- Como **dono da loja**, quero visualizar o DRE mensal por centro de custo, para entender onde estou lucrando e onde estou perdendo dinheiro.
- **Criterios de aceite:**
  - Relatorio baseado no plano de contas (ChartOfAccounts hierarquico)
  - Filtros: periodo, centro de custo
  - Totais por grupo (Receita, Deducoes, CMV, Despesas Operacionais, Resultado)
  - Exportacao para PDF e XLSX

#### Dependencias

- **AUTH** (tenantId, permissoes `reports:financial`)
- **Pedidos** (geracao automatica de recebiveis)
- **Compras** (geracao automatica de pagaveis)

---

### 3.8 Fiscal - NF-e (P1)

**Descricao:** Emissao, cancelamento e gestao de notas fiscais eletronicas (NF-e, NFC-e, NFS-e) com calculo automatico de impostos baseado no regime tributario, NCM e UF.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| FISC-01 | Emissao de NF-e (nota fiscal eletronica) | P1 | 5 |
| FISC-02 | Emissao de NFC-e (nota fiscal ao consumidor) | P2 | 8 |
| FISC-03 | Cancelamento de NF-e com motivo | P1 | 5 |
| FISC-04 | Carta de correcao (CC-e) | P2 | 8 |
| FISC-05 | Calculo automatico de ICMS, IPI, PIS, COFINS por NCM e UF | P1 | 5 |
| FISC-06 | Suporte a Simples Nacional (aliquota por faixa de faturamento) | P1 | 5 |
| FISC-07 | Suporte a Lucro Presumido e Lucro Real | P1 | 6 |
| FISC-08 | Regras fiscais configuraveis por NCM/UF (TaxRule) | P1 | 5 |
| FISC-09 | Cadastro de CFOPs | P1 | 5 |
| FISC-10 | Armazenamento de XML e DANFE (PDF) | P1 | 5 |
| FISC-11 | Consulta de status da NF na SEFAZ | P1 | 5 |
| FISC-12 | NF-e vinculada ao pedido (emissao automatica ao despachar) | P1 | 6 |
| FISC-13 | Inutilizacao de numeracao | P2 | 8 |

#### User Stories

**FISC-US01** -- Como **financeiro**, quero emitir NF-e a partir de um pedido de venda, com calculo automatico de impostos, para cumprir obrigacoes fiscais.
- **Criterios de aceite:**
  - NF-e gerada com dados do pedido, cliente e itens
  - Impostos calculados com base nas TaxRules configuradas (NCM + UF origem/destino + regime)
  - XML enviado a SEFAZ e protocolo de autorizacao armazenado
  - DANFE (PDF) gerado e armazenado
  - Status: DRAFT > PROCESSING > AUTHORIZED

**FISC-US02** -- Como **financeiro**, quero configurar regras fiscais por NCM e par de UFs, para que o sistema calcule impostos corretamente sem intervencao manual.
- **Criterios de aceite:**
  - CRUD de TaxRules com campos: NCM (suporta wildcard), UF origem, UF destino, regime, aliquotas
  - Priorizacao por especificidade (regra mais especifica vence)
  - Aplicacao automatica ao gerar NF-e

**FISC-US03** -- Como **financeiro**, quero cancelar uma NF-e autorizada informando o motivo, para corrigir erros dentro do prazo legal.
- **Criterios de aceite:**
  - Cancelamento enviado a SEFAZ
  - Motivo obrigatorio
  - Prazo legal: ate 24h apos autorizacao (validado pelo sistema)
  - Status: CANCELLED

#### Dependencias

- **AUTH** (tenantId)
- **Pedidos** (orderId para NF vinculada)
- **Produtos** (NCM, CEST para calculo)
- **Clientes** (dados do destinatario)

---

### 3.9 CRM (P2)

**Descricao:** Gestao de relacionamento com clientes, incluindo cadastro, scoring, segmentacao, historico de interacoes e pipeline de leads.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| CRM-01 | Cadastro de clientes (PF e PJ) com CPF/CNPJ | P0 | 2 |
| CRM-02 | Multiplos enderecos por cliente | P0 | 2 |
| CRM-03 | Historico de interacoes (nota, ligacao, email, reuniao, WhatsApp) | P2 | 7 |
| CRM-04 | Tags e segmentacao de clientes | P2 | 7 |
| CRM-05 | Scoring de cliente (baseado em volume de compras) | P2 | 8 |
| CRM-06 | Pipeline de leads (NEW > CONTACTED > QUALIFIED > PROPOSAL > WON/LOST) | P2 | 7 |
| CRM-07 | Conversao de lead para cliente | P2 | 7 |
| CRM-08 | Historico de compras do cliente (pedidos vinculados) | P1 | 4 |
| CRM-09 | Busca e filtros avancados (por tag, segmento, valor total, ultima compra) | P2 | 8 |

#### User Stories

**CRM-US01** -- Como **vendedor**, quero cadastrar um novo cliente com nome, documento e enderecos, para vincula-lo a pedidos e orcamentos.
- **Criterios de aceite:**
  - Validacao de CPF/CNPJ
  - Multiplos enderecos com marcacao de padrao
  - Deteccao de duplicidade por documento

**CRM-US02** -- Como **vendedor**, quero registrar interacoes com clientes (ligacoes, emails, notas), para manter historico centralizado.
- **Criterios de aceite:**
  - Tipos: NOTE, CALL, EMAIL, MEETING, WHATSAPP
  - Campo de assunto e conteudo
  - Vinculacao automatica ao usuario logado
  - Listagem cronologica no perfil do cliente

**CRM-US03** -- Como **vendedor**, quero gerenciar leads em um pipeline visual, para acompanhar o progresso de cada oportunidade.
- **Criterios de aceite:**
  - Kanban com colunas por status (NEW, CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST)
  - Drag & drop para mudar status
  - Atribuicao de responsavel (assignedTo)
  - Conversao para cliente ao marcar como WON

#### Dependencias

- **AUTH** (tenantId, permissoes `customers:*`)
- **Pedidos** (historico de compras)

---

### 3.10 Compras (P2)

**Descricao:** Gestao de ordens de compra a fornecedores, com fluxo de aprovacao, recebimento parcial e geracao automatica de contas a pagar e entrada de estoque.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| PUR-01 | CRUD de ordens de compra | P2 | 7 |
| PUR-02 | Fluxo de aprovacao (DRAFT > PENDING_APPROVAL > APPROVED > SENT) | P2 | 7 |
| PUR-03 | Recebimento parcial de itens | P2 | 7 |
| PUR-04 | Entrada de estoque automatica no recebimento | P2 | 7 |
| PUR-05 | Geracao de contas a pagar ao aprovar | P2 | 7 |
| PUR-06 | Cotacao com fornecedores | P2 | 9 |
| PUR-07 | Sugestao de compra baseada em estoque minimo | P2 | 9 |

#### User Stories

**PUR-US01** -- Como **gerente de operacoes**, quero criar uma ordem de compra para um fornecedor, para repor estoque de produtos com estoque critico.
- **Criterios de aceite:**
  - Selecao de fornecedor, produtos e quantidades
  - Calculo automatico de custos
  - Numero sequencial por tenant
  - Status inicial: DRAFT

**PUR-US02** -- Como **gerente de operacoes**, quero registrar o recebimento parcial de uma ordem de compra, para atualizar o estoque com os itens ja entregues.
- **Criterios de aceite:**
  - Quantidade recebida registrada por item (receivedQty)
  - Entrada de estoque automatica (MovementType: ENTRY, MovementReason: PURCHASE)
  - Status: PARTIALLY_RECEIVED ou RECEIVED
  - Custo medio recalculado

#### Dependencias

- **AUTH** (tenantId)
- **Produtos** (itens da compra)
- **Estoque** (entrada automatica)
- **Financeiro** (geracao de contas a pagar)
- **Fornecedores** (cadastro via modulo Produtos)

---

### 3.11 Relatorios (P1)

**Descricao:** Relatorios gerenciais e operacionais com exportacao, abrangendo vendas, estoque, financeiro e desempenho de marketplaces.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| REP-01 | Dashboard principal: faturamento, pedidos, ticket medio, estoque critico | P0 | 2 |
| REP-02 | Relatorio de vendas por periodo, canal, produto, vendedor | P1 | 5 |
| REP-03 | Relatorio de estoque: posicao atual, giro, cobertura | P1 | 5 |
| REP-04 | Relatorio financeiro: fluxo de caixa, aging, DRE | P1 | 6 |
| REP-05 | Relatorio de desempenho por marketplace | P1 | 6 |
| REP-06 | Exportacao para PDF e XLSX | P1 | 5 |
| REP-07 | Relatorios agendados por email | P2 | 9 |
| REP-08 | Relatorio de curva ABC de produtos | P2 | 8 |
| REP-09 | Relatorio de comissoes de marketplace | P2 | 8 |

#### User Stories

**REP-US01** -- Como **dono da loja**, quero ver um dashboard com KPIs de faturamento, pedidos, ticket medio e alertas de estoque, para ter visao rapida do negocio.
- **Criterios de aceite:**
  - Cards com valor atual e variacao vs periodo anterior
  - Grafico de receita vs despesa mensal
  - Grafico de pedidos por dia da semana
  - Dados carregados em menos de 3 segundos

**REP-US02** -- Como **dono da loja**, quero gerar relatorio de vendas filtrado por periodo e canal, para comparar desempenho entre marketplaces.
- **Criterios de aceite:**
  - Filtros: periodo, origem/canal, categoria, vendedor
  - Metricas: quantidade de pedidos, faturamento, ticket medio, margem
  - Exportacao para XLSX e PDF
  - Geracao assincrona para grandes volumes

#### Dependencias

- **AUTH** (tenantId, permissoes `reports:*`)
- **Pedidos** (dados de venda)
- **Estoque** (posicao e movimentacoes)
- **Financeiro** (fluxo de caixa, DRE)
- **Integracoes** (dados de marketplace)

---

### 3.12 Configuracoes (P2)

**Descricao:** Configuracoes gerais do tenant, preferencias do usuario, notificacoes e personalizacao do sistema.

#### Funcionalidades

| ID | Funcionalidade | Prioridade | Sprint |
|---|---|---|---|
| CFG-01 | Dados da empresa (nome, CNPJ, endereco, logo) | P0 | 1 |
| CFG-02 | Configuracao de regime tributario | P0 | 1 |
| CFG-03 | Gestao de plano e limites | P1 | 3 |
| CFG-04 | Preferencias de notificacao por usuario e evento | P2 | 7 |
| CFG-05 | Webhooks de saida (para integracao com sistemas externos) | P2 | 9 |
| CFG-06 | Configuracao de canais de venda (SalesChannel) | P1 | 3 |
| CFG-07 | Personalizacao de campos (metadata JSON) | P2 | 9 |
| CFG-08 | Importacao/exportacao geral de dados | P2 | 10 |

#### User Stories

**CFG-US01** -- Como **dono da loja**, quero configurar os dados da minha empresa e regime tributario, para que notas fiscais sejam emitidas corretamente.
- **Criterios de aceite:**
  - Edicao de nome, CNPJ, endereco, telefone, email
  - Selecao de regime tributario (SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, MEI)
  - Validacao de CNPJ
  - Alteracoes registradas em audit log

**CFG-US02** -- Como **usuario**, quero configurar quais notificacoes quero receber e por qual canal (in-app, email, SMS), para nao ser bombardeado com alertas irrelevantes.
- **Criterios de aceite:**
  - Lista de eventos (order_created, stock_low, payment_received, etc.)
  - Seletor de canais por evento
  - Persistencia em NotificationPreference

#### Dependencias

- **AUTH** (tenantId, permissoes `settings:*`)

---

## 4. Requisitos Nao-Funcionais

### 4.1 Performance

| Metrica | Target | Medida |
|---|---|---|
| Latencia de APIs (p50) | < 100ms | APM |
| Latencia de APIs (p95) | < 200ms | APM |
| Latencia de APIs (p99) | < 500ms | APM |
| Tempo de carregamento do dashboard | < 3s | RUM (Real User Monitoring) |
| Tempo de carregamento de listagens | < 2s | RUM |
| Processamento de webhook | < 5s | Logs |
| Sincronizacao de pedido ML | < 30s (end-to-end) | Logs |

### 4.2 Disponibilidade

| Metrica | Target |
|---|---|
| Uptime mensal | 99.9% (max 43min downtime/mes) |
| RTO (Recovery Time Objective) | < 15 minutos |
| RPO (Recovery Point Objective) | < 5 minutos |
| Deploys sem downtime | Zero-downtime (rolling deploy) |

### 4.3 Seguranca

| Requisito | Implementacao |
|---|---|
| Isolamento multi-tenant | Filtro `tenantId` em todas as queries; middleware de validacao; testes automatizados |
| Autenticacao | JWT com access token (15min) + refresh token (7d); bcrypt para senhas |
| Autorizacao | RBAC granular com permissoes por recurso e acao |
| Criptografia em transito | TLS 1.3 obrigatorio |
| Criptografia em repouso | Tokens de marketplace criptografados (AES-256) |
| LGPD | Soft delete; exportacao de dados pessoais; anonimizacao; consentimento; DPO |
| Audit trail | Log de todas as acoes criticas (CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT) |
| Rate limiting | 3 camadas (short/medium/long) via ThrottlerModule |
| Protecao contra ataques | Helmet, CORS configurado, sanitizacao de input, protecao contra SQL injection via Prisma |

### 4.4 Escalabilidade

| Metrica | Target |
|---|---|
| Tenants simultaneos | 1.000+ |
| Pedidos por dia por tenant | 10.000 |
| Pedidos totais no sistema por dia | 10.000.000 |
| Usuarios simultaneos por tenant | 50 |
| Tamanho do catalogo por tenant | 50.000 SKUs |
| Sincronizacoes de marketplace | 100 tenants sincronizando simultaneamente |

**Estrategias:**
- Processamento assincrono via BullMQ (Redis) com retry e backoff exponencial
- Indices otimizados no PostgreSQL (conforme schema.prisma)
- Cache em Redis para queries frequentes (dashboard, contadores)
- Paginacao cursor-based para listagens grandes
- Pool de conexoes com PgBouncer
- Horizontal scaling do API via containers stateless

### 4.5 Observabilidade

| Pilar | Ferramenta | Detalhe |
|---|---|---|
| Logs | Structured logging (JSON) | Correlacao por requestId e tenantId |
| Metricas | Prometheus + Grafana | Latencia, throughput, error rate, queue depth |
| Traces | OpenTelemetry | Trace distribuido API > Queue > Worker > DB |
| Alertas | Grafana Alerting | Latencia p95 > 500ms, error rate > 1%, fila > 1000 itens |
| Health check | /health endpoint | Verifica DB, Redis, servicos externos |
| Audit | AuditLog (banco) | Rastreio completo de acoes por usuario |

---

## 5. Roadmap (Sprints)

Sprints de 2 semanas.

### Sprint 1-2: MVP Core (Semanas 1-4)

**Objetivo:** Sistema funcional com autenticacao, catalogo de produtos, estoque basico e pedidos manuais.

| Sprint | Entregas |
|---|---|
| **Sprint 1** | AUTH-01 a AUTH-07, AUTH-11, PROD-01 a PROD-04, PROD-07 a PROD-09, INV-01 a INV-04, CFG-01, CFG-02 |
| **Sprint 2** | ORD-01 a ORD-07, ORD-09, ORD-11, INV-05, INV-06, CRM-01, CRM-02, REP-01 |

**Milestone:** Dono da loja pode cadastrar produtos, gerenciar estoque e processar pedidos manuais.

### Sprint 3-4: Integracoes (Semanas 5-8)

**Objetivo:** Integracao completa com Mercado Livre e inicio da Shopee, sincronizando pedidos e estoque automaticamente.

| Sprint | Entregas |
|---|---|
| **Sprint 3** | ML-01 a ML-07, ML-10 a ML-12, ORD-08, AUTH-08, CFG-06, PROD-10, INV-07, INV-08 |
| **Sprint 4** | MKT-01, MKT-06, MKT-07, ORD-10, CRM-08, PROD-05, PROD-06, PROD-11, CFG-03 |

**Milestone:** Pedidos do Mercado Livre e Shopee importados automaticamente; estoque sincronizado bidirecional.

### Sprint 5-6: Financeiro + Fiscal (Semanas 9-12)

**Objetivo:** Modulos financeiro e fiscal operacionais, permitindo emissao de NF-e e gestao de contas a pagar/receber.

| Sprint | Entregas |
|---|---|
| **Sprint 5** | FIN-01 a FIN-05, FIN-07, FIN-13, FISC-01, FISC-03, FISC-05, FISC-06, FISC-08 a FISC-11, REP-02, REP-03, REP-06, MKT-02, MKT-08, INV-09, INV-10, ML-08, ML-09, ORD-12 |
| **Sprint 6** | FIN-06, FIN-08 a FIN-12, FISC-07, FISC-12, REP-04, REP-05 |

**Milestone:** NF-e emitida automaticamente; fluxo de caixa e DRE disponiveis; conciliacao bancaria funcional.

### Sprint 7-8: CRM + Compras + Polish (Semanas 13-16)

**Objetivo:** Modulos de CRM e compras completos; refinamento de UX e funcionalidades avancadas.

| Sprint | Entregas |
|---|---|
| **Sprint 7** | CRM-03 a CRM-07, PUR-01 a PUR-05, CFG-04, MKT-03, ORD-13, PROD-12 |
| **Sprint 8** | CRM-05, CRM-09, FISC-02, FISC-04, FISC-13, MKT-04, MKT-05, FIN-14, REP-08, REP-09 |

**Milestone:** Pipeline de leads funcional; ordens de compra com aprovacao; integracao com Magalu e Shopify.

### Sprint 9-10: Performance + Deploy + QA (Semanas 17-20)

**Objetivo:** Otimizacao de performance, testes de carga, seguranca e preparacao para producao.

| Sprint | Entregas |
|---|---|
| **Sprint 9** | AUTH-09, AUTH-10, INV-11, PUR-06, PUR-07, CFG-05, CFG-07, REP-07 |
| **Sprint 10** | Testes de carga (1000 tenants, 10k pedidos/dia), security audit (OWASP), LGPD compliance review, monitoramento e alertas, documentacao de API, CFG-08 |

**Milestone:** Sistema pronto para producao; testes de carga aprovados; compliance verificado.

---

## 6. Metricas de Sucesso

### 6.1 KPIs de Produto

| KPI | Descricao | Meta (3 meses pos-lancamento) |
|---|---|---|
| **Time to First Order** | Tempo entre registro do tenant e primeiro pedido processado | < 30 minutos |
| **Taxa de ativacao** | % de trials que conectam pelo menos 1 marketplace | > 60% |
| **Taxa de conversao Trial > Pago** | % de trials que convertem para plano pago | > 25% |
| **Adocao por modulo** | % de tenants ativos usando cada modulo | Produtos: 100%, Pedidos: 95%, Estoque: 90%, ML: 70%, Financeiro: 50%, Fiscal: 40% |
| **Churn mensal** | % de tenants que cancelam por mes | < 5% |
| **NPS** | Net Promoter Score | > 40 |
| **Pedidos processados/dia** | Volume total no sistema | > 50.000 |

### 6.2 KPIs Operacionais

| KPI | Descricao | Meta |
|---|---|---|
| **Tempo medio de sincronizacao** | Latencia de pedido no marketplace ate aparecer no ERP | < 2 minutos |
| **Taxa de erro de sincronizacao** | % de sincronizacoes que falham | < 0.5% |
| **Uptime** | Disponibilidade mensal | 99.9% |
| **p95 de latencia de API** | Percentil 95 do tempo de resposta | < 200ms |
| **Taxa de emissao de NF-e com sucesso** | % de NF-e autorizadas na primeira tentativa | > 98% |

### 6.3 KPIs de Negocio

| KPI | Descricao | Meta (6 meses) |
|---|---|---|
| **Tenants ativos** | Empresas utilizando o sistema semanalmente | > 200 |
| **MRR (Monthly Recurring Revenue)** | Receita recorrente mensal | > R$ 100.000 |
| **LTV/CAC** | Razao entre lifetime value e custo de aquisicao | > 3 |
| **Volume transacionado** | Soma de pedidos processados pelo sistema | > R$ 50M/mes |

---

## 7. Riscos e Mitigacoes

### 7.1 Riscos Tecnicos

| # | Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|---|
| R1 | **APIs de marketplace instáveis** -- mudancas sem aviso, rate limits, downtime | Alta | Alto | Camada de abstração por marketplace; retry com backoff; circuit breaker; logs detalhados; monitoramento de saúde por conexao |
| R2 | **Complexidade fiscal brasileira** -- legislacao estadual variavel, mudancas frequentes | Alta | Alto | Engine de regras configuraveis (TaxRule); parceria com consultoria fiscal; tabelas de NCM/CFOP atualizaveis sem deploy |
| R3 | **Vazamento de dados cross-tenant** | Baixa | Critico | Middleware de tenantId em TODA query; testes automatizados de isolamento; code review obrigatorio; pentest trimestral |
| R4 | **Perda de dados** | Baixa | Critico | Backup automatico a cada 5 min (RPO); replicacao de banco; soft delete em todas as entidades criticas |
| R5 | **Degradacao de performance com crescimento** | Media | Alto | Indices otimizados (ja implementados no schema); cache Redis; processamento assincrono; paginacao cursor-based; monitoramento proativo |

### 7.2 Riscos de Produto

| # | Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|---|
| R6 | **Baixa adocao do modulo fiscal** -- sellers acostumados com sistemas dedicados | Media | Medio | UX simplificada; wizard de configuracao; emissao automatica vinculada ao pedido |
| R7 | **Churn alto no trial** -- sistema complexo demais para onboarding | Media | Alto | Onboarding guiado (checklist); templates de produtos e categorias; importacao de dados de planilha |
| R8 | **Concorrencia** -- ERPs estabelecidos (Tiny, Bling, Omie) | Alta | Alto | Foco em UX moderna e integracao profunda com marketplaces; pricing agressivo para PMEs; features exclusivas (analytics de marketplace, IA para pricing) |

### 7.3 Riscos Regulatorios

| # | Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|---|
| R9 | **LGPD** -- multas por tratamento inadequado de dados pessoais | Media | Alto | Soft delete implementado; endpoints de exportacao/anonimizacao; politica de privacidade; DPO designado; consentimento registrado |
| R10 | **Mudancas na legislacao fiscal** -- novas obrigacoes acessorias | Media | Medio | Regras fiscais configuraveis; equipe dedicada a atualizacoes regulatorias; parceria com consultoria |

---

## 8. Glossario de Termos do Dominio

| Termo | Definicao |
|---|---|
| **Tenant** | Empresa/loja que utiliza o ERP. Cada tenant tem dados completamente isolados. |
| **SKU** | Stock Keeping Unit -- codigo unico de identificacao do produto dentro da empresa. |
| **EAN/GTIN** | Codigo de barras internacional do produto. |
| **NCM** | Nomenclatura Comum do Mercosul -- classificacao fiscal do produto, usada para calculo de impostos. |
| **CEST** | Codigo Especificador da Substituicao Tributaria. |
| **CFOP** | Codigo Fiscal de Operacoes e Prestacoes -- identifica a natureza da operacao (venda, transferencia, devolucao). |
| **CST** | Codigo de Situacao Tributaria -- indica a tributacao do ICMS para empresas no Lucro Real/Presumido. |
| **CSOSN** | Codigo de Situacao da Operacao do Simples Nacional -- equivalente ao CST para empresas no Simples. |
| **NF-e** | Nota Fiscal Eletronica -- documento fiscal digital que registra operacoes de venda de mercadorias. |
| **NFC-e** | Nota Fiscal de Consumidor Eletronica -- versao simplificada da NF-e para venda ao consumidor final. |
| **NFS-e** | Nota Fiscal de Servico Eletronica -- documento fiscal para prestacao de servicos. |
| **DANFE** | Documento Auxiliar da Nota Fiscal Eletronica -- representacao grafica (PDF) da NF-e. |
| **SEFAZ** | Secretaria da Fazenda -- orgao estadual que autoriza NF-e. |
| **ICMS** | Imposto sobre Circulacao de Mercadorias e Servicos -- imposto estadual sobre vendas. |
| **IPI** | Imposto sobre Produtos Industrializados -- imposto federal sobre produtos industrializados. |
| **PIS** | Programa de Integracao Social -- contribuicao federal sobre o faturamento. |
| **COFINS** | Contribuicao para o Financiamento da Seguridade Social -- contribuicao federal sobre o faturamento. |
| **Simples Nacional** | Regime tributario simplificado para micro e pequenas empresas (faturamento ate R$ 4,8M/ano). |
| **Lucro Presumido** | Regime tributario onde a base de calculo do IRPJ/CSLL e presumida sobre o faturamento. |
| **Lucro Real** | Regime tributario onde o imposto e calculado sobre o lucro contabil efetivo. |
| **MEI** | Microempreendedor Individual -- regime simplificado para faturamento ate R$ 81.000/ano. |
| **DRE** | Demonstracao do Resultado do Exercicio -- relatorio contabil que mostra lucro ou prejuizo. |
| **Aging** | Relatorio de vencimento de titulos (recebiveis ou pagaveis) agrupados por faixa de dias. |
| **OFX** | Open Financial Exchange -- formato padrao de extrato bancario digital. |
| **Picking** | Processo de separacao de produtos no deposito para atender um pedido. |
| **Packing** | Processo de embalagem dos produtos separados. |
| **Expedicao** | Processo de despacho do pedido ja embalado para a transportadora. |
| **Listing** | Anuncio de um produto em um marketplace. |
| **Webhook** | Notificacao HTTP enviada por um sistema externo quando um evento ocorre. |
| **Rate Limiting** | Controle de frequencia de requisicoes para evitar sobrecarga e respeitar limites de APIs externas. |
| **Backoff Exponencial** | Estrategia de retry onde o intervalo entre tentativas dobra a cada falha. |
| **Circuit Breaker** | Padrao que interrompe chamadas a servicos com falha, permitindo recuperacao. |
| **RBAC** | Role-Based Access Control -- controle de acesso baseado em papeis. |
| **JWT** | JSON Web Token -- formato de token para autenticacao stateless. |
| **Multi-tenant** | Arquitetura onde uma unica instancia do sistema atende multiplas empresas com isolamento de dados. |
| **Custo Medio** | Metodo de valoracao de estoque que calcula o custo unitario pela media ponderada das entradas. |
| **Curva ABC** | Classificacao de produtos por importancia: A (20% dos itens = 80% do faturamento), B (30% = 15%), C (50% = 5%). |
| **Ruptura de Estoque** | Situacao em que um produto e vendido mas nao ha estoque disponivel para atender. |
| **Marketplace** | Plataforma de comercio eletronico que conecta vendedores e compradores (ex: Mercado Livre, Amazon, Shopee). |
| **Conciliacao Bancaria** | Processo de comparar lancamentos internos com o extrato bancario para identificar divergencias. |
| **Centro de Custo** | Unidade organizacional usada para classificar receitas e despesas (ex: "Logistica", "Marketing"). |
| **Plano de Contas** | Estrutura hierarquica de contas contabeis usada para elaborar o DRE. |

---

*Documento gerado em 2026-03-21. Proxima revisao prevista para o final da Sprint 2.*
