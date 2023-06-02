#!/bin/bash

# Check if the data directory has been initialized
if [ ! -d "/var/lib/mysql/mysql" ]; then
    # Initialize MariaDB data directory
    mysql_install_db --user=mysql --ldata=/var/lib/mysql

    # Start MariaDB
    mysqld_safe --nowatch --datadir=/var/lib/mysql &

    # Wait a bit for MariaDB to start
    echo "Waiting for DB..."
    #sleep 10
    # Wait for MariaDB to start
    echo "Waiting for DB..."
    until mysqladmin ping >/dev/null 2>&1; do
      echo -n "."; sleep 1
    done


    # Run the SQL commands to set up the database and user.
    mysql -uroot <<-EOSQL
        SET @@SESSION.SQL_LOG_BIN=0;
        UPDATE mysql.user SET Password=PASSWORD('123qweasd') WHERE User='root';
        CREATE DATABASE IF NOT EXISTS youtarr;
        GRANT ALL ON youtarr.* TO 'root'@'%' IDENTIFIED BY '123qweasd' WITH GRANT OPTION;
        FLUSH PRIVILEGES;
EOSQL
else
    # Start MariaDB
    mysqld_safe --nowatch --datadir=/var/lib/mysql &

    # Wait a bit for MariaDB to start
    echo "Waiting for DB..."
    # Wait for MariaDB to start
    echo "Waiting for DB..."
    until mysqladmin ping >/dev/null 2>&1; do
      echo -n "."; sleep 1
    done

fi