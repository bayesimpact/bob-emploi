#!/bin/bash
# A script to prepare Swagger UI, and upload the API to https://api.hellobob.com
# See go/bob:api-doc.
# TODO(cyrille): Use in CircleCI or in deploy.sh.

readonly API_FOLDER="$(dirname "$0")/api"
readonly ACTION=$1

function download_assets {
  local swagger_ui_assets_url="$(
    curl -L --silent api.github.com/repos/swagger-api/swagger-ui/releases/latest |
    jq -r '.zipball_url')"
  local zip_file="$(mktemp -ut XXXXXXX.zip)"
  curl -L --silent "$swagger_ui_assets_url" -o "$zip_file"
  mkdir -p "$API_FOLDER"
  unzip -jo "$zip_file" "*/dist/*" -d "$API_FOLDER/assets"
  rm "$zip_file"
  rm "$API_FOLDER/assets/index.html"
}

function upload_to_s3 {
  aws s3 cp --recursive "$API_FOLDER" "s3://bob-emploi-api"
}

if [[ "$ACTION" == "download" ]]; then
  download_assets
  exit
fi

if [[ "$ACTION" == "upload" ]]; then
  upload_to_s3
  exit
fi

echo "Usage:"
echo "- download the relevant assets for the Swagger UI:"
echo "    $0 download"
echo '- upload the assets and the API to s3 (this updates api.hellobob.com):'
echo "    $0 upload"
