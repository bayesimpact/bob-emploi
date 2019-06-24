FROM bayesimpact/react-base:latest

ARG PROTOBUF_VERSION=3.7.0

# Install Protobuf compiler.
COPY frontend/client/vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends unzip && \
  PROTOBUF_VERSION=$PROTOBUF_VERSION vendor/install-protoc.sh /usr/local

RUN ln -s node_modules/google-protobuf/google

RUN apt-get install -qqy --no-install-recommends gconf-service libasound2 \
  libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
  libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
  libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
  ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release python3 python3-pip xdg-utils && \
  pip3 install --upgrade pip setuptools wheel && pip install typescript-protobuf

# TODO(pascal): Cleanup once mozjpeg is fixed.
RUN curl -L http://ftp.fr.debian.org/debian/pool/main/libp/libpng1.6/libpng16-16_1.6.28-1_amd64.deb \
  -o /tmp/libpng16-16_1.6.28-1_amd64.deb && \
  dpkg -i /tmp/libpng16-16_1.6.28-1_amd64.deb && \
  rm /tmp/libpng16-16_1.6.28-1_amd64.deb

# Install needed node modules (most of them should already be in base
# image).
COPY frontend/client/package.json .
RUN node node_modules/.bin/yarn-lazy-lock && yarn install

COPY frontend/api/*.proto bob_emploi/frontend/api/
COPY frontend/client/cfg cfg/
COPY frontend/client/src src/
COPY frontend/client/test test/
COPY frontend/release/*.js release/
COPY frontend/client/.babelrc frontend/client/download.js frontend/client/entrypoint.sh frontend/client/favicon.ico frontend/client/lint_and_test.sh .eslintrc.json .eslintignore frontend/client/karma.conf.js frontend/client/check-color-config.sh frontend/client/check-common-typos.sh frontend/client/tsconfig.json frontend/client/custom.d.ts ./
# This is actually part of the frontend-db, but it makes it way easier to lint
# with the same rules.
COPY frontend/server/db server/db/

# TODO(cyrille): Remove this once https://github.com/levrik/mdi-react/issues/48 is resolved.
COPY frontend/client/vendor/mdi_react_typings.d.ts node_modules/mdi-react/dist/typings.d.ts

ARG SKIP_TEST=
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || ./entrypoint.sh ./lint_and_test.sh
