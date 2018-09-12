FROM node:8.11.4-alpine
WORKDIR /home/node

COPY app/package.json .
COPY app/package-lock.json .
RUN npm install --only=prod

CMD node src/index.js
