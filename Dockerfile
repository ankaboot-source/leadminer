# syntax=docker/dockerfile:1
FROM alpine:latest
RUN apk add npm
COPY . /leadminer
RUN npm i --prefix /leadminer/backend
RUN npm i --prefix /leadminer/frontend
EXPOSE 8081
CMD npm start --prefix /leadminer/backend & npm start --prefix /leadminer/frontend
