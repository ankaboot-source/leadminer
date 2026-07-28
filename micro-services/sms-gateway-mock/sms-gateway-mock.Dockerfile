# Build stage
FROM oven/bun:alpine AS build-stage
WORKDIR /leadminer-sms-gateway-mock-service
COPY package.json bun.lock ./
COPY tsconfig*.json ./
COPY src ./src
RUN bun install
RUN bun run build


# Runtime stage
FROM oven/bun:alpine AS app-stage
WORKDIR /leadminer-sms-gateway-mock-service

# ✅ Create node user
RUN addgroup node \
 && adduser -D -G node -s /bin/sh node

COPY --chown=node:node package.json bun.lock ./
RUN bun install --production
COPY --from=build-stage /leadminer-sms-gateway-mock-service/dist .

USER node

EXPOSE 8085

CMD ["bun", "server.js"]
