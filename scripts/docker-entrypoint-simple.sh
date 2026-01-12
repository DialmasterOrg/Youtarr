#!/bin/bash

# Trap signals for graceful shutdown
trap 'handle_shutdown' SIGTERM SIGINT

handle_shutdown() {
    echo "Received shutdown signal, stopping Node.js server gracefully..."

    # Stop Node.js server if it's running
    if [ ! -z "$NODE_PID" ]; then
        echo "Stopping Node.js server (PID: $NODE_PID)..."
        kill -TERM "$NODE_PID" 2>/dev/null
        wait "$NODE_PID" 2>/dev/null
    fi

    echo "Shutdown complete."
    exit 0
}

echo "Waiting for database to be ready..."

MAX_TRIES=30
TRIES=0
while [ $TRIES -lt $MAX_TRIES ]; do
    if node -e "
        const mysql = require('mysql2/promise');
        mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3321,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '123qweasd',
            database: process.env.DB_NAME || 'youtarr'
        }).then(() => {
            console.log('Database connection successful');
            process.exit(0);
        }).catch((err) => {
            process.exit(1);
        });
    " 2>/dev/null; then
echo "Database is ready!"
        break
    fi

    TRIES=$((TRIES + 1))
    if [ $TRIES -eq $MAX_TRIES ]; then
        echo "Failed to connect to database after $MAX_TRIES attempts"
        exit 1
    fi

    echo "Waiting for database... (attempt $TRIES/$MAX_TRIES)"
    sleep 2
done

echo "Starting Node.js server..."
node /app/server/server.js &
NODE_PID=$!
echo "Node.js server started with PID: $NODE_PID"

# Wait for Node.js process
# This keeps the script running and allows trap to work
wait "$NODE_PID"

# If we get here, Node crashed without signal
echo "Node.js server exited unexpectedly"
exit 1