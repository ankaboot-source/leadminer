FROM node as build-stage
WORKDIR /frontend
COPY ./ /frontend
RUN npm install
RUN npm run build

FROM nginx
COPY --from=build-stage /frontend/dist /var/www/html/dist
