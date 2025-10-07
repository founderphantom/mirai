# Multi-stage build for Inworld Runtime Voice Agent on Cloudflare Containers
# Production-optimized Node.js container for voice agent template

FROM node:20-alpine AS base

# Install dependencies required for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# Copy package files
COPY voice_agent/server/package.json voice_agent/server/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --production=false

# Development stage (for local testing)
FROM base AS development

WORKDIR /app

# Copy server source
COPY voice_agent/server/ ./
COPY voice_agent/constants.ts ./constants.ts
COPY models/ ./models/

# Expose port
EXPOSE 4000

CMD ["yarn", "start"]

# Production build stage
FROM base AS build

WORKDIR /app

# Copy server source
COPY voice_agent/server/ ./
COPY voice_agent/constants.ts ./constants.ts
COPY models/ ./models/

# Build TypeScript
RUN yarn build

# Production stage
FROM node:20-alpine AS production

# Install only runtime dependencies
RUN apk add --no-cache \
    tini

WORKDIR /app

# Copy package files for production install
COPY voice_agent/server/package.json voice_agent/server/yarn.lock ./

# Install only production dependencies
RUN yarn install --frozen-lockfile --production=true && \
    yarn cache clean

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/models ./models
COPY --from=build /app/constants.ts ./constants.ts

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Expose port for Cloudflare Container
EXPOSE 4000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "dist/index.js"]

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Metadata
LABEL org.opencontainers.image.title="Inworld Runtime Voice Agent"
LABEL org.opencontainers.image.description="Voice agent template for Cloudflare Containers using Inworld Runtime"
LABEL org.opencontainers.image.source="https://github.com/inworld-ai/runtime-multimodal-companion-node"
LABEL org.opencontainers.image.vendor="Phantom Systems Inc"
