FROM node:alpine as build-stage
WORKDIR /frontend
COPY ./ /frontend
RUN npm install
RUN apk add gettext
# Change this to your server endpoint
ENV SERVER_ENDPOINT=https://localhost:8081
# ENV VARS REQUIRED
ENV SUPABASE_ID=
ENV SUPABASE_TOKEN=
ENV GG_CLIENT_ID=
RUN npm run build

FROM nginx
COPY --from=build-stage /frontend/dist /var/www/html/dist
