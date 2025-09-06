#!/bin/bash

# Trap signals for graceful shutdown
# SIGTERM is sent by Docker stop, SIGINT by Ctrl+C
trap 'handle_shutdown' SIGTERM SIGINT

# Function to handle shutdown gracefully
handle_shutdown() {
    echo "Received shutdown signal, stopping services gracefully..."
    
    # Stop Node.js server if it's running
    if [ ! -z "$NODE_PID" ]; then
        echo "Stopping Node.js server (PID: $NODE_PID)..."
        kill -TERM "$NODE_PID" 2>/dev/null
        wait "$NODE_PID" 2>/dev/null
    fi
    
    # Gracefully shutdown MariaDB
    if [ ! -z "$MYSQL_PID" ]; then
        echo "Stopping MariaDB gracefully (PID: $MYSQL_PID)..."
        /opt/mariadb/bin/mysqladmin --socket=/run/mysqld/mysqld.sock -uroot -p123qweasd shutdown
        
        # Wait for MariaDB to shut down (max 30 seconds)
        local count=0
        while kill -0 "$MYSQL_PID" 2>/dev/null && [ $count -lt 30 ]; do
            echo -n "."
            sleep 1
            count=$((count + 1))
        done
        
        if kill -0 "$MYSQL_PID" 2>/dev/null; then
            echo " MariaDB did not stop gracefully, forcing..."
            kill -9 "$MYSQL_PID" 2>/dev/null
        else
            echo " MariaDB stopped cleanly."
        fi
    fi
    
    echo "Shutdown complete."
    exit 0
}

# Start MariaDB first
echo "Starting MariaDB..."
/usr/local/bin/start_mariadb.sh

# Get MariaDB PID
MYSQL_PID=$(pgrep -f "mysqld.*port=3321")
echo "MariaDB started with PID: $MYSQL_PID"

# Start Node.js server in the background
echo "Starting Node.js server..."
node /app/server/server.js &
NODE_PID=$!
echo "Node.js server started with PID: $NODE_PID"

# Wait for Node.js process
# This keeps the script running and allows trap to work
wait "$NODE_PID"

# If we get here, Node crashed without signal
echo "Node.js server exited unexpectedly"
handle_shutdown