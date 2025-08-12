FROM node:lts-alpine as build-stage

WORKDIR /frontend
COPY . .

RUN npm install && npm run build

EXPOSE 3000

CMD [ "node", ".output/server/index.mjs" ]
