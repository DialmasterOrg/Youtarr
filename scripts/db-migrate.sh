#!/bin/bash
docker exec youtarr-dev npx sequelize-cli db:migrate --config config/dbconfig.json