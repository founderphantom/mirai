# Multi-stage build for Inworld Runtime Voice Agent on Cloudflare Containers
# Production-optimized Node.js container for voice agent template

FROM node:20-slim AS base

# Install dependencies required for native modules, pnpm, and SSL certificates for gRPC
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    git \
    ca-certificates \
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

# Install tini for proper signal handling (ca-certificates already in base)
RUN apt-get update && apt-get install -y \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server source (includes local constants.ts)
COPY voice_agent/server/ ./
COPY models/ ./models/

# Expose port
EXPOSE 4000

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

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

# Install only runtime dependencies, pnpm, and SSL certificates for gRPC
RUN apt-get update && apt-get install -y \
    tini \
    ca-certificates \
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

# Verify models directory was copied
RUN echo "=== Verifying models directory ===" && \
    ls -la /app/models/ && \
    echo "=== VAD model file details ===" && \
    ls -lh /app/models/silero_vad.onnx || echo "WARNING: silero_vad.onnx not found!"

# Create non-root user for security (Debian syntax)
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nodejs && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app/models

USER nodejs

# Expose port for Cloudflare Container
EXPOSE 4000

# Use tini for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--"]

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
