#!/bin/bash

JSON_MAIL_SELECTOR='.Data | .[0]'

FIELD_HEADER="Headers"
FIELD_TEXT="Text-part"
FIELD_HTML="Html-part"
FIELD_MJML="MJMLContent"

TEMPLATES_FOLDER="$(dirname ${BASH_SOURCE[0]})"

# First parameter, must be "download" or "upload".
readonly ACTION=$1
# Optional second parameter: the name of a folder, e.g. "network", "nps" to
# only download or upload one Mailjet template.
readonly ONLY_FOLDER=$2
# File that indicates that no action was taken if present.
readonly NO_ACTION_TAKEN="$(mktemp)"

function get_template {
  if [[ -n "$ONLY_FOLDER" ]] && [[ "$ONLY_FOLDER" != "$2" ]]; then
    return
  fi

  local campaign="$1"
  local output_dir="$TEMPLATES_FOLDER/$2"
  local tempfile="$(mktemp -t template_XXXXXXX.json || exit 1)"

  curl -s -X GET --user "$MAILJET_APIKEY_PUBLIC:$MAILJET_SECRET" \
    https://api.mailjet.com/v3/REST/template/$campaign/detailcontent > "$tempfile"

  mkdir -p $output_dir
  jq -r "$JSON_MAIL_SELECTOR"' | .["'"$FIELD_HTML"'"]' "$tempfile" | sed -e :a -e '/^\n*$/{$d;N;};/\n$/ba' > "$output_dir/template.html"
  jq -r "$JSON_MAIL_SELECTOR"' | .["'"$FIELD_TEXT"'"]' "$tempfile" | sed -e :a -e '/^\n*$/{$d;N;};/\n$/ba' > "$output_dir/template.txt"
  jq -S "$JSON_MAIL_SELECTOR"' | .["'"$FIELD_MJML"'"]' "$tempfile" > "$output_dir/template.mjml"
  jq -S "$JSON_MAIL_SELECTOR"' | .["'"$FIELD_HEADER"'"]' "$tempfile" > "$output_dir/headers.json"

  grep -P "(?<=[{ ]var:)\\w+" -o "$output_dir/template.html" | sort -u > "$output_dir/vars.txt"

  rm "$tempfile"

  rm -f "$NO_ACTION_TAKEN"
}

# TODO(cyrille): Remove trailing newline in text files at upload.
function post_template {
  if [[ -n "$ONLY_FOLDER" ]] && [[ "$ONLY_FOLDER" != "$2" ]]; then
    return
  fi

  local campaign="$1"
  local input_dir="$TEMPLATES_FOLDER/$2"
  local output_file="$(mktemp -t template_XXXXXXX.json || exit 1)"

  local text="$(jq --slurp -R '.' "$input_dir/template.txt")"
  local html="$(jq --slurp -R '.' "$input_dir/template.html")"
  local mjml="$(cat $input_dir/template.mjml)"
  local header="$(cat $input_dir/headers.json)"
  echo '{' > $output_file
  echo '"'"$FIELD_HEADER"'": '"$header"',' >> $output_file
  echo '"'"$FIELD_HTML"'": '"$html"',' >> $output_file
  echo '"'"$FIELD_MJML"'": '"$mjml"',' >> $output_file
  echo '"'"$FIELD_TEXT"'": '"$text" >> $output_file
  echo '}' >> $output_file

  curl -s -X POST --user "$MAILJET_APIKEY_PUBLIC:$MAILJET_SECRET" \
      https://api.mailjet.com/v3/REST/template/$campaign/detailcontent \
      -H 'Content-Type: application/json' \
      -d "@$output_file"

  rm "$output_file"

  rm -f "$NO_ACTION_TAKEN"
}

function handle_template {
  if [[ $ACTION == "download" ]]; then
    get_template "$@"
  else
    post_template "$@"
  fi
}

if [ -z "$MAILJET_APIKEY_PUBLIC" ] || [ -z "$MAILJET_SECRET" ]; then
  echo "No authentication keys were found for Mailjet."
  echo "Please set the Mailjet API keys as environment variables \
MAILJET_APIKEY_PUBLIC and MAILJET_SECRET."
  exit 1
fi

if [[ "$1" != "download" ]] && [[ "$1" != "upload" ]]; then
  echo "Run this script with \"upload\" or \"download\" command."
  exit 1
fi

for template in $(jq -c .[] "$TEMPLATES_FOLDER/mailjet.json"); do
  handle_template $(jq -r .mailjetTemplate <<< $template) $(jq -r .name <<< $template)
done

if [[ -n "$ONLY_FOLDER" ]] && [[ -e "$NO_ACTION_TAKEN" ]]; then
  echo "Could not find the folder \"$ONLY_FOLDER\"."
  exit 1
fi

rm -f "$NO_ACTION_TAKEN"
