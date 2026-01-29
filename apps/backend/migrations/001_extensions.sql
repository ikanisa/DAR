-- 001_extensions.sql
-- Enable required PostgreSQL extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Optional: PostGIS for advanced geo queries
-- Uncomment if needed:
-- CREATE EXTENSION IF NOT EXISTS "postgis";
