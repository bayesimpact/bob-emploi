#!/bin/bash

readonly ERROR='\033[0;31mERROR\033[0m'
readonly OK='\033[0;32mok\033[0m'

# Checking all colors with format #123abc, #1a9 are in the config colors.json (except for #000 and #fff).
readonly COLOR_REGEX="#[0-9a-f]{6}|#[0-9a-f]{3}(?<!000|fff)"
readonly FRONTEND_FOLDER="$(dirname ${BASH_SOURCE[0]})"
readonly CONFIG_COLORS_COUNT=$(json5 "$FRONTEND_FOLDER/cfg/colors.json5" | jq -r '.[]' |\
  grep -icP $COLOR_REGEX)
# TODO(cyrille): Make sure the import colors are in the config as well.
readonly IMPORT_COLORS_COUNT=$(grep -iP $COLOR_REGEX -rh --include \*.js  --include \*.jsx --include \*.ts  --include \*.tsx "$FRONTEND_FOLDER/src" | grep ^import | wc -l | tr -d ' ')
readonly TOTAL_COLORS_COUNT=$(grep -iP $COLOR_REGEX -roh --include \*.js  --include \*.jsx --include \*.ts  --include \*.tsx "$FRONTEND_FOLDER/src" | wc -w | tr -d ' ')
readonly EXTRA_COLORS_COUNT=$(expr $TOTAL_COLORS_COUNT - $IMPORT_COLORS_COUNT)
if [[ "$EXTRA_COLORS_COUNT" != "0" ]]; then
  echo -e "$ERROR: There are colors in js files not in the config:"
  echo -e "  Colors for imports: $IMPORT_COLORS_COUNT"
  echo -e "  Total colors in Js, Jsx, Ts and Tsx files: \033[0;31m$TOTAL_COLORS_COUNT\033[0m"
  grep -iP $COLOR_REGEX -rh --include \*.js --include \*.jsx --include \*.ts --include \*.tsx "$FRONTEND_FOLDER/src" | grep -v ^import
  exit 1
fi

# Checking all colors of the Colors object are used.
if ! COLORS_DIFF=$(diff -y \
  <(json5 "$FRONTEND_FOLDER/cfg/colors.json5" | jq -r 'keys|.[]' | sort -u) \
  <(grep -ohr colors\\.\\w\\+ "$FRONTEND_FOLDER/src/" | sort -u | sed -e 's/colors.//')); then
  echo -e "$ERROR: config colors do not match used colors:\n$COLORS_DIFF"
  exit 2
fi

echo -e "$OK: All js colors (except for the $IMPORT_COLORS_COUNT used in imports) are in the config ($CONFIG_COLORS_COUNT) and all of them are used."
