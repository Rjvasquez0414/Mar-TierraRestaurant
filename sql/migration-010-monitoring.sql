-- =====================================================================
-- MIGRATION 010 — Módulo de monitoreo (quién hace qué) + nombres de staff
-- =====================================================================
-- - staff_roles gana columna `name` para mostrar el nombre del host.
-- - reservation_logs.reservation_id pasa a NULLABLE para poder registrar
--   acciones que no son sobre una reserva (ej. bloquear/desbloquear fechas).
-- - get_activity_log(): registro de actividad (acción + host + reserva) para
--   el panel de Monitoreo. Solo staff puede ejecutarla.
-- - get_staff(): lista de hosts para el filtro del panel.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================

-- 1. Nombre del host en staff_roles
ALTER TABLE staff_roles ADD COLUMN IF NOT EXISTS name TEXT;
-- El admin existente queda con un nombre por defecto (renómbralo si quieres)
UPDATE staff_roles SET name = 'Administrador' WHERE name IS NULL;

-- 2. Permitir logs no ligados a una reserva (bloqueos, etc.)
ALTER TABLE reservation_logs ALTER COLUMN reservation_id DROP NOT NULL;

-- 3. Registro de actividad para el panel de Monitoreo
CREATE OR REPLACE FUNCTION get_activity_log(
    p_limit INT DEFAULT 200,
    p_performed_by UUID DEFAULT NULL,
    p_from DATE DEFAULT NULL,
    p_to DATE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    action TEXT,
    details JSONB,
    performed_by UUID,
    staff_name TEXT,
    staff_email TEXT,
    reservation_code TEXT,
    customer_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Solo personal autorizado puede ver el monitoreo
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    RETURN QUERY
    SELECT
        rl.id,
        rl.created_at,
        rl.action,
        rl.details,
        rl.performed_by,
        sr.name AS staff_name,
        u.email::TEXT AS staff_email,
        r.reservation_code,
        c.name AS customer_name
    FROM reservation_logs rl
    LEFT JOIN staff_roles sr ON sr.user_id = rl.performed_by
    LEFT JOIN auth.users u ON u.id = rl.performed_by
    LEFT JOIN reservations r ON r.id = rl.reservation_id
    LEFT JOIN customers c ON c.id = r.customer_id
    WHERE (p_performed_by IS NULL OR rl.performed_by = p_performed_by)
      AND (p_from IS NULL OR rl.created_at >= (p_from::timestamp AT TIME ZONE 'America/Bogota'))
      AND (p_to   IS NULL OR rl.created_at <  ((p_to + 1)::timestamp AT TIME ZONE 'America/Bogota'))
    ORDER BY rl.created_at DESC
    LIMIT GREATEST(p_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION get_activity_log(INT, UUID, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_activity_log(INT, UUID, DATE, DATE) TO authenticated;

-- 4. Lista de hosts (para el filtro)
CREATE OR REPLACE FUNCTION get_staff()
RETURNS TABLE (user_id UUID, name TEXT, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid()) THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    RETURN QUERY
    SELECT sr.user_id,
           COALESCE(sr.name, split_part(u.email, '@', 1))::TEXT AS name,
           u.email::TEXT AS email
    FROM staff_roles sr
    LEFT JOIN auth.users u ON u.id = sr.user_id
    ORDER BY 2;
END;
$$;

REVOKE ALL ON FUNCTION get_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_staff() TO authenticated;
