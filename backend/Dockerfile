FROM node:lts-alpine
WORKDIR /leadminer-api
#copy both 'package.json' and 'package-lock.json' (if available)
COPY package*.json ./
RUN apk add git
RUN npm install
COPY ./ /leadminer-api
EXPOSE 8081
CMD ["node", "--expose_gc", "server.js"]
