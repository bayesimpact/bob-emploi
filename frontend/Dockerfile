FROM bayesimpact/react-base:latest

# Install needed node modules (hopefully most of them are already in base
# image).
COPY package.json .
RUN npm install

ENV PROTOBUF_VERSION=3.0.0-beta-3

# Install Protobuf compiler.
COPY vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends wget unzip && \
  vendor/install-protoc.sh ${PROTOBUF_VERSION} /usr/local

RUN mkdir -p bob_emploi/frontend/api && \
  ln -s node_modules/google-protobuf/google
