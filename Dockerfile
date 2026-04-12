# syntax=docker/dockerfile:1

# ============================================
# Base image with Bun (Alpine)
# ============================================
FROM oven/bun:1.3.3-alpine AS base
WORKDIR /app

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps

# Copy package files first (for layer caching)
COPY package.json bun.lock ./

# Install dependencies with cache mount
RUN --mount=type=cache,id=bun-cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

# ============================================
# Builder stage
# ============================================
FROM base AS builder

# Build-time arguments for NEXT_PUBLIC_* variables (baked into bundle)
ARG NEXT_PUBLIC_APP_URL
ARG BETTER_AUTH_SECRET
ARG MONGODB_URI
ARG REDIS_URL

# Set build-time environment variables
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV MONGODB_URI=$MONGODB_URI
ENV REDIS_URL=$REDIS_URL
# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Build Next.js with cache mount for .next/cache
RUN --mount=type=cache,id=nextjs-cache,target=/app/.next/cache \
    bun run build

# ============================================
# Production runner stage (Standalone)
# ============================================
FROM oven/bun:1.3.3-alpine AS runner

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* variables (baked at build time, but set here for reference)
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV BETTER_AUTH_SECRET=$BETTER_AUTH_SECRET
ENV MONGODB_URI=$MONGODB_URI
ENV REDIS_URL=$REDIS_URL
# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy public folder (required for static assets like images, fonts, etc.)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy static files (required for CSS, JS chunks, etc.)
# These are not included in standalone by default
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the port
EXPOSE 3000

# Set hostname for Dokploy/Docker Swarm compatibility
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD bun -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start Next.js standalone server
CMD ["bun", "server.js"]
