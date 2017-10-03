FROM bayesimpact/react-base:latest

# Install needed node modules (hopefully most of them are already in base
# image).
COPY package.json .
RUN npm install

ENV PROTOBUF_VERSION=3.4.0

# Install Protobuf compiler.
COPY vendor/install-protoc.sh ./vendor/install-protoc.sh
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends wget unzip && \
  vendor/install-protoc.sh ${PROTOBUF_VERSION} /usr/local

RUN mkdir -p bob_emploi/frontend/api && \
  ln -s node_modules/google-protobuf/google

RUN apt-get install -qqy --no-install-recommends gconf-service libasound2 \
  libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
  libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
  libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
  libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
  ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils
