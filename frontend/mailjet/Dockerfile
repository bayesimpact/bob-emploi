FROM node

WORKDIR /usr/app/
COPY frontend/mailjet/package.json /usr/app/
RUN yarn install

COPY frontend/mailjet/index.ts frontend/mailjet/entrypoint.sh frontend/mailjet/tsconfig.json frontend/mailjet/json2mjml.d.ts /usr/app/
COPY frontend/server/mail/templates /usr/app/templates

ARG SKIP_TEST=
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || npm run mailjet checkHtml '*'
