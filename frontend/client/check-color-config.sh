#!/bin/bash
#
# A script to check that all and only theme colors are used.
# TODO(cyrille): Also check they aren't any duplicate colors (or close ones?)

readonly ERROR='\033[0;31mERROR\033[0m'
readonly OK='\033[0;32mok\033[0m'

# Checking all colors with format #123abc, #1a9 are in the config colors.json (except for #000 and #fff).
readonly COLOR_REGEX="#[0-9a-f]{6}|#[0-9a-f]{3}(?<!000|fff)"
readonly FRONTEND_FOLDER="$(dirname ${BASH_SOURCE[0]})/"

function check_plugin() {
  local folder=$1
  local is_core=$2
  local color_file="${folder}cfg/colors.json5"
  local src_folder="${folder}src"
  if ! [ -f "$color_file" ]; then
    echo "Plugin '$folder' has no color file."
    if [ -n "$is_core" ]; then
      echo "Core should have a color file."
      return 3
    fi
    return
  fi
  local not_a_color=$(json5 "$color_file" | jq -r '.[]' | grep -vP $COLOR_REGEX)
  if [[ -n "$not_a_color" ]]; then
    echo -e "$ERROR: There are values in the colors config file that are not valid colors:"
    echo -e "$not_a_color"
    return 4
  fi
  local config_colors_count=$(json5 "$color_file" | jq -r '.[]' | grep -icP $COLOR_REGEX)
  # TODO(cyrille): Make sure the import colors are in the config as well.
  local import_colors_count=$(grep -iP $COLOR_REGEX -rh --include \*.js  --include \*.jsx --include \*.ts  --include \*.tsx "$src_folder" | grep ^import | wc -l | tr -d ' ')
  local total_colors_count=$(grep -iP $COLOR_REGEX -roh --include \*.js  --include \*.jsx --include \*.ts  --include \*.tsx "$src_folder" | wc -w | tr -d ' ')
  local extra_colors_count=$(expr $total_colors_count - $import_colors_count)
  if [[ "$extra_colors_count" != "0" ]]; then
    echo -e "$ERROR: There are colors in js files not in the config:"
    echo -e "  Colors for imports: $import_colors_count"
    echo -e "  Total colors in Js, Jsx, Ts and Tsx files: \033[0;31m$total_colors_count\033[0m"
    grep -iP $COLOR_REGEX -rh --include \*.js --include \*.jsx --include \*.ts --include \*.tsx "$src_folder" | grep -v ^import
    return 1
  fi
  if [ -z "$is_core" ]; then
    local color_names=$(json5 "$color_file" | jq -r 'keys|.[]')
    local used_color_names=$(grep -ohr colors\\.\\w\\+ "$src_folder/" | sed -e 's/colors.//')
    local colors_diff=$(echo "$color_names $used_color_names $used_color_names" | tr ' ' '\n' | sort | uniq -u)
    # Checking all colors of the Colors object from plugin are used.
    # TODO(cyrille): Also check that all used colors come from plugin or core.
    if [ -n "$colors_diff" ]; then
      echo -e "$ERROR: config colors are unused:\n$colors_diff"
      return 2
    fi
  # Checking all defined colors are used and all used colors are defined.
  elif ! COLORS_DIFF=$(diff -y \
    <(json5 "$color_file" | jq -r 'keys|.[]' | sort -u) \
    <(grep -ohr colors\\.\\w\\+ "$src_folder/" | sort -u | sed -e 's/colors.//')); then
    echo -e "$ERROR: config colors do not match used colors:\n$COLORS_DIFF"
    return 2
  fi
  echo -e "$OK: All js colors (except for the $import_colors_count used in imports) are in the config ($config_colors_count) and all of them are used."
}

EXIT=0
for plugin in $(ls -d -- ${FRONTEND_FOLDER}plugins/*/); do
  echo "Checking colors in '$plugin' ..."
  check_plugin "$plugin" || EXIT=$?
done
echo "Checking colors in '$FRONTEND_FOLDER' ..."
check_plugin "$FRONTEND_FOLDER" "is_core" || EXIT=$?
exit $EXIT
