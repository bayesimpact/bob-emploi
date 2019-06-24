FROM bayesimpact/pandas-base:latest

RUN mkdir /work
WORKDIR /work

RUN apt-get update -qqy && \
  apt-get install unzip python-pdfminer python-dev locales -qqy && \
  # Install locale fr_FR so that we can format dates for French users.
  sed -i -e "s/# fr_FR.UTF/fr_FR.UTF/" /etc/locale.gen && locale-gen && \
  rm /bin/sh && ln -s /bin/bash /bin/sh

# Requirements for python code (outside of notebooks). Keep them sorted.
RUN pip install --upgrade \
  airtable \
  'airtablemock>=0.0.9' \
  'algoliasearch>=2.0' \
  awscli \
  coverage \
  csvkit \
  google-api-python-client \
  httplib2 \
  js2py \
  'mongomock>=3.16' \
  'mypy>=0.650' \
  # TODO(pascal): Uncap once https://github.com/python/typeshed/commit/07ea661 is live in mypy.
  'mypy-protobuf==1.9' \
  nbformat \
  nose \
  nose-exclude \
  nose-watch \
  'pandas>=0.24.1' \
  polib \
  protobuf \
  pycodestyle \
  pylint \
  pylint-doc-spacing \
  pylint-quotes \
  pymongo \
  python-emploi-store \
  requests \
  requests_mock \
  runipy \
  sas7bdat \
  scrapy \
  sentry-sdk \
  sklearn \
  termcolor \
  tqdm \
  typing_extensions \
  xmltodict

ARG PROTOBUF_VERSION=3.7.0

# Install Protobuf compiler.
RUN \
  curl --silent -L "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip" -o protoc.zip && \
  unzip -qq protoc.zip && rm protoc.zip && rm readme.txt && mv bin/protoc /usr/local/bin && mkdir /usr/local/share/proto && mv include/google /usr/local/share/proto

ENV PYTHONPATH=/work:/usr/lib/python3/dist-packages/

CMD ["make", "all"]

COPY data_analysis/ /work/bob_emploi/data_analysis/
COPY data_analysis/.coveragerc data_analysis/entrypoint.sh data_analysis/lint_and_test.sh data_analysis/Makefile* .pylintrc /work/
COPY .pycodestyle /work/setup.cfg
COPY frontend/api/*.proto /work/bob_emploi/frontend/api/
COPY frontend/server/ /work/bob_emploi/frontend/server/
COPY frontend/release/scheduled-tasks /work/bob_emploi/frontend/release/scheduled-tasks
# TODO(pascal): Clean up our typing stubs for mongomock package once it gets typed.
RUN [ ! -f /usr/local/lib/python3.7/site-packages/mongomock/__init__.pyi ]
RUN ! ls /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/*/mongomock/__init__.pyi 2> /dev/null
COPY data_analysis/vendor/mongomock/ /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/3/mongomock/
# TODO(pascal): Clean up our typing stubs for requests_mock package once it gets typed.
RUN [ ! -f /usr/local/lib/python3.7/site-packages/requests_mock/__init__.pyi ]
RUN ! ls /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/*/requests_mock/__init__.pyi 2> /dev/null
COPY frontend/server/test/vendor/requests_mock/ /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/2and3/requests_mock/
# TODO(pascal): Clean up our typing stubs for parsel and scrapy packages once they get typed.
RUN [ ! -f /usr/local/lib/python3.7/site-packages/parsel/__init__.pyi ]
RUN [ ! -f /usr/local/lib/python3.7/site-packages/scrapy/__init__.pyi ]
RUN ! ls /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/*/parsel/__init__.pyi 2> /dev/null
RUN ! ls /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/*/scrapy/__init__.pyi 2> /dev/null
COPY data_analysis/vendor/parsel/ /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/2and3/parsel/
COPY data_analysis/vendor/scrapy/ /usr/local/lib/python3.7/site-packages/mypy/typeshed/third_party/2and3/scrapy/

RUN /work/bob_emploi/data_analysis/vendor/patch.sh

ARG SKIP_TEST=
RUN test -n "$SKIP_TEST" && echo "Skipping tests" || TEST_ENV=1 ./entrypoint.sh ./lint_and_test.sh --with-coverage --cover-inclusive --cover-package=. --cover-html --cover-xml
