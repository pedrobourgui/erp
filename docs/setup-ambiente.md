# Setup do Ambiente de Desenvolvimento — ERP

Guia para colocar o monorepo ERP rodando localmente. O projeto é um monorepo Turborepo com uma API NestJS (`apps/api`) e um frontend Next.js 14 com App Router (`apps/web`), além de pacotes compartilhados (`packages/constants`, `packages/shared-types`, `packages/validators`).

---

## 1. Pré-requisitos

Instale antes de qualquer coisa:

| Ferramenta       | Versão mínima | Observação |
|------------------|---------------|------------|
| Node.js          | `>=20.0.0`    | Definido em `package.json` (`engines`). Recomendado via [nvm](https://github.com/nvm-sh/nvm) ou [fnm](https://github.com/Schniz/fnm). |
| npm              | `10.x`        | `packageManager: npm@10.0.0`. Não use yarn/pnpm — quebra o lockfile. |
| Docker           | `>=24`        | Para Postgres, Redis e MinIO. |
| Docker Compose   | v2 (`docker compose`) | Já incluso no Docker Desktop. |
| Git              | qualquer recente | — |

Verificação rápida:

```bash
node -v        # >= v20
npm -v         # 10.x
docker -v
docker compose version
```

---

## 2. Clonar e instalar dependências

```bash
git clone <repo-url> erp
cd erp
npm install
```

O `npm install` na raiz instala dependências de todos os workspaces (`apps/*` e `packages/*`) graças à configuração de workspaces no `package.json`.

---

## 3. Variáveis de ambiente

Copie os arquivos `.env.example` em cada app:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### `apps/api/.env` — pontos de atenção

- `DATABASE_URL` — aponta para o Postgres do Docker Compose. O `docker-compose.yml` sobe o banco com:
  - DB: `erp`
  - user: `erp_user`
  - senha: `erp_secret_2024`
  - porta: `5432`

  Ajuste a URL para refletir essas credenciais:
  ```
  DATABASE_URL="postgresql://erp_user:erp_secret_2024@localhost:5432/erp?schema=public"
  ```
- `REDIS_PORT` — o Compose expõe Redis em **6380** no host (mapeado para 6379 dentro do container). Se for rodar a API fora do Docker, use `REDIS_PORT=6380`.
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — gere segredos fortes (não use os defaults). Sugestão:
  ```bash
  openssl rand -base64 48
  ```
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — alinhe com o Compose (`erp_minio` / `erp_minio_secret`) ou ajuste o Compose. Crie o bucket definido em `MINIO_BUCKET` (default `erp-files`) na primeira execução pelo console MinIO.
- `SEFAZ_*` / `SMTP_*` — opcionais em dev. Deixe vazio se não for testar emissão fiscal ou envio de e-mail.

### `apps/web/.env`

- `NEXT_PUBLIC_API_URL=http://localhost:3000/api` — confira se bate com a porta da API (`PORT` no `.env` da API). O `docker-compose.yml` mapeia a API em `3001`, mas o `.env.example` da API usa `PORT=3000`. **Escolha um e mantenha consistência** entre as duas variáveis.

> Nenhum arquivo `.env` deve ser commitado — eles já estão no `.gitignore`.

---

## 4. Subir infraestrutura (Postgres + Redis + MinIO)

A forma mais comum em dev é rodar **apenas a infra** no Docker e rodar API e Web localmente (melhor DX, hot-reload nativo, debugging).

```bash
docker compose up -d postgres redis minio
```

Confirme que os serviços estão saudáveis:

```bash
docker compose ps
```

Endpoints expostos no host:

| Serviço     | Host          | Porta | Credenciais |
|-------------|---------------|-------|-------------|
| Postgres    | `localhost`   | 5432  | `erp_user` / `erp_secret_2024` |
| Redis       | `localhost`   | 6380  | sem senha   |
| MinIO API   | `localhost`   | 9000  | `erp_minio` / `erp_minio_secret` |
| MinIO Console | `localhost` | 9001  | mesmas       |

Acesse o console MinIO em http://localhost:9001 e crie o bucket `erp-files` (ou o nome que estiver em `MINIO_BUCKET`).

### Alternativa: subir tudo no Docker

```bash
npm run docker:up        # sobe postgres, redis, minio, api, web
npm run docker:down      # derruba tudo
```

Útil para validar build de produção, mas mais lento em loop de desenvolvimento.

---

## 5. Banco de dados (Prisma)

Com o Postgres no ar:

```bash
# Gera o Prisma Client a partir do schema
npm run db:generate

# Cria/aplica migrations em dev
npm run db:migrate

# Popula dados iniciais (tenants demo, usuário admin, etc.)
npm run db:seed
```

Os scripts vivem em `apps/api` (`prisma generate`, `prisma migrate dev`, `ts-node src/database/prisma/seed.ts`) e são despachados pelo Turborepo com filtro `--filter=@erp/api`.

Inspecionar o banco visualmente:

```bash
cd apps/api && npm run db:studio    # abre Prisma Studio em http://localhost:5555
```

---

## 6. Rodar em desenvolvimento

Na raiz do monorepo:

```bash
npm run dev
```

Isso executa `turbo run dev` em paralelo nos workspaces que têm o script `dev`:

- **API** (NestJS, `nest start --watch`) — http://localhost:3000 (ou 3001 conforme `.env`)
- **Web** (Next.js, `next dev`) — http://localhost:3001 (default Next quando 3000 está ocupado; alinhe via flag se necessário)

Para subir apenas um app:

```bash
npm run dev --workspace=@erp/api
npm run dev --workspace=@erp/web
```

### URLs úteis em dev

| O quê                 | URL                              |
|-----------------------|----------------------------------|
| Frontend              | http://localhost:3001            |
| API (REST)            | http://localhost:3000/api/v1     |
| Swagger / OpenAPI     | http://localhost:3000/api/docs *(se habilitado em `main.ts`)* |
| Prisma Studio         | http://localhost:5555            |
| MinIO Console         | http://localhost:9001            |

---

## 7. Testes

```bash
npm run test                       # roda em todos os workspaces (turbo)
npm run test --workspace=@erp/api  # apenas backend (Jest)
npm run test --workspace=@erp/web  # apenas frontend (Vitest)
```

Modo watch:

```bash
cd apps/api && npm run test:watch
cd apps/web && npx vitest
```

Lembre-se das diretrizes TDD descritas em `apps/api/CLAUDE.md` e `apps/web/CLAUDE.md`: teste falhando primeiro, implementação depois.

---

## 8. Build de produção (sanity check)

```bash
npm run build
```

Turborepo roda `nest build` e `next build` respeitando o cache. Use para validar antes de subir PR.

---

## 9. Problemas comuns

| Sintoma | Causa provável | Como resolver |
|---------|----------------|---------------|
| `ECONNREFUSED 127.0.0.1:5432` | Postgres não subiu ou docker-compose não está up | `docker compose ps`; reinicie com `docker compose up -d postgres` |
| `ECONNREFUSED 127.0.0.1:6379` | API tentando Redis na porta padrão; Compose expõe **6380** | Use `REDIS_PORT=6380` no `.env` da API quando rodar fora do Docker |
| `PrismaClientInitializationError` | `DATABASE_URL` divergente das credenciais do Compose | Sincronize user/senha/db com `docker-compose.yml` |
| `Module not found: @erp/shared-types` | `npm install` não rodou na raiz | Rode `npm install` na raiz, não dentro de `apps/*` |
| Porta 3000/3001 em uso | Outro processo rodando | `lsof -i :3000` e mate o processo, ou troque a porta no `.env` |
| MinIO retorna `NoSuchBucket` | Bucket não foi criado | Abra http://localhost:9001 e crie o bucket `erp-files` |
| Migration falha com "tenantId required" | Esqueceu de seedar o tenant base | `npm run db:seed` |
| `any` ou `console.log` reprovado no lint | Regras de Clean Code dos CLAUDE.md | Veja `apps/api/CLAUDE.md` e `apps/web/CLAUDE.md` |

---

## 10. Comandos de referência

```bash
# Instalação
npm install

# Infra (Docker)
docker compose up -d postgres redis minio
docker compose down
docker compose logs -f api

# Database
npm run db:generate
npm run db:migrate
npm run db:seed
cd apps/api && npm run db:studio

# Dev
npm run dev
npm run dev --workspace=@erp/api
npm run dev --workspace=@erp/web

# Qualidade
npm run lint
npm run test
npm run build

# Limpeza
npm run clean
```

---

## 11. Próximos passos

- Leia o **PRD** em `docs/PRD.md` para o panorama do produto.
- Leia o **PRD de Pagamentos/Pedidos** em `docs/prd-pagamentos-pedidos.md`.
- Estude as regras de código antes de abrir o primeiro PR:
  - Backend: `apps/api/CLAUDE.md` (DDD, multi-tenancy, TDD).
  - Frontend: `apps/web/CLAUDE.md` (App Router, React Query, máscaras BR, TDD).
