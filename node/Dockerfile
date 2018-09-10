FROM node:8.11.4-alpine
WORKDIR /home/node

COPY app/package.json .
COPY app/package-lock.json .
RUN npm install --only=prod

COPY app/index.js .
CMD node index.js
