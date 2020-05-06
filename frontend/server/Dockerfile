FROM python:3.8 as base

WORKDIR /work

ARG PROTOBUF_VERSION=3.7.0

# Install dependencies
RUN apt-get update -qqy && apt-get install -qqy --no-install-recommends unzip locales && \
  # Install needed Python dependencies.
  pip install 'algoliasearch>=2.0' 'python-emploi-store>=0.7.0' certifi dnspython elasticsearch flask mailjet_rest mongo oauth2client protobuf pyfarmhash pyopenssl requests-aws4auth sentry-sdk[flask] unidecode uwsgi xmltodict && \
  # Install Protobuf compiler.
  curl --silent -L "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip" -o protoc.zip && \
  unzip -qq protoc.zip && rm protoc.zip && rm readme.txt && mv bin/protoc /usr/local/bin && mkdir /usr/local/share/proto && mv include/google /usr/local/share/proto && \
  # Prepare the frontend module.
  mkdir -p bob_emploi/frontend && \
    touch bob_emploi/__init__.py && \
    touch bob_emploi/frontend/__init__.py && \
    echo "fr_FR.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen

ENTRYPOINT ["./entrypoint.sh"]

FROM base as server

COPY frontend/server/entrypoint.sh .
COPY frontend/server/*.py bob_emploi/frontend/server/
COPY frontend/server/scoring.md bob_emploi/frontend/server/
COPY frontend/server/apps/ bob_emploi/frontend/server/apps/
COPY frontend/server/modules/*.py bob_emploi/frontend/server/modules/
COPY frontend/server/asynchronous/*.py bob_emploi/frontend/server/asynchronous/
COPY frontend/server/asynchronous/mail/*.py bob_emploi/frontend/server/asynchronous/mail/
COPY frontend/server/asynchronous/mail/templates/ bob_emploi/frontend/server/asynchronous/mail/templates/
COPY frontend/api/*.proto bob_emploi/frontend/api/

# Setup environment.
EXPOSE 80
CMD ["uwsgi", "--protocol=http", "--socket", "0.0.0.0:80", "--enable-threads", "-w", "bob_emploi.frontend.server.server:app"]
ARG GIT_SHA1=non-git

# Label the image with the git commit.
LABEL org.bayesimpact.git=$GIT_SHA1
# Set a default server version based on Git commit. This is overriden in
# production with more context, e.g. the name of the demo server.
ENV SERVER_VERSION=git-$GIT_SHA1 \
  BIND_HOST=0.0.0.0 \
  PYTHONPATH=/work


FROM base as test

COPY frontend/server/requirements-testing.txt /work
RUN pip install -r requirements-testing.txt

COPY --from=server /work/bob_emploi/ bob_emploi/
COPY --from=server /work/entrypoint.sh .
COPY frontend/server/lint_and_test.sh .pylintrc .pycodestyle frontend/server/.coveragerc /work/
COPY frontend/server/test /work/bob_emploi/frontend/server/test/
COPY frontend/server/modules/test /work/bob_emploi/frontend/server/modules/test/
COPY frontend/server/asynchronous/test /work/bob_emploi/frontend/server/asynchronous/test/
COPY frontend/server/asynchronous/mail/test /work/bob_emploi/frontend/server/asynchronous/mail/test/
# TODO(pascal): Clean up our typing stubs for requests_mock package once it gets typed.
RUN [ ! -f /usr/local/lib/python3.8/site-packages/requests_mock/__init__.pyi ]
RUN ! ls /usr/local/lib/python3.8/site-packages/mypy/typeshed/third_party/*/requests_mock/__init__.pyi 2> /dev/null
COPY frontend/server/test/vendor/requests_mock/* /usr/local/lib/python3.8/site-packages/mypy/typeshed/third_party/2and3/requests_mock/
# TODO(pascal): Remove once https://github.com/python/typeshed/pull/2904 is live in mypy.
COPY frontend/server/test/vendor/flask/* /usr/local/lib/python3.8/site-packages/mypy/typeshed/third_party/2and3/flask/
COPY frontend/server/test/vendor/werkzeug/* /usr/local/lib/python3.8/site-packages/mypy/typeshed/third_party/2and3/werkzeug/

# TODO(cyrille): Move to another target.
RUN pybabel extract bob_emploi/frontend/server/ -k translate_string -k make_translatable_string -o strings.pot

ENV TEST_ENV=1
ARG SKIP_TEST=
RUN protoc -I . -I /usr/local/share/proto/ bob_emploi/frontend/server/test/testdata/*.proto --python_out=. --mypy_out=quiet:.
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || ./entrypoint.sh ./lint_and_test.sh --with-coverage --cover-inclusive --cover-package=. --cover-html --cover-min-percentage=90 --cover-xml
CMD ["nosetests", "--with-watch"]
