#!/bin/sh
set -e
# El disco de Render monta /data encima de la carpeta de la imagen (a menudo como root).
mkdir -p /data
chown -R node:node /data
exec su-exec node "$@"
