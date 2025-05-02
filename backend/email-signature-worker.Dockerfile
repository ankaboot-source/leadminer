# Build
FROM node:lts-alpine as build-stage
WORKDIR /leadminer-worker
COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src
RUN npm install
RUN npm run build

# Run
FROM node:lts-alpine
WORKDIR /leadminer-worker
COPY package*.json ./
RUN npm install --omit-dev
COPY --from=build-stage /leadminer-worker/dist .

CMD [ "node", "--max-old-space-size=4096", "emailSignatureWorker.js" ]
