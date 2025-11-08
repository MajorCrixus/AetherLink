#!/bin/bash
#
# Initialize Database for AetherLink Satellite Catalog Backend
#

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if POSTGRES_URL is set
if [ -z "$POSTGRES_URL" ]; then
    echo "Error: POSTGRES_URL not set in .env file"
    exit 1
fi

# Extract database connection details from POSTGRES_URL
# Format: postgresql://user:password@host:port/database
DB_URL=$POSTGRES_URL

echo "=========================================="
echo "AetherLink Database Initialization"
echo "=========================================="
echo ""

# Run the schema SQL file
echo "Creating database schema..."
psql "$DB_URL" -f src/db/schema.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "Database initialized successfully!"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "  1. npm run ingest -- --limit 100"
    echo "  2. npm run dev"
else
    echo ""
    echo "Error: Database initialization failed"
    exit 1
fi
