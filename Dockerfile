# ---------- base con toolchain nativo (sharp, argon2) ----------
FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ---------- build: deps completas + prisma generate + nest build ----------
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------- prod-deps: solo runtime deps, mismo toolchain para compilar nativos ----------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# el client generado en `build` vive dentro de @prisma/client; se reinyecta aquí
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# ---------- runtime ----------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends \
      openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
USER node
EXPOSE 3001
CMD ["node", "dist/main"]
