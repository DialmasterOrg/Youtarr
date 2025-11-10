#!/bin/bash
# Create a new Sequelize migration
# Uses dbconfig.js which reads from .env file (if present)

npx sequelize-cli migration:create --config config/dbconfig.js --name $1