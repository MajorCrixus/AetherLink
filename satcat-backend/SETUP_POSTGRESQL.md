# PostgreSQL Setup for AetherLink (Raspberry Pi / ARM64)

## Step 1: Verify PostgreSQL Installation

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# If not running, start it
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Step 2: Create Database and User

Run these commands:

```bash
# Switch to postgres user and create database
sudo -u postgres psql <<EOF
-- Create database
CREATE DATABASE satcat_db;

-- Create user with password
CREATE USER satcat_user WITH PASSWORD 'satcat_secure_password_123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE satcat_db TO satcat_user;

-- Connect to satcat_db and grant schema permissions
\c satcat_db
GRANT ALL ON SCHEMA public TO satcat_user;
GRANT CREATE ON SCHEMA public TO satcat_user;

-- Exit
\q
EOF
```

##Step 3: Configure .env File

Create `/home/major/aetherlink/satcat-backend/.env`:

```bash
cd /home/major/aetherlink/satcat-backend
cp .env.example .env
nano .env
```

Add these settings:

```env
# PostgreSQL connection string
POSTGRES_URL=postgresql://satcat_user:satcat_secure_password_123@localhost:5432/satcat_db

# Space-Track credentials (register at https://www.space-track.org/auth/createAccount)
SPACETRACK_USERNAME=your_email@example.com
SPACETRACK_PASSWORD=your_password_here

# Server settings
SATCAT_HOST=0.0.0.0
SATCAT_PORT=9001
NODE_ENV=development

# Rate limiting
SPACETRACK_MIN_INTERVAL_MS=1200
INGEST_DAYS_BACK=7
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 4: Test Database Connection

```bash
# Test connection with psql
psql "postgresql://satcat_user:satcat_secure_password_123@localhost:5432/satcat_db" -c "SELECT version();"
```

You should see PostgreSQL version information.

## Step 5: Initialize Database Schema

```bash
cd /home/major/aetherlink/satcat-backend

# Option A: Use the init script
./init-db.sh

# Option B: Manual initialization
source .env
psql "$POSTGRES_URL" -f src/db/schema.sql
```

You should see output like:
```
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
...
```

## Step 6: Test with Node.js

Create a simple test script:

```bash
cd /home/major/aetherlink/satcat-backend
cat > test-db.js <<'EOF'
import { pool } from './src/db/pg-client.ts';

async function test() {
  try {
    const result = await pool.query('SELECT COUNT(*) FROM satellite');
    console.log('✓ Database connection successful!');
    console.log(`  Satellites in database: ${result.rows[0].count}`);
    await pool.end();
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    process.exit(1);
  }
}

test();
EOF

# Run test
npx tsx test-db.js
```

## Troubleshooting

### Error: "peer authentication failed"

Edit `/etc/postgresql/16/main/pg_hba.conf` (version number may vary):

```bash
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Find this line:
```
local   all             all                                     peer
```

Change to:
```
local   all             all                                     md5
```

Then restart PostgreSQL:
```bash
sudo systemctl restart postgresql
```

### Error: "database does not exist"

Create the database manually:
```bash
sudo -u postgres createdb satcat_db
```

### Error: "role does not exist"

Create the user manually:
```bash
sudo -u postgres psql -c "CREATE USER satcat_user WITH PASSWORD 'satcat_secure_password_123';"
```

### Check PostgreSQL is listening

```bash
sudo netstat -tulnp | grep 5432
```

You should see PostgreSQL listening on port 5432.

## Security Note

Change the default password `satcat_secure_password_123` to something more secure:

```sql
sudo -u postgres psql satcat_db
ALTER USER satcat_user WITH PASSWORD 'your_new_secure_password';
\q
```

Then update your `.env` file with the new password.
