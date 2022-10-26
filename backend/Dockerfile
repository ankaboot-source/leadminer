FROM node:lts-alpine
WORKDIR /leadminer-api
COPY package.json /leadminer-api
RUN npm install
COPY ./ /leadminer-api
EXPOSE 8081
CMD ["node", "--expose_gc", "server.js"]
