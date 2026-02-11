# UAS Backend — Production Docker Image
# Multi-stage build: compile TypeScript, then run from minimal image.

FROM node:22-slim AS builder

WORKDIR /build

# Copy engine (local dependency for backend if needed)
COPY engine/package*.json engine/
COPY engine/src/ engine/src/
COPY engine/tsconfig.json engine/
RUN cd engine && npm install && npm run build

# Copy backend
COPY backend/package*.json backend/
COPY backend/tsconfig.json backend/
COPY backend/src/ backend/src/
RUN cd backend && npm install && npm run build

# --- Production stage ---
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV UAS_PORT=3100
ENV UAS_DB_PATH=/data/uas.db
ENV UAS_LOG_LEVEL=info

# Copy built backend
COPY --from=builder /build/backend/dist/ ./dist/
COPY --from=builder /build/backend/package*.json ./

# Install only production deps
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Create data volume mount point
RUN mkdir -p /data

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD node -e "fetch('http://localhost:3100/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

USER node

CMD ["node", "dist/server.js"]
