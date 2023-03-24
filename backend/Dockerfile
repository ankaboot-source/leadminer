FROM node:lts-alpine
WORKDIR /leadminer-api
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run update-providers
EXPOSE 8081
EXPOSE 8021
CMD ["node", "server.js"]
