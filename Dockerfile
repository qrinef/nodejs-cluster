FROM node:14-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY ./app.js ./app.js

CMD npm start
