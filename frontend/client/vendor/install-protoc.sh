#!/bin/bash
# It needs the version number in the PROTOBUF_VERSION env var.
readonly DEST_FOLDER="$1"

curl --silent -L "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip" -o protoc.zip

# Unzip then remove the zip and unneeded files.
unzip -qq protoc.zip
rm protoc.zip
rm readme.txt

# Move the binary to /bin and the common protos to /share.
mv bin/protoc "${DEST_FOLDER}/bin/"
mv include "${DEST_FOLDER}/share/proto"
