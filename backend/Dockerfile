# syntax=docker/dockerfile:1
FROM node
COPY ["package.json", "package-lock.json", "./"]
RUN ["npm", "ci"]
COPY . /leadminer
EXPOSE 8081
CMD ["node","--expose_gc","/leadminer/server.js"]
