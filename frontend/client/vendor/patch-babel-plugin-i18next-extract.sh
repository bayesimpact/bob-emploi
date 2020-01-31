#!/bin/bash

# TODO(pascal): Remove once https://github.com/gilbsgilbs/babel-plugin-i18next-extract/issues/33 is implemented.
sed -i -e "s/'react-i18next', 'Trans'/'components\/i18n', 'Trans'/" node_modules/babel-plugin-i18next-extract/lib/index.js
