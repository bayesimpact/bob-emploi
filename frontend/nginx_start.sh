#!/bin/bash
readonly IP=$(/sbin/ip route|awk '/src/ { print $9 }')
printf "Listening on \033[0;33mhttp://${IP}/\033[0m\n"

nginx -g 'daemon off;'
