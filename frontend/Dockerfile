FROM node:lts-alpine as build-stage
WORKDIR /frontend
COPY . .
ARG SERVER_ENDPOINT
ARG SUPABASE_PROJECT_URL
ARG SUPABASE_SECRET_PROJECT_TOKEN
ARG GG_CLIENT_ID
ENV SERVER_ENDPOINT ${SERVER_ENDPOINT}
ENV SUPABASE_PROJECT_URL ${SUPABASE_PROJECT_URL}
ENV SUPABASE_SECRET_PROJECT_TOKEN ${SUPABASE_SECRET_PROJECT_TOKEN}
ENV GG_CLIENT_ID ${GG_CLIENT_ID}
RUN npm install && npm run build

FROM nginx:stable-alpine as production-stage
COPY --from=build-stage /frontend/dist/spa /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]