# TODO(cyrille): Uncap once https://github.com/PyCQA/astroid/issues/539 is resolved in stable version.
FROM python:3.6

WORKDIR /work

# Install dependencies
RUN apt-get update -qqy && apt-get install -qqy --no-install-recommends wget unzip locales && \
  # Install needed Python dependencies.
  pip install algoliasearch 'python-emploi-store>=0.7.0' certifi 'elasticsearch<6.0.0' flask mailjet_rest mongo mypy_extensions oauth2client protobuf pyfarmhash requests-aws4auth sentry-sdk[flask] typing_extensions unidecode uwsgi xmltodict && \
  # Install Protobuf compiler.
  PROTOBUF_VERSION=$(curl -i https://github.com/protocolbuffers/protobuf/releases/latest | grep ^Location: | sed -e "s/^.*\/v//;s/\s*$//") \
  bash -c 'wget --quiet https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip -O protoc.zip' && \
  unzip -qq protoc.zip && rm protoc.zip && rm readme.txt && mv bin/protoc /usr/local/bin && mkdir /usr/local/share/proto && mv include/google /usr/local/share/proto && \
  # Prepare the frontend module.
  mkdir -p bob_emploi/frontend && \
    touch bob_emploi/__init__.py && \
    touch bob_emploi/frontend/__init__.py && \
    echo "fr_FR.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen

COPY server/entrypoint.sh .
COPY server/*.py bob_emploi/frontend/server/
COPY server/modules/*.py bob_emploi/frontend/server/modules/
COPY server/asynchronous/*.py bob_emploi/frontend/server/asynchronous/
COPY server/asynchronous/mail/*.py bob_emploi/frontend/server/asynchronous/mail/
COPY api/*.proto bob_emploi/frontend/api/

# Setup environment.
EXPOSE 80
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uwsgi", "--protocol=http", "--socket", "0.0.0.0:80", "--enable-threads", "-w", "bob_emploi.frontend.server.server:app"]
ARG GIT_SHA1=non-git

# Label the image with the git commit.
LABEL org.bayesimpact.git=$GIT_SHA1
# Set a default server version based on Git commit. This is overriden in
# production with more context, e.g. the name of the demo server.
ENV SERVER_VERSION=git-$GIT_SHA1 \
  BIND_HOST=0.0.0.0 \
  PYTHONPATH=/work
