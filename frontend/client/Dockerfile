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
  ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release jq python3 python3-pip \
  xdg-utils && pip3 install --upgrade pip setuptools wheel && pip install 'typescript-protobuf>=0.5'

# Install needed node modules (most of them should already be in base
# image).
COPY frontend/client/package.json .
RUN node node_modules/.bin/yarn-lazy-lock && yarn install
RUN npm list --depth=0; exit 0

COPY frontend/api/*.proto bob_emploi/frontend/api/
COPY frontend/client/cfg cfg/
COPY frontend/client/src src/
COPY frontend/client/plugins plugins/
COPY frontend/client/test test/
COPY frontend/release/*.js frontend/release/*.ts frontend/release/cloudfront.json release/
COPY frontend/client/.babelrc frontend/client/server.js frontend/client/i18n.babelrc.js frontend/client/extract_i18n.sh frontend/client/download.js frontend/client/airtable_fields.json5 frontend/client/entrypoint.sh frontend/client/favicon.ico frontend/client/lint_and_test.sh frontend/client/diff_i18n_folder.sh .eslintrc.json .eslintignore frontend/client/karma.conf.js frontend/client/check-color-config.sh frontend/client/check-common-typos.sh frontend/client/jsonlint.sh frontend/client/tsconfig.json frontend/client/custom.d.ts ./
# This is actually part of the frontend-db, but it makes it way easier to lint
# with the same rules.
COPY frontend/server/db server/db/

# TODO(pascal): Create a @types/autocomplete.js npm package.
COPY frontend/client/vendor/autocomplete.js.d.ts node_modules/@types/autocomplete.js/index.d.ts
# TODO(pascal): Create a @types/react-twitter-embed npm package.
COPY frontend/client/vendor/react-twitter-embed.d.ts node_modules/@types/react-twitter-embed/index.d.ts
# TODO(cyrille): Create a @types/es6-set-proptypes npm package.
COPY frontend/client/vendor/es6-set-proptypes.d.ts node_modules/@types/es6-set-proptypes/index.d.ts

COPY frontend/client/vendor/patch-babel-plugin-i18next-extract.sh ./vendor/patch-babel-plugin-i18next-extract.sh
RUN ./vendor/patch-babel-plugin-i18next-extract.sh

ARG SKIP_TEST=
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || ./entrypoint.sh ./lint_and_test.sh
