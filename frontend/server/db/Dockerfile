# Create a docker container with Mongo and a pre-populated database.
FROM mongo:latest

# Create the DB in /data/localdb, as usual path (/data/db is handled as a
# volume and therefore is not persisted in the container).
RUN mkdir /data/localdb && chown mongodb /data/localdb

# Dependency of the populate.sh script (for killall).
RUN apt-get update -qqy && apt-get install -qqy psmisc

# Populate the DB in the container.
COPY *.js populate.sh ./
COPY fixtures fixtures
RUN gosu mongodb /bin/bash ./populate.sh --dbpath=/data/localdb
RUN rm -r populate.sh *.js fixtures

CMD ["mongod", "--dbpath=/data/localdb"]
