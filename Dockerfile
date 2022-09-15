# syntax=docker/dockerfile:1
# Develop Stage
FROM node:18.9.0-slim as develop-stage
WORKDIR /usr/src/leadminer/frontend
COPY frontend/package*.json ./
RUN yarn global add @quasar/cli
COPY frontend .

# build stage
FROM develop-stage as build-stage
RUN yarn
RUN quasar build

# Production stage
FROM node:18.9.0-slim as production-stage
WORKDIR /usr/src/leadminer/frontend
COPY frontend/package*.json ./
RUN npm ci --only=production
RUN mkdir -p /var/www/html/dist
COPY --from=build-stage /usr/src/leadminer/frontend/dist ./dist

WORKDIR /usr/src/leadminer/backend
COPY backend/package*.json ./
RUN npm ci --only=production

WORKDIR /usr/src/leadminer
COPY . .

WORKDIR /usr/src/leadminer/backend
CMD cp -r /usr/src/leadminer/frontend/dist/spa /var/www/html/dist/ && node --expose_gc server.js
