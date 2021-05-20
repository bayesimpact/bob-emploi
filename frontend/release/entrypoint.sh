#!/bin/bash

# Update URL for flask backend.
if [ -n "${FLASK_URL}" ]; then
  sed -i -e "s/frontend-flask/${FLASK_URL}/" /etc/nginx/conf.d/default.conf
fi

if [ -n "$BOB_DEPLOYMENT" ]; then
  sed -i -e "s/frDemo/${BOB_DEPLOYMENT}Demo/" /etc/nginx/conf.d/default.conf
fi

nginx -g 'daemon off;'
