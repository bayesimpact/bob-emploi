#!/bin/bash

# Update URL for flask backend.
if [ -n "${FLASK_URL}" ]; then
  sed -i -e "s/frontend-flask/${FLASK_URL}/" /etc/nginx/conf.d/default.conf
fi

nginx -g 'daemon off;'
