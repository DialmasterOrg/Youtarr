#!/bin/bash

# Set MariaDB paths
MARIADB_BASE="/opt/mariadb"
MARIADB_DATADIR="/var/lib/mysql"
MARIADB_SOCKET="/run/mysqld/mysqld.sock"
MARIADB_PORT="3321"

# Ensure directories exist with correct permissions
mkdir -p /run/mysqld
chown -R mysql:mysql /run/mysqld /var/lib/mysql

# Check if the data directory has been initialized
if [ ! -d "${MARIADB_DATADIR}/mysql" ]; then
    echo "Initializing MariaDB data directory..."
    # Initialize MariaDB data directory using the binary
    "${MARIADB_BASE}/scripts/mysql_install_db" \
        --user=mysql \
        --basedir="${MARIADB_BASE}" \
        --datadir="${MARIADB_DATADIR}" \
        --auth-root-authentication-method=normal

    # Start MariaDB using the binary
    "${MARIADB_BASE}/bin/mysqld" \
        --basedir="${MARIADB_BASE}" \
        --datadir="${MARIADB_DATADIR}" \
        --plugin-dir="${MARIADB_BASE}/lib/plugin" \
        --socket="${MARIADB_SOCKET}" \
        --port=${MARIADB_PORT} \
        --bind-address=0.0.0.0 \
        --skip-name-resolve \
        --user=mysql &

    # Wait for MariaDB to start
    echo "Waiting for DB to start..."
    until "${MARIADB_BASE}/bin/mysqladmin" --socket="${MARIADB_SOCKET}" ping >/dev/null 2>&1; do
      echo -n "."; sleep 1
    done
    echo " DB started!"

    # Run the SQL commands to set up the database and user.
    "${MARIADB_BASE}/bin/mysql" --socket="${MARIADB_SOCKET}" -uroot <<-EOSQL
        SET @@SESSION.SQL_LOG_BIN=0;
        UPDATE mysql.user SET Password=PASSWORD('123qweasd') WHERE User='root';
        CREATE DATABASE IF NOT EXISTS youtarr;
        GRANT ALL ON youtarr.* TO 'root'@'%' IDENTIFIED BY '123qweasd' WITH GRANT OPTION;
        FLUSH PRIVILEGES;
EOSQL
else
    echo "Using existing MariaDB data directory..."
    # Start MariaDB using the binary
    "${MARIADB_BASE}/bin/mysqld" \
        --basedir="${MARIADB_BASE}" \
        --datadir="${MARIADB_DATADIR}" \
        --plugin-dir="${MARIADB_BASE}/lib/plugin" \
        --socket="${MARIADB_SOCKET}" \
        --port=${MARIADB_PORT} \
        --bind-address=0.0.0.0 \
        --skip-name-resolve \
        --user=mysql &

    # Wait for MariaDB to start
    echo "Waiting for DB to start..."
    until "${MARIADB_BASE}/bin/mysqladmin" --socket="${MARIADB_SOCKET}" ping >/dev/null 2>&1; do
      echo -n "."; sleep 1
    done
    echo " DB started!"

fi