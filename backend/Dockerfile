FROM node:lts-alpine
WORKDIR /leadminer-api
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8081
EXPOSE 8021
CMD ["sh", "-c", "exec node server.js --max-old-space-size=4096"]
