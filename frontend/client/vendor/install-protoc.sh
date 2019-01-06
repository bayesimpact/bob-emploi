#!/bin/bash
readonly DEST_FOLDER="$1"

# Get the latest release version from GitHub.
# TODO(pascal): Use curl everywhere instead of wget.
readonly PROTOBUF_VERSION="$(\
  curl -i https://github.com/protocolbuffers/protobuf/releases/latest |\
  grep ^Location: |\
  sed -e "s/^.*\/v//;s/\s*$//")"

# Get the latest release from GitHub.
wget --quiet https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip -O protoc.zip

# Unzip then remove the zip and unneeded files.
unzip -qq protoc.zip
rm protoc.zip
rm readme.txt

# Move the binary to /bin and the common protos to /share.
mv bin/protoc "${DEST_FOLDER}/bin/"
mv include "${DEST_FOLDER}/share/proto"
