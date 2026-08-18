# ADR 0001 — Estratégia de token de sessão

- **Status:** aceita (etapa 1 implementada; etapa 2 adiada conscientemente)
- **Data:** 01/08/2026
- **Contexto do bug:** AE-19 (lote 4 — autorização e sessão no frontend)

## Contexto

`erp_token` (acesso, 15 min) e `erp_refresh_token` vivem em `localStorage`. Todo script que rode
na origem da aplicação lê os dois — um XSS em qualquer tela entrega a sessão inteira, e o refresh
era de **7 dias**, então o atacante mantinha acesso por uma semana mesmo depois de o usuário sair.

O que já existia e continua valendo:

- rotação do refresh a cada uso (`auth.service.ts:refreshToken` apaga a chave antiga no Redis e a
  coloca na blacklist);
- revogação no logout do lado do servidor (`auth.service.ts:logout`);
- access token curto (15 min).

## Decisão

**Etapa 1 (feita agora).** Reduzir a janela do refresh token de 7 dias para **24 horas**
(`REFRESH_TOKEN_TTL_SECONDS`, `BLACKLIST_TTL_SECONDS` e `jwt.refreshExpiresIn`). Isso não impede o
roubo — reduz o tempo em que ele vale. Custo: quem não usa o sistema por um dia refaz o login.

**Etapa 2 (adiada).** Migrar para cookie `httpOnly` + `SameSite=Lax` + token CSRF, com o Next
atuando como BFF nas rotas de autenticação. É a correção real: o token deixa de ser legível por
JavaScript e o XSS deixa de ser equivalente a roubo de sessão.

## Por que a etapa 2 não entrou neste lote

Ela não é uma mudança de uma linha: exige rota de auth no Next (BFF), mudança de CORS
(`credentials: true` e origem explícita), reescrita do interceptor do Axios (que hoje lê o token do
`localStorage` e o injeta no header), emissão e validação de token CSRF em toda mutação, e revisão
dos testes de autenticação das duas pontas. Misturar isso com o lote 4 — que é sobre **autorização
na UI** — juntaria dois riscos diferentes na mesma entrega, e a parte de autorização é a que estava
travando o vendedor (VD-07).

## Consequências

- **Aceito conscientemente:** até a etapa 2, um XSS ainda compromete a sessão por até 24 h. A
  mitigação real é impedir o XSS (CSP, escape no render, dependências auditadas), não o TTL.
- Usuários inativos por mais de 24 h refazem o login. Se isso incomodar na prática, o caminho é a
  etapa 2 — **não** aumentar o TTL de volta.
- A etapa 2 deve virar tarefa própria, com seu próprio plano. Enquanto não existir, esta ADR é o
  registro de que a exposição é conhecida e não um esquecimento.

## Alternativas descartadas

- **Manter 7 dias e confiar na rotação.** A rotação detecta reuso do *mesmo* token; não ajuda em
  nada se o atacante roubou o token mais recente, que é o caso do XSS.
- **Guardar o token em memória apenas (sem persistência).** Encerra a sessão a cada refresh de
  página — inaceitável para um ERP usado o dia inteiro — e não protege contra XSS, que roda no
  mesmo contexto onde a memória vive.
