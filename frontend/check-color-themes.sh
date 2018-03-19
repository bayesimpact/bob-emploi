#!/bin/bash

readonly ERROR='\033[0;31mERROR\033[0m'
readonly OK='\033[0;32mok\033[0m'

# Checking all colors with format #123abc are in the Colors object of theme.jsx
# TODO(cyrille): Also check colors with only three hex digits.
readonly COLOR_REGEX="#[0-9a-f]{6}"
readonly FRONTEND_FOLDER="$(dirname ${BASH_SOURCE[0]})"
readonly THEME_COLORS_COUNT=$(grep -m 1 '^\}$' -B10000 "$FRONTEND_FOLDER/src/components/theme.jsx" |\
  sed -n -e '/Colors/,$p' |\
  grep -icE $COLOR_REGEX)
# TODO(cyrille): Make sure the import colors are in the theme as well.
readonly IMPORT_COLORS_COUNT=$(grep -iE $COLOR_REGEX -rh --include \*.js  --include \*.jsx "$FRONTEND_FOLDER/src" | grep ^import | wc -l | tr -d ' ')
readonly TOTAL_COLORS_COUNT=$(grep -iE $COLOR_REGEX -roh  --include \*.js  --include \*.jsx "$FRONTEND_FOLDER/src" | wc -w | tr -d ' ')
readonly EXTRA_COLORS_COUNT=$(expr $TOTAL_COLORS_COUNT - $IMPORT_COLORS_COUNT - $THEME_COLORS_COUNT)
if [[ "$EXTRA_COLORS_COUNT" != "0" ]]; then
  echo -e "$ERROR: There are colors in js files not in the theme:"
  echo -e "  Theme colors: $THEME_COLORS_COUNT"
  echo -e "  Colors for imports: $IMPORT_COLORS_COUNT"
  echo -e "  Total colors in Js and Jsx files: \033[0;31m$TOTAL_COLORS_COUNT\033[0m"
  exit 1
fi

# Checking all colors of the Colors object are used.
readonly THEME_COLORS=$(grep -m 1 '^\}$' -B10000 "$FRONTEND_FOLDER/src/components/theme.jsx" |\
  sed -n -e '/Colors/,$p' |\
  grep -iE '#[0-9a-f]{6}' |\
  sed 's/:.*//;s/^ *//')
MISSING_COLORS=""
for color in $THEME_COLORS; do
  if ! $(grep -iqrE "Colors\.$color" --include \*.js --include \*.jsx "$FRONTEND_FOLDER/src"); then
    MISSING_COLORS="$MISSING_COLORS, $color"
  fi
done
if [[ -n "$MISSING_COLORS" ]]; then
  echo -e "$ERROR: Some theme colors are never used$MISSING_COLORS"
  exit 2
fi

echo -e "$OK: All js colors (except for the $IMPORT_COLORS_COUNT used in imports) are in the theme ($THEME_COLORS_COUNT) and all of them are used."
