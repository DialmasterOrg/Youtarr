#!/bin/bash
npx sequelize-cli migration:create --config config/dbconfig.json --name $1