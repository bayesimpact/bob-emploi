#!/bin/bash
#
# This scripts is used to populate a MongoDB with fixtures. It should be used
# inside a docker container.

while read LOGLINE
do
  if [[ "${LOGLINE}" == *"waiting for connections"* ]]; then
    for collection_file in fixtures/*.json; do
      collection=${collection_file/fixtures\//}
      collection=${collection/.json/}
      mongoimport -c "$collection" --jsonArray --file="${collection_file}"
    done
    mongo *.js
    killall mongod
  fi
  if [[ "${LOGLINE}" == *"dbexit"* ]]; then
    break
  fi
done < <(mongod $@)
