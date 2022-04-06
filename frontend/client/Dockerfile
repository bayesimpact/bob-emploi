ARG REACT_BASE_TAG
FROM bayesimpact/react-base:${REACT_BASE_TAG:-latest} as dev

ARG PROTOBUF_VERSION=3.19.4

# Install Protobuf compiler.
COPY common/vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends unzip && \
  PROTOBUF_VERSION=$PROTOBUF_VERSION vendor/install-protoc.sh /usr/local

RUN ln -s node_modules/google-protobuf/google

RUN apt-get install -qqy --no-install-recommends jq python3-pip && \
  pip3 install --upgrade pip setuptools wheel && pip install 'typescript-protobuf>=0.6'

RUN rm -r *.js cfg

# Install needed node modules (most of them should already be in base
# image).
COPY frontend/client/package.json .
RUN node node_modules/.bin/yarn-lazy-lock && yarn install

COPY frontend/api/*.proto bob_emploi/frontend/api/
COPY frontend/client/cfg cfg/
COPY frontend/client/src src/
COPY frontend/client/node node/
COPY frontend/client/plugins plugins/
COPY frontend/release/.eslintrc.json frontend/release/populate_nginx_conf.ts release/
COPY frontend/release/lambdas release/lambdas/
COPY frontend/release/cloudformation/main_template.json release/cloudformation/
COPY \
  frontend/client/.babelrc \
  frontend/client/airtable_fields.json5 \
  frontend/client/build_dist.ts \
  frontend/client/config.ts \
  frontend/client/custom.d.ts \
  frontend/client/entrypoint.sh \
  frontend/client/extract_i18n.ts \
  frontend/client/i18n.babelrc.js \
  frontend/client/server.ts \
  frontend/client/tsconfig.json \
  frontend/client/webpack.eslintrc.json \
  ./

# TODO(pascal): Drop this once https://github.com/arthurbergmz/webpack-pwa-manifest/pull/150 gets released.
COPY frontend/client/vendor/webpack-pwa-manifest.d.ts node_modules/webpack-pwa-manifest/index.d.ts

COPY frontend/client/vendor/patch-babel-plugin-i18next-extract.sh ./vendor/patch-babel-plugin-i18next-extract.sh
RUN ./vendor/patch-babel-plugin-i18next-extract.sh

COPY frontend/client/src/translations i18n/translations/
RUN npm run i18n:extract
ARG AIRTABLE_API_KEY
ARG FAIL_ON_MISSING_TRANSLATIONS
RUN test -z "$AIRTABLE_API_KEY" && echo "Skipping download of translations" || AIRTABLE_API_KEY=$AIRTABLE_API_KEY FAIL_ON_MISSING_TRANSLATIONS=$FAIL_ON_MISSING_TRANSLATIONS npm run i18n:download


FROM dev as test

COPY frontend/client/test test/
COPY .eslintrc.json .eslintignore frontend/client/karma_start.ts frontend/client/karma.conf.ts frontend/client/check_color_config.ts frontend/client/jsonlint.sh frontend/client/check_types.ts ./
# This is actually part of the frontend-db, but it makes it way easier to lint
# with the same rules.
COPY frontend/server/db server/db/

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "test:watch"]
ARG SKIP_TEST=
ARG FAIL_ON_MISSING_TRANSLATIONS
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || FAIL_ON_MISSING_TRANSLATIONS=$FAIL_ON_MISSING_TRANSLATIONS ./entrypoint.sh npm run check:all


FROM dev as build-dist

ARG CLIENT_VERSION
ARG BOB_DEPLOYMENT
ARG BOB_DEPLOYMENTS
ARG BOB_PLUGINS
RUN NODE_OPTIONS=--max_old_space_size=4096 npm run dist

ADD frontend/release/nginx_template.conf release/
RUN mkdir -p release/deployments && node -r esm -r ts-node/register release/populate_nginx_conf.ts release/deployments


FROM nginx:stable as nginx

RUN mkdir -p /usr/share/bob-emploi/html
COPY --from=build-dist /usr/app/dist /usr/share/bob-emploi/html
COPY --from=build-dist /usr/app/release/deployments /etc/nginx/conf.d/deployments

ADD frontend/release/entrypoint.sh /usr/share/bob-emploi/

CMD ["/usr/share/bob-emploi/entrypoint.sh"]

# Label the image with the git commit.
ARG GIT_SHA1=non-git
LABEL org.bayesimpact.git=$GIT_SHA1
