ARG REACT_BASE_TAG
FROM bayesimpact/react-base:${REACT_BASE_TAG:-latest} as dev

ARG PROTOBUF_VERSION=3.7.0

# Install Protobuf compiler.
COPY frontend/client/vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends unzip && \
  PROTOBUF_VERSION=$PROTOBUF_VERSION vendor/install-protoc.sh /usr/local

RUN ln -s node_modules/google-protobuf/google

RUN apt-get install -qqy --no-install-recommends jq python3-pip && \
  pip3 install --upgrade pip setuptools wheel && pip install 'typescript-protobuf>=0.5'

# Install needed node modules (most of them should already be in base
# image).
COPY frontend/client/package.json .
RUN node node_modules/.bin/yarn-lazy-lock && yarn install

RUN rm -r *.js cfg

COPY frontend/api/*.proto bob_emploi/frontend/api/
COPY frontend/client/cfg cfg/
COPY frontend/client/src src/
COPY frontend/client/node node/
COPY frontend/client/plugins plugins/
COPY frontend/release/.eslintrc.json frontend/release/populate_nginx_conf.ts release/
COPY frontend/release/lambdas release/lambdas/
COPY frontend/release/cloudfront/fr.json release/cloudfront/
COPY frontend/client/build_dist.ts frontend/client/server.ts frontend/client/.babelrc frontend/client/i18n.babelrc.js frontend/client/extract_i18n.sh frontend/client/airtable_fields.json5 frontend/client/entrypoint.sh frontend/client/tsconfig.json frontend/client/custom.d.ts ./

# TODO(pascal): Create a @types/autocomplete.js npm package.
COPY frontend/client/vendor/autocomplete.js.d.ts node_modules/@types/autocomplete.js/index.d.ts
# TODO(pascal): Drop this once https://github.com/arthurbergmz/webpack-pwa-manifest/pull/150 gets released.
COPY frontend/client/vendor/webpack-pwa-manifest.d.ts node_modules/webpack-pwa-manifest/index.d.ts

COPY frontend/client/vendor/patch-babel-plugin-i18next-extract.sh ./vendor/patch-babel-plugin-i18next-extract.sh
RUN ./vendor/patch-babel-plugin-i18next-extract.sh

COPY frontend/client/src/translations i18n/translations/
RUN npm run i18n:extract
ARG AIRTABLE_API_KEY
ARG FAIL_ON_MISSING_TRANSLATIONS
RUN test -z "$AIRTABLE_API_KEY" && echo "Skipping download of translations" || AIRTABLE_API_KEY=$AIRTABLE_API_KEY FAIL_ON_MISSING_TRANSLATIONS=$FAIL_ON_MISSING_TRANSLATIONS npm run i18n:download

# TODO(pascal): Remove this once @types/webpack-dev-server stops installing it. The types are now embedded in webpack package.
RUN rm -r node_modules/@types/webpack

FROM dev as test

COPY frontend/client/test test/
COPY .eslintrc.json .eslintignore frontend/client/karma_start.ts frontend/client/karma.conf.ts frontend/client/check-color-config.sh frontend/client/check-common-typos.sh frontend/client/jsonlint.sh frontend/client/check_types.sh ./
# This is actually part of the frontend-db, but it makes it way easier to lint
# with the same rules.
COPY frontend/server/db server/db/

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "test:watch"]
ARG SKIP_TEST=
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || ./entrypoint.sh npm run check:all


FROM dev as build-dist

ARG CLIENT_VERSION
ARG BOB_DEPLOYMENT
ARG BOB_DEPLOYMENTS
ARG BOB_PLUGINS
RUN NODE_OPTIONS=--max_old_space_size=4096 npm run dist

ADD frontend/release/nginx_template.conf release/
RUN node -r esm -r ts-node/register release/populate_nginx_conf.ts release/nginx.conf


FROM nginx:stable as nginx

RUN mkdir -p /usr/share/bob-emploi/html
COPY --from=build-dist /usr/app/dist /usr/share/bob-emploi/html
COPY --from=build-dist /usr/app/release/nginx.conf /etc/nginx/conf.d/default.conf

ADD frontend/release/entrypoint.sh /usr/share/bob-emploi/

CMD ["/usr/share/bob-emploi/entrypoint.sh"]

# Label the image with the git commit.
ARG GIT_SHA1=non-git
LABEL org.bayesimpact.git=$GIT_SHA1
