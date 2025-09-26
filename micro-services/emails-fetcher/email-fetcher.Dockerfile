# Build
FROM node:lts-alpine as build-stage
WORKDIR /leadminer-email-fetcher-service
COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src
RUN npm install
RUN npm run build

# Run
FROM node:lts-alpine as app-stage
WORKDIR /leadminer-email-fetcher-service
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build-stage /leadminer-email-fetcher-service/dist .

EXPOSE 8083
EXPOSE 8023

CMD ["node", "--max-old-space-size=2048", "server.js"]
