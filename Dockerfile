# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /build

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src ./src
COPY bin ./bin

# Build the project
RUN npm run build

# Production stage
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && \
    npm cache clean --force

# Copy built files from builder stage
COPY --from=builder /build/dist ./dist
COPY --from=builder /build/bin ./bin

# Copy necessary files
COPY README.md LICENSE CHANGELOG.md ./
COPY docs ./docs
COPY examples ./examples

# Create directory for user's SVG files
RUN mkdir -p /workspace/input /workspace/output && \
    chmod -R 777 /workspace

# Set working directory to workspace
WORKDIR /workspace

# Create non-root user
RUN addgroup -g 1001 -S svger && \
    adduser -S -u 1001 -G svger svger && \
    chown -R svger:svger /app /workspace

USER svger

# Add global bin to PATH
ENV PATH="/app/bin:${PATH}"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "console.log('healthy')" || exit 1

# Set entrypoint
ENTRYPOINT ["dumb-init", "--", "node", "/app/bin/svg-tool.js"]

# Default command (show help)
CMD ["--help"]

# Labels
LABEL org.opencontainers.image.title="SVGER-CLI" \
      org.opencontainers.image.description="Enterprise-grade, zero-dependency SVG to component converter" \
      org.opencontainers.image.version="3.0.0" \
      org.opencontainers.image.authors="Faeze Mohades <faezemohades@gmail.com>" \
      org.opencontainers.image.url="https://github.com/faezemohades/svger-cli" \
      org.opencontainers.image.source="https://github.com/faezemohades/svger-cli" \
      org.opencontainers.image.licenses="MIT"
