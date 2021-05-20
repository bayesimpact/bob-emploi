#! /bin/bash
# Run babel i18next key extraction on core app and plugins.
#
# If an argument is given (either 'core' or a plugin name), it will extract only for this app.

readonly FRONTEND="$(dirname ${BASH_SOURCE[0]})"
readonly ONLY_PLUGIN="$1"

# Fail on the first extraction that fails.
set -e

function extract_plugin() {
    local dir="$1"
    if ! ls ${dir}i18n.babelrc* &> /dev/null; then
        echo "No i18n extraction config in $dir."
        if [ -n "$ONLY_PLUGIN" ]; then
            return 1
        fi
        return 0
    fi
    npx babel --config-file "./${dir}i18n.babelrc" './src/**/*.{js,jsx,ts,tsx}' './release/lambdas/opengraph_redirect.js' "./${dir}src/**/*.{js,jsx,ts,tsx}" > /dev/null
}
cd "$FRONTEND"
for plugin in $(plugins/list_plugins); do
    dir="plugins/$plugin/"
    if [ -z "$ONLY_PLUGIN" ] || [[ "$ONLY_PLUGIN" == "$plugin" ]]; then
        extract_plugin "$dir"
    fi
done
