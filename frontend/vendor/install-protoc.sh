#!/bin/bash
readonly PROTOBUF_VERSION="$1"
readonly DEST_FOLDER="$2"

# Get the release from GitHub.
wget --quiet https://github.com/google/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip -O protoc.zip

# Unzip then remove the zip and unneeded files.
unzip -qq protoc.zip
rm protoc.zip
rm readme.txt

# Move the binary to /bin and the common protos to /share.
mv protoc "${DEST_FOLDER}/bin/"
mkdir -p "${DEST_FOLDER}/share/proto"
mv google "${DEST_FOLDER}/share/proto"
