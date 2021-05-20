FROM node

WORKDIR /usr/app/
COPY frontend/mailjet/package.json /usr/app/
RUN yarn install

COPY frontend/mailjet/index.ts frontend/mailjet/tsconfig.json /usr/app/
