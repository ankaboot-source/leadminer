FROM node:lts-alpine as build-stage
WORKDIR /frontend
COPY package*.json ./
RUN npm install
RUN apk add gettext
# Change this to your server endpoint
ENV SERVER_ENDPOINT=https://localhost:8081
# ENV VARS REQUIRED
ENV SUPABASE_ID=
ENV SUPABASE_TOKEN=
ENV GG_CLIENT_ID=
COPY ./ /frontend
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build-stage /frontend/dist /var/www/html/dist
