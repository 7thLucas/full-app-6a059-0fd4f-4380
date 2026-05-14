#### Stage 1: Builder – install all deps & build Remix
FROM node:20-slim AS builder

WORKDIR /app

# Install OS deps (if later butuh) & enable smaller npm cache
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (including devDeps for build)
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .

ENV NODE_ENV=production

# Build Remix (output to ./build)
RUN npm run build


#### Stage 2: Runtime – minimal image for running the server
FROM node:20-slim AS runner

WORKDIR /app

# Non-root user for better security
RUN useradd -m appuser

# Only install production deps (requires lockfile for npm ci)
COPY package.json ./
RUN npm install

# ============================================
# Build arguments (passed via --build-arg)
# ============================================
# Server Configuration
ARG PORT=3000
ARG NODE_ENV=production

# MongoDB Configuration
ARG MONGODB_URI

# JWT Configuration
ARG JWT_SECRET=random-123
ARG JWT_EXPIRES_IN=7d
ARG JWT_REFRESH_EXPIRES_IN=30d

# External API
ARG EXTERNAL_API_KEY=QlgxMGMwWFowUmoxMk5uVUhPeGVyaUV4UDFVWENMRk5IZ2ZXT3FXRTJuOTVsa1ZITURWZlFkQWowbDUxZ0xGc3VjR0lhNW02R1p5Y3JCX3VqejNIT2c

# Admin Seeding Configuration
ARG SEED_ADMIN_ENABLE=true
ARG SEED_ADMIN_USERNAME=admin
ARG SEED_ADMIN_EMAIL=admin@quantumteknologi.com
ARG SEED_ADMIN_PASSWORD=admin

# Public Frontend Configuration
ARG VITE_PUBLIC_COOKIE_PREFIX=qb_
ARG VITE_GOOGLE_MAPS_API_KEY=qb_
ARG VITE_KEYSPACE
ARG VITE_ROLE=client
ARG VITE_USER_ID
ARG VITE_CDN_URL

# Modules: Chat Assistant
ARG OPENAI_API_KEY
ARG QB_DECK_API_URL

# ============================================
# Environment variables (set from build args)
# ============================================
# Server Configuration
ENV PORT=${PORT}
ENV NODE_ENV=${NODE_ENV}

# MongoDB Configuration
ENV MONGODB_URI=${MONGODB_URI}

# JWT Configuration
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_EXPIRES_IN=${JWT_EXPIRES_IN}
ENV JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN}

# External API
ENV EXTERNAL_API_KEY=${EXTERNAL_API_KEY}

# Admin Seeding Configuration
ENV SEED_ADMIN_ENABLE=${SEED_ADMIN_ENABLE}
ENV SEED_ADMIN_USERNAME=${SEED_ADMIN_USERNAME}
ENV SEED_ADMIN_EMAIL=${SEED_ADMIN_EMAIL}
ENV SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD}

# Public Frontend Configuration
ENV VITE_PUBLIC_COOKIE_PREFIX=${VITE_PUBLIC_COOKIE_PREFIX}
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}
ENV VITE_KEYSPACE=${VITE_KEYSPACE}
ENV VITE_ROLE=${VITE_ROLE}
ENV VITE_USER_ID=${VITE_USER_ID}
ENV VITE_CDN_URL=${VITE_CDN_URL}

# Modules: Chat Assistant
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV QB_DECK_API_URL=${QB_DECK_API_URL}

# Copy built assets from builder
COPY --from=builder /app/build ./build

# Copy source code needed by server (TS + app code)
COPY . .

# Environment
ENV NODE_ENV=production \
    PORT=3000

# Make sure our user owns the app directory
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 3000

# In production we want the built Remix bundle; server.ts will detect NODE_ENV
# and use ./build/server/index.js for the Remix handler.
CMD ["npm", "run", "start:prod"]


