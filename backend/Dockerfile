FROM node:lts-alpine
WORKDIR /leadminer-api
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8081
EXPOSE 8021
CMD ["sh", "-c", "exec node --max_old_space_size=1024 --expose-gc server.js"]
