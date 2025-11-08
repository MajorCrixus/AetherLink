-- Transfer ownership of all database objects to 'major' user

-- Transfer database ownership
ALTER DATABASE satcat_db OWNER TO major;

-- Transfer schema ownership
ALTER SCHEMA public OWNER TO major;

-- Transfer table ownership
ALTER TABLE IF EXISTS satellite OWNER TO major;
ALTER TABLE IF EXISTS tle OWNER TO major;
ALTER TABLE IF EXISTS transmitter OWNER TO major;
ALTER TABLE IF EXISTS satellite_tag OWNER TO major;
ALTER TABLE IF EXISTS ingest_state OWNER TO major;

-- Transfer sequence ownership (for SERIAL columns)
ALTER SEQUENCE IF EXISTS satellite_id_seq OWNER TO major;
ALTER SEQUENCE IF EXISTS tle_id_seq OWNER TO major;
ALTER SEQUENCE IF EXISTS transmitter_id_seq OWNER TO major;
ALTER SEQUENCE IF EXISTS satellite_tag_id_seq OWNER TO major;
ALTER SEQUENCE IF EXISTS ingest_state_id_seq OWNER TO major;

-- Transfer function ownership
ALTER FUNCTION IF EXISTS update_updated_at_column() OWNER TO major;

-- Grant all privileges
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO major;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO major;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO major;

-- Confirm
SELECT 'Ownership transferred successfully!' AS status;
