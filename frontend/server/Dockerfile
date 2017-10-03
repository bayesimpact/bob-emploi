FROM python:3

# Install dependencies
# TODO(florian): keep in one RUN to reduce # of Docker layers once we get the caching to always work
# correctly on CircleCI remote Docker environment.
RUN apt-get update -qqy && apt-get install -qqy --no-install-recommends wget unzip

WORKDIR /work
# Install needed Python dependencies.
RUN pip install python-emploi-store flask mailjet_rest mongo oauth2client pyfarmhash raven[flask] unidecode uwsgi xmltodict

# Install Protobuf compiler.
RUN wget --quiet https://github.com/google/protobuf/releases/download/v3.2.0/protoc-3.2.0-linux-x86_64.zip -O protoc.zip && unzip -qq protoc.zip && rm protoc.zip && rm readme.txt && mv bin/protoc /usr/local/bin && mkdir /usr/local/share/proto && mv include/google /usr/local/share/proto

# Install Python Protobuf runtime.
RUN wget --quiet https://github.com/google/protobuf/releases/download/v3.2.0/protobuf-python-3.2.0.zip -O protobuf-python.zip && unzip -qq protobuf-python.zip && rm protobuf-python.zip && cd protobuf-3.2.0/python && ./setup.py install && cd ../.. && rm -rf protobuf-3.2.0

# Prepare the frontend module.
RUN mkdir -p bob_emploi/frontend && \
  touch bob_emploi/__init__.py && \
  touch bob_emploi/frontend/__init__.py

COPY entrypoint.sh .
COPY *.py bob_emploi/frontend/
COPY modules/*.py bob_emploi/frontend/modules/
COPY asynchronous/*.py bob_emploi/frontend/asynchronous/
COPY api bob_emploi/frontend/api

# Setup environment.
EXPOSE 80
ENTRYPOINT ["./entrypoint.sh"]
CMD ["uwsgi", "--protocol=http", "--socket", "0.0.0.0:80", "--enable-threads", "-w", "bob_emploi.frontend.server:app"]
ARG GIT_SHA1=non-git

# Label the image with the git commit.
LABEL org.bayesimpact.git=$GIT_SHA1
# Set a default server version based on Git commit. This is overriden in
# production with more context, e.g. the name of the demo server.
ENV SERVER_VERSION=git-$GIT_SHA1 \
  BIND_HOST=0.0.0.0 \
  PYTHONPATH=/work
