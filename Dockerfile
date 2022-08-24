# syntax=docker/dockerfile:1
FROM alpine:latest
RUN apk add npm
COPY . /app

# Preparing frontend
RUN npm i --prefix /app/frontend
RUN npm run build --prefix /app/frontend

# Preparing backend
EXPOSE 8081
RUN rm /app/backend/config/*
RUN npm run build --prefix /app/frontend/
RUN npm i --prefix /app/backend
CMD npm start --prefix /app/backend
