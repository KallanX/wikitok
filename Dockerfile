# Multi-stage build for WikiTok frontend
# Stage 1: Build static assets
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for optimal layer caching
COPY frontend/package.json frontend/bun.lock* ./

# Install dependencies using exact lockfile
RUN bun install --frozen-lockfile

# Copy frontend source code
COPY frontend/ ./

# Build production bundle
RUN bun run build

# Stage 2: Production runtime using Bun
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DIST_DIR=/app/dist

# Copy built assets and server script
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/server.ts ./server.ts
COPY --from=builder --chown=bun:bun /app/server ./server

# Run as non-root user
USER bun

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "run", "server.ts"]
