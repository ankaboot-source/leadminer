FROM node:lts-alpine
WORKDIR /leadminer-api
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8081
CMD ["node", "--expose_gc", "server.js"]
