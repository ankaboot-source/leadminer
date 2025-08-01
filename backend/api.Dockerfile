# Build
FROM node:lts-alpine as build-stage
WORKDIR /leadminer-api
COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src
RUN npm install
RUN npm run update-providers
RUN npm run build

# Run
FROM node:lts-alpine as app-stage
WORKDIR /leadminer-api
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build-stage /leadminer-api/dist .

EXPOSE 8081
EXPOSE 8021

CMD ["node", "--max-old-space-size=2048", "server.js"]
