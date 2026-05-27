-- =====================================================================
-- MIGRATION 004: Access logs for admin login tracking
-- =====================================================================

CREATE TABLE IF NOT EXISTS access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_access_logs_created ON access_logs(created_at DESC);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can INSERT (needed for logging failed attempts before auth)
CREATE POLICY "access_logs_insert_all" ON access_logs
    FOR INSERT WITH CHECK (true);

-- Only staff can READ logs
CREATE POLICY "access_logs_read_staff" ON access_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );
