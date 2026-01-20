# Build stage
FROM oven/bun:1.1.7-alpine AS build-stage
WORKDIR /leadminer-email-fetcher-service
COPY package.json bun.lockb ./
COPY tsconfig*.json ./
COPY src ./src
RUN bun install
RUN bun run build


# Runtime stage
FROM oven/bun:1.1.7-alpine AS app-stage
WORKDIR /leadminer-email-fetcher-service
COPY package.json bun.lockb ./
RUN bun install --production
COPY --from=build-stage /leadminer-email-fetcher-service/dist .

EXPOSE 8083
EXPOSE 8023

CMD ["bun", "server.js"]
