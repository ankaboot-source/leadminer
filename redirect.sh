#!/bin/sh

leadminer_path="/app"

if [ "$NODE_ENV" = "production" ] ; then
	config_file="production.yaml"
else
	config_file="default.yaml"
fi
redis_url="$(niet server.redis.url < "$leadminer_path"/backend/config/"$config_file" | sed 's/@//')"
host="$(echo "$redis_url" | cut -d: -f 2)"
port="$(echo "$redis_url" | cut -d: -f 3)"
socat tcp-l:"${port}",fork,reuseaddr tcp:"${host}":"${port}"
