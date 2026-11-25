# Stage 1: Build
FROM node:24-bookworm-slim AS builder
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder" \
    npx prisma generate --config=prisma7.config.ts

RUN npm run build

# Stage 2: Database migrations
FROM builder AS migration

USER node

CMD ["./node_modules/.bin/prisma", "migrate", "deploy", "--config=prisma7.config.ts"]

# Stage 3: Production dependencies
FROM builder AS production-deps

RUN npm prune --omit=dev

# Stage 4: Production runtime
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder --chown=node:node /app/package.json ./
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]