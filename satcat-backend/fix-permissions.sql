-- Fix PostgreSQL permissions for user 'major'

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO major;
GRANT CREATE ON SCHEMA public TO major;

-- Grant all privileges on database
GRANT ALL PRIVILEGES ON DATABASE satcat_db TO major;

-- Grant all on all tables (current and future)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO major;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO major;

-- Make 'major' owner of the database (best approach)
ALTER DATABASE satcat_db OWNER TO major;

-- Display confirmation
SELECT 'Permissions granted successfully!' AS status;
