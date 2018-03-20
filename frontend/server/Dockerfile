FROM python:3

WORKDIR /work

# Install dependencies
RUN apt-get update -qqy && apt-get install -qqy --no-install-recommends wget unzip && \
  # Install needed Python dependencies.
  # TODO(cyrille): Fix protobuf version to latest common between pip and github.
  pip install algoliasearch python-emploi-store certifi 'elasticsearch<6.0.0' flask mailjet_rest mongo oauth2client protobuf==3.5.1 pyfarmhash raven[flask] unidecode uwsgi xmltodict && \
  # Install Protobuf compiler.
  PROTOBUF_VERSION=$(pip show protobuf | grep ^Version | grep -o '[0-9][0-9.]\+[0-9]') \
  bash -c 'wget --quiet https://github.com/google/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip -O protoc.zip' && \
  unzip -qq protoc.zip && rm protoc.zip && rm readme.txt && mv bin/protoc /usr/local/bin && mkdir /usr/local/share/proto && mv include/google /usr/local/share/proto && \
  # Prepare the frontend module.
  mkdir -p bob_emploi/frontend && \
    touch bob_emploi/__init__.py && \
    touch bob_emploi/frontend/__init__.py

COPY server/entrypoint.sh .
COPY server/*.py bob_emploi/frontend/server/
COPY server/modules/*.py bob_emploi/frontend/server/modules/
COPY server/asynchronous/*.py bob_emploi/frontend/server/asynchronous/
COPY server/asynchronous/mail/*.py bob_emploi/frontend/server/asynchronous/mail/
COPY api bob_emploi/frontend/api

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
