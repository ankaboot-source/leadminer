FROM node
WORKDIR /leadminer-api
COPY ./ /leadminer-api
RUN npm install
EXPOSE 8081
CMD ["node", "--expose_gc", "server.js"]
