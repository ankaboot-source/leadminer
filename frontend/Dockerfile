FROM node as build-stage
WORKDIR /frontend
COPY ./ /frontend
RUN npm install
# Change this to your server endpoint
ENV SERVER_ENDPOINT=https://api.leadminer.io
RUN npm run build

FROM nginx
COPY --from=build-stage /frontend/dist /var/www/html/dist
