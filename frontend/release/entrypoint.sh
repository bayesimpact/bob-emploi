#!/bin/bash

readonly CONF_DIR=/etc/nginx/conf.d/deployments

CONF_FILE="$CONF_DIR/${BOB_DEPLOYMENT:-fr}${DEMO_MODE:-Demo}.conf"

if [[ ! -f "$CONF_FILE" ]]; then
  # Someone got their config wrong or forgot to set it, let's find a prefered demo.
  readonly PREFERED_DEMOS=("frDemo" "*Demo" "*Showcase" "*")
  for pattern in ${PREFERED_DEMOS[@]}; do
    CONF_FILE="$(ls $CONF_DIR/${pattern}.conf)"
    if [[ -n "$CONF_FILE" ]]; then
      break
    fi
  done
fi

ln -s -f "$CONF_FILE" /etc/nginx/conf.d/default.conf

# Update URL for flask backend.
if [ -n "${FLASK_URL}" ]; then
  sed -i -e "s/frontend-flask/${FLASK_URL}/" /etc/nginx/conf.d/default.conf
fi

nginx -g 'daemon off;'
