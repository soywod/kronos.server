FROM node:8.11.4-alpine
WORKDIR /home/node

COPY app/package.json .
COPY app/package-lock.json .
RUN npm install

COPY app/tsconfig.json .
COPY app/tslint.json .
COPY app/start.sh .
CMD sh start.sh
