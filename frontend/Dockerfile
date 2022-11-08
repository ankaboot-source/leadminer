FROM node:lts-alpine as build-stage
WORKDIR /frontend
COPY . .
ARG SERVER_ENDPOINT
ARG SUPABASE_ID
ARG SUPABASE_TOKEN
ARG GG_CLIENT_ID
ENV SERVER_ENDPOINT ${SERVER_ENDPOINT}
ENV SUPABASE_ID ${SUPABASE_ID}
ENV SUPABASE_TOKEN ${SUPABASE_TOKEN}
ENV GG_CLIENT_ID ${GG_CLIENT_ID}
RUN npm install && npm run build

FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /frontend/dist/spa /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]