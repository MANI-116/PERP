#!/bin/sh
set -e

echo "Starting application processes..."

exec /usr/bin/supervisord \
  -c /etc/supervisor/conf.d/supervisord.conf