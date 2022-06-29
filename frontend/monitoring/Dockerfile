ARG REACT_BASE_TAG
FROM bayesimpact/react-base:${REACT_BASE_TAG:-latest}

ARG PROTOBUF_VERSION=3.19.4

# Install Protobuf compiler.
COPY common/vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends unzip && \
  PROTOBUF_VERSION=$PROTOBUF_VERSION vendor/install-protoc.sh /usr/local

RUN ln -s node_modules/google-protobuf/google

RUN apt-get install -qqy --no-install-recommends jq python3-pip && \
  pip3 install --upgrade pip setuptools wheel && pip install 'typescript-protobuf>=0.5'

RUN rm -r *.js cfg

COPY frontend/monitoring/package.json .
RUN node node_modules/.bin/yarn-lazy-lock && yarn install

COPY frontend/monitoring/ .
COPY .eslintrc.json .eslintignore ./

COPY frontend/api/monitoring.proto bob_emploi/frontend/api/
RUN protoc -I . -I /usr/local/share/proto bob_emploi/frontend/api/*.proto --json-ts_out=quiet:/tmp --js_out=import_style=commonjs,binary:.
