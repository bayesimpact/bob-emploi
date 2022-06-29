#!/bin/bash
# It needs the version number in the PROTOBUF_VERSION env var.
readonly DEST_FOLDER="$1"
readonly GRPC_GATEWAY_VERSION="2.1.0"

curl --silent -L "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOBUF_VERSION}/protoc-${PROTOBUF_VERSION}-linux-x86_64.zip" -o protoc.zip
curl --silent -L "https://github.com/grpc-ecosystem/grpc-gateway/archive/v${GRPC_GATEWAY_VERSION}.zip" -o grpc_gateway.zip

# Unzip then remove the zips and unneeded files.
unzip -qq protoc.zip
rm protoc.zip
rm readme.txt
unzip -qq grpc_gateway.zip
rm grpc_gateway.zip

# Move the binary to /bin and the common protos to /share.
mv bin/protoc "${DEST_FOLDER}/bin/"
mv include "${DEST_FOLDER}/share/proto"
mv "grpc-gateway-$GRPC_GATEWAY_VERSION/third_party/googleapis/google/api" "${DEST_FOLDER}/share/proto/google"

# Remove the remaining unneeded files.
rm -r "grpc-gateway-$GRPC_GATEWAY_VERSION"
