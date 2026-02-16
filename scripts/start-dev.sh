#!/bin/bash

export DEV_MODE=true
export USE_EXTERNAL_DB=false
export USE_DOCKER_COMPOSE_DEV=true

source ./scripts/_start_template.sh "$@"
