#! /bin/bash
# Run babel i18next key extraction on core app and plugins.
#
# If an argument is given (either 'core' or a plugin name), it will extract only for this app.

readonly FRONTEND="$(dirname ${BASH_SOURCE[0]})"
readonly ONLY_PLUGIN="$1"

function extract_plugin() {
    local dir="$1"
    if ! ls ${dir}i18n.babelrc* > /dev/null; then
        echo "No i18n extraction config in $dir."
        if [ -n "$ONLY_PLUGIN" ]; then
            return 1
        fi
        return 0
    fi
    npx babel --config-file "./${dir}i18n.babelrc" './src/**/*.{js,jsx,ts,tsx}' "./${dir}src/**/*.{js,jsx,ts,tsx}" > /dev/null
}
cd "$FRONTEND"
if [ -z "$ONLY_PLUGIN" ] || [[ "$ONLY_PLUGIN" == "core" ]]; then
    extract_plugin ""
fi
for dir in $(ls -d -- plugins/*/); do
    if [ -z "$ONLY_PLUGIN" ] || [[ "plugins/$ONLY_PLUGIN/" == "$dir" ]]; then
        extract_plugin "$dir"
    fi
done
