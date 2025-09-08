#!/bin/bash

echo "Checking database charset configuration..."

# Function to check if docker compose (v2) or docker-compose (v1) is available
get_compose_command() {
    if docker compose version &>/dev/null; then
        echo "docker compose"
    elif docker-compose version &>/dev/null; then
        echo "docker-compose"
    else
        echo "docker"
    fi
}

COMPOSE_CMD=$(get_compose_command)

# Check if database container is running
if [ "$COMPOSE_CMD" = "docker" ]; then
    if ! docker ps | grep -q "youtarr-db"; then
        echo "Error: youtarr-db container is not running"
        exit 1
    fi
    DB_CONTAINER="youtarr-db"
else
    if ! $COMPOSE_CMD ps | grep -q "youtarr-db"; then
        echo "Error: youtarr-db container is not running"
        exit 1
    fi
    DB_CONTAINER="youtarr-db"
fi

echo "Checking database and table character sets..."

docker exec -i $DB_CONTAINER mysql -u root -p123qweasd youtarr <<EOF
SELECT 'DATABASE CHARSET:' as info, DEFAULT_CHARACTER_SET_NAME as charset, DEFAULT_COLLATION_NAME as collation
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'youtarr';

SELECT 'TABLE CHARSETS:' as info, '' as charset, '' as collation
UNION ALL
SELECT TABLE_NAME, TABLE_COLLATION, ''
FROM information_schema.tables
WHERE TABLE_SCHEMA = 'youtarr'
AND TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
EOF

echo ""
echo "✅ If all entries show 'utf8mb4_unicode_ci', your database is properly configured"
echo "⚠️  If you see 'utf8_' entries, run the migration to upgrade: ./scripts/db-migrate.sh"
