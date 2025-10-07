# Multi-stage build for Inworld Runtime Voice Agent on Cloudflare Containers
# Production-optimized Node.js container for voice agent template

FROM node:20-slim AS base

# Install dependencies required for native modules and pnpm
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY voice_agent/server/package.json ./

# Install dependencies and manually run postinstall for @inworld/runtime
RUN pnpm install && \
    cd node_modules/@inworld/runtime && \
    node ./scripts/binaries-unzip.cjs

# Development stage (for local testing)
FROM base AS development

WORKDIR /app

# Copy server source (includes local constants.ts)
COPY voice_agent/server/ ./
COPY models/ ./models/

# Expose port
EXPOSE 4000

CMD ["pnpm", "start"]

# Production build stage
FROM base AS build

WORKDIR /app

# Copy server source (includes local constants.ts)
COPY voice_agent/server/ ./
COPY models/ ./models/

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-slim AS production

# Install only runtime dependencies and pnpm
RUN apt-get update && apt-get install -y \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable \
    && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files for production install
COPY voice_agent/server/package.json ./

# Install only production dependencies and manually run postinstall for @inworld/runtime
RUN pnpm install --prod && \
    cd node_modules/@inworld/runtime && \
    node ./scripts/binaries-unzip.cjs

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/models ./models

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port for Cloudflare Container
EXPOSE 4000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the multi-tenant server
CMD ["node", "dist/index.multi-tenant.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Metadata
LABEL org.opencontainers.image.title="Inworld Runtime Voice Agent"
LABEL org.opencontainers.image.description="Voice agent template for Cloudflare Containers using Inworld Runtime"
LABEL org.opencontainers.image.source="https://github.com/inworld-ai/runtime-multimodal-companion-node"
LABEL org.opencontainers.image.vendor="Phantom Systems Inc"
