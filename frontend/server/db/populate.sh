#!/bin/bash
#
# This scripts is used to populate a MongoDB with fixtures. It should be used
# inside a docker container.

mongod "$@" >/dev/null &
# Chech whether server is operational.
until mongo --eval "print(\"waited for connection\")"; do
  sleep 1
done
for collection_file in fixtures/*.json; do
  collection=${collection_file/fixtures\//}
  collection=${collection/.json/}
  echo Importing ${collection}...
  mongoimport -vv -c "$collection" --jsonArray --file="${collection_file}"
done
mongo *.js
readonly SUCCESS=1
killall mongod

if [ -z "$SUCCESS" ]; then
  exit 1
fi
