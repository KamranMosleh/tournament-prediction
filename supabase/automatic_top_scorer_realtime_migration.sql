-- Run once in the Supabase SQL Editor for existing installations.
-- Fresh installations receive this publication entry from schema.sql.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE leagues;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
