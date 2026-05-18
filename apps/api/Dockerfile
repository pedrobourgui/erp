# =============================================================================
# Stage 1 – Install dependencies
# =============================================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validators/package.json ./packages/validators/
COPY packages/constants/package.json ./packages/constants/

RUN npm ci --workspace=apps/api --include-workspace-root

# =============================================================================
# Stage 2 – Build
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages
COPY tsconfig*.json ./

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/src/database/prisma/schema.prisma

# Build the NestJS application
WORKDIR /app/apps/api
RUN npx nest build

# =============================================================================
# Stage 3 – Production image
# =============================================================================
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat openssl dumb-init

ENV NODE_ENV=production

WORKDIR /app

# Copy built output and necessary files
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/src/database/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./package.json

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]

# =============================================================================
# Dev target – used with docker compose for local development
# =============================================================================
FROM node:20-alpine AS dev

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate --schema=apps/api/src/database/prisma/schema.prisma

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["npm", "run", "dev"]
