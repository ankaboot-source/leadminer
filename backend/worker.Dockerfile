# Build
FROM node:lts-alpine
WORKDIR /leadminer-worker
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
RUN npm install
RUN npm run build

# Run
FROM node:lts-alpine
WORKDIR /leadminer-worker
COPY package*.json ./
RUN npm install --omit-dev
COPY --from=0 /leadminer-worker/dist .

CMD [ "node", "messageWorker.js" ]