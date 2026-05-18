# =============================================================================
# Stage 1 – Install dependencies
# =============================================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validators/package.json ./packages/validators/
COPY packages/constants/package.json ./packages/constants/

RUN npm ci --workspace=apps/web --include-workspace-root

# =============================================================================
# Stage 2 – Build
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code and packages
COPY apps/web ./apps/web
COPY packages ./packages
COPY tsconfig*.json ./
COPY package.json ./

# Recreate workspace symlinks for @erp/* packages
RUN cd node_modules/@erp && \
    rm -rf shared-types validators constants && \
    ln -s ../../packages/shared-types shared-types && \
    ln -s ../../packages/validators validators && \
    ln -s ../../packages/constants constants

# Set build-time environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/web
RUN npm run build

# =============================================================================
# Stage 3 – Production image (standalone output)
# =============================================================================
FROM node:20-alpine AS production

RUN apk add --no-cache libc6-compat dumb-init

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (preserves monorepo structure under /app)
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
