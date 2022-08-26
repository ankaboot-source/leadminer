# syntax=docker/dockerfile:1
FROM alpine:latest
RUN apk add npm socat py-pip
COPY . /app
RUN pip install niet

# Preparing frontend
RUN npm i --prefix /app/frontend
RUN npm run build --prefix /app/frontend

# Preparing backend
EXPOSE 8081
RUN rm /app/backend/config/*
RUN npm i --prefix /app/backend
CMD /app/backend/redirect.sh & npm start --prefix /app/backend
