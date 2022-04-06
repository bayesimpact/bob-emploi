FROM python:3.9 as base

WORKDIR /work

ARG PROTOBUF_VERSION=3.19.4

COPY frontend/server/requirements.txt common/vendor/install-protoc.sh ./
# Install dependencies
RUN apt-get update -qqy && apt-get install -qqy --no-install-recommends unzip locales && \
  # Install needed Python dependencies.
  pip install -r requirements.txt  && \
  # Install Protobuf compiler.
  PROTOBUF_VERSION=$PROTOBUF_VERSION ./install-protoc.sh /usr/local && \
  # Prepare the frontend module.
  mkdir -p bob_emploi/frontend && \
    touch bob_emploi/__init__.py && \
    touch bob_emploi/frontend/__init__.py && \
    mkdir -p bob_emploi/common && \
    touch bob_emploi/common/__init__.py && \
    echo "fr_FR.UTF-8 UTF-8" >> /etc/locale.gen && \
    echo "en_GB.UTF-8 UTF-8" >> /etc/locale.gen && \
    echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen

ENV PYTHONPATH=/work

FROM base as source

COPY frontend/server/entrypoint.sh .
COPY frontend/server/*.py bob_emploi/frontend/server/
COPY frontend/server/scoring.md bob_emploi/frontend/server/
# TODO(cyrille): Find a way to exclude tests.
COPY frontend/server/apps/ bob_emploi/frontend/server/apps/
COPY frontend/server/modules/*.py bob_emploi/frontend/server/modules/
COPY frontend/server/asynchronous/*.py bob_emploi/frontend/server/asynchronous/
COPY frontend/server/mail/*.py bob_emploi/frontend/server/mail/
COPY frontend/server/mail/templates/ bob_emploi/frontend/server/mail/templates/
COPY frontend/api/*.proto bob_emploi/frontend/api/
COPY common/python/ bob_emploi/common/python/

# Generate _pb2.py and other files.
RUN ./entrypoint.sh

FROM base as test

COPY frontend/server/test/requirements.txt /work/requirements-testing.txt
RUN pip install -r requirements-testing.txt

COPY --from=source /work/bob_emploi/ bob_emploi/
COPY --from=source /work/entrypoint.sh .
COPY frontend/server/lint_and_test.sh .pylintrc frontend/server/.coveragerc /work/
COPY .pycodestyle /work/setup.cfg
COPY frontend/server/test /work/bob_emploi/frontend/server/test/
COPY frontend/server/apps/test bob_emploi/frontend/server/apps/test/
COPY frontend/server/modules/test /work/bob_emploi/frontend/server/modules/test/
COPY frontend/server/asynchronous/i18n /work/bob_emploi/frontend/server/asynchronous/i18n/
COPY frontend/server/asynchronous/test /work/bob_emploi/frontend/server/asynchronous/test/
COPY frontend/server/mail/test /work/bob_emploi/frontend/server/mail/test/

# TODO(cyrille): Move to another target.
ARG SKIP_STRINGS_EXTRACT=
RUN test -n "$SKIP_STRINGS_EXTRACT" && echo "Skipping string extraction" || \
  pybabel extract bob_emploi/frontend/server/ -k flask_translate -k translate_static_string -k make_translatable_string -k make_translatable_string_with_context:1,2c -o strings.pot && \
  python bob_emploi/frontend/server/asynchronous/i18n/extract_mailjet_strings.py bob_emploi/frontend/server/mail/templates/mailjet.json > mailjet_strings.pot

# Download translations.
ARG AIRTABLE_API_KEY
ARG FAIL_ON_MISSING_TRANSLATIONS
RUN test -z "$AIRTABLE_API_KEY" -o -n "$SKIP_STRINGS_EXTRACT" && echo "Skipping download of translations" && echo "{}" > bob_emploi/frontend/server/translations.json || \
  AIRTABLE_API_KEY=$AIRTABLE_API_KEY FAIL_ON_MISSING_TRANSLATIONS=$FAIL_ON_MISSING_TRANSLATIONS \
  ./entrypoint.sh python bob_emploi/frontend/server/asynchronous/i18n/download_translations.py --strings strings.pot --output bob_emploi/frontend/server/translations.json

ENV TEST_ENV=1
ARG SKIP_TEST=
RUN protoc -I . -I /usr/local/share/proto/ bob_emploi/frontend/server/test/testdata/*.proto --python_out=. --mypy_out=quiet:.
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || COVERAGE=1 ./entrypoint.sh ./lint_and_test.sh


FROM source as server

COPY --from=test /work/bob_emploi/frontend/server/translations.json bob_emploi/frontend/server/

# Setup environment.
EXPOSE 80
CMD ["uwsgi", "--protocol=http", "--socket", "0.0.0.0:80", "--enable-threads", "-w", "bob_emploi.frontend.server.server:app"]
ARG GIT_SHA1=non-git

# Label the image with the git commit.
LABEL org.bayesimpact.git=$GIT_SHA1
# Set a default server version based on Git commit. This is overriden in
# production with more context, e.g. the name of the demo server.
ENV SERVER_VERSION=git-$GIT_SHA1 \
  BIND_HOST=0.0.0.0
