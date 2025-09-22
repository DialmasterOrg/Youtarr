# ---- Base Node ----
FROM node:20-slim AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS dependencies
COPY package*.json ./
# Skip prepare script (husky) for production dependencies
RUN npm ci --only=production --ignore-scripts

# ---- Build ----
FROM base AS build
COPY package*.json ./
RUN npm ci

# Copy and build the React frontend
COPY client/package*.json ./client/
RUN cd client && npm ci --unsafe-perm=true --allow-root
COPY client/ ./client/
# Set permissions and build
RUN chmod -R 755 ./client/node_modules/.bin || true
RUN cd client && npm run build --unsafe-perm=true --allow-root

# Copy server code, scripts, and migrations
COPY server/ ./server/
COPY scripts/ ./scripts/
COPY migrations/ ./migrations/

# ---- Release ----
FROM node:20-slim AS release
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Download the latest yt-dlp release directly from GitHub
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod +x /usr/local/bin/yt-dlp

# Copy production node_modules
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application files
COPY --from=build /app/server ./server
COPY --from=build /app/client/build ./client/build
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/migrations ./migrations

# Copy the entrypoint script
COPY --from=build /app/scripts/docker-entrypoint-simple.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh

# Expose port for the application
EXPOSE 3011

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3011/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Use the entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]