FROM python:3

# Setup environment.
EXPOSE 80
WORKDIR /work
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uwsgi", "--protocol=http", "--socket", "0.0.0.0:80", "-w", "bob_emploi.frontend.server:app"]
ARG GIT_SHA1=non-git
ENV PROTOBUF_VERSION=3.2.0 \
  BIND_HOST=0.0.0.0 \
  PYTHONPATH=/work

# Install dependencies (keep in one RUN to reduce # of Docker layers).
RUN apt-get update -qqy && \
  apt-get install -qqy --no-install-recommends wget unzip && \
  # Install needed Python dependencies.
  pip install python-emploi-store flask mailjet_rest mongo oauth2client pyfarmhash unidecode uwsgi && \
  # Install Protobuf compiler.
  wget --quiet https://github.com/google/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip -O protoc.zip && unzip -qq protoc.zip && rm protoc.zip && rm readme.txt && mv bin/protoc /usr/local/bin && mkdir /usr/local/share/proto && mv include/google /usr/local/share/proto && \
  # Install Python Protobuf runtime.
  wget --quiet https://github.com/google/protobuf/releases/download/v${PROTOBUF_VERSION}/protobuf-python-${PROTOBUF_VERSION}.zip -O protobuf-python.zip && unzip -qq protobuf-python.zip && rm protobuf-python.zip && cd protobuf-${PROTOBUF_VERSION}/python && ./setup.py install && cd ../.. && rm -rf protobuf-${PROTOBUF_VERSION} && \
  # Prepare the frontend module.
  mkdir -p bob_emploi/frontend && \
  touch bob_emploi/__init__.py && \
  touch bob_emploi/frontend/__init__.py

COPY entrypoint.sh .
COPY server.py action.py advisor.py auth.py companies.py french.py mail.py now.py privacy.py proto.py scoring.py bob_emploi/frontend/
COPY asynchronous/__init__.py asynchronous/create_pool.py asynchronous/mail_nps.py bob_emploi/frontend/asynchronous/
COPY api bob_emploi/frontend/api

# Label the image with the git commit.
LABEL org.bayesimpact.git=$GIT_SHA1
# Set a default server version based on Git commit. This is overriden in
# production with more context, e.g. the name of the demo server.
ENV SERVER_VERSION=git-$GIT_SHA1
