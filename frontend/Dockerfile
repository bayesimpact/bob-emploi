FROM bayesimpact/react-base:latest

# Install needed node modules (hopefully most of them are already in base
# image).
COPY package.json .
RUN npm install

EXPOSE 80

ENV PROTOBUF_VERSION=3.0.0-beta-3 \
  BIND_HOST=0.0.0.0

# Install Protobuf compiler.
COPY vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends wget unzip && \
  vendor/install-protoc.sh ${PROTOBUF_VERSION} /usr/local

RUN mkdir -p bob_emploi/frontend/api && \
  ln -s node_modules/google-protobuf/google && \
  # TODO(pascal): Drop the inline-style-prefixer dependency in package.json and
  # remove the line below when
  # https://github.com/FormidableLabs/radium/issues/818 is fixed.
  rm -rf node_modules/radium/node_modules
ENTRYPOINT ["./entrypoint.sh"]

CMD ["npm", "start"]

# Copy only the entrypoint: the rest should be mounted.
COPY entrypoint.sh .
