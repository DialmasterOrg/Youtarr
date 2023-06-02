# Development instructions

These instructions are meant to explain how to do local development.
They will show you how to run a local server with hot reload for both the Node.js server and the React client, as well as how to run database migrations.

## Running the DB, server and client with hot reload for development

1. First run the database in Docker:
   `npm run start:db`

2. Then run the client/server:
   `npm run dev`

3. Running migrations with this setup: `./scripts/db-migrate.sh`

4. Create a new migration file (to be filled in): `./scripts/db-create-migration.sh`

## Creating and running a test docker image for local validation

1. `./script/build-dev.sh` then `./scripts/start-dev.sh`

## Creating a release build

`./scripts/create-release.sh`
