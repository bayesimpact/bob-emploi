FROM bayesimpact/react-base:latest

ENV PROTOBUF_VERSION=3.4.0

# Install Protobuf compiler.
COPY frontend/vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends wget unzip && \
  vendor/install-protoc.sh ${PROTOBUF_VERSION} /usr/local

RUN ln -s node_modules/google-protobuf/google

RUN apt-get install -qqy --no-install-recommends gconf-service libasound2 \
  libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
  libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
  libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
  ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils

# TODO(pascal): Cleanup once mozjpeg is fixed.
RUN wget http://ftp.fr.debian.org/debian/pool/main/libp/libpng1.6/libpng16-16_1.6.28-1_amd64.deb \
  -O /tmp/libpng16-16_1.6.28-1_amd64.deb && \
  dpkg -i /tmp/libpng16-16_1.6.28-1_amd64.deb && \
  rm /tmp/libpng16-16_1.6.28-1_amd64.deb

# Install needed node modules (most of them should already be in base
# image).
COPY frontend/package.json .
RUN node node_modules/.bin/yarn-lazy-lock && yarn install

COPY frontend/api bob_emploi/frontend/api/
COPY frontend/cfg cfg/
COPY frontend/src src/
COPY frontend/test test/
COPY frontend/.babelrc frontend/download.js frontend/entrypoint.sh frontend/favicon.ico frontend/lint_and_test.sh .eslintrc.json .eslintignore frontend/karma.conf.js frontend/check-color-themes.sh frontend/check-common-typos.sh ./
# This is actually part of the frontend-db, but it makes it way easier to lint
# with the same rules.
COPY frontend/server/db server/db/

ARG SKIP_TEST=
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || ./entrypoint.sh ./lint_and_test.sh
