#!/bin/sh
set -eu

envsubst '${VITE_APP_NAME} ${VITE_API_BASE_URL}' \
  < /etc/app/runtime-config.js.template \
  > /usr/share/nginx/html/config.js
