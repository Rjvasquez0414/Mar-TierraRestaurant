-- =====================================================================
-- MIGRATION 017 — Módulo Calendario (eventos del restaurante)
-- =====================================================================
-- Catas, maridajes, noches temáticas. Solo informativo: la reserva de
-- cupo se hace por WhatsApp, así que no toca el núcleo transaccional
-- de `reservations` ni el aforo.
--
-- Patrón seguido:
--   · RLS por staff_roles, igual que migration-001
--   · Lectura pública SOLO vía RPC SECURITY DEFINER (anon no toca la tabla)
--   · CRUD de admin directo sobre la tabla bajo RLS de staff — a diferencia
--     de reservations no hay concurrencia que proteger (dos admins editando
--     la misma cata no es un escenario real), así que envolverlo en RPCs
--     admin_* sería ceremonia sin beneficio.
-- =====================================================================

-- 1. TABLA ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug         TEXT NOT NULL UNIQUE,
    title        TEXT NOT NULL,
    subtitle     TEXT,
    description  TEXT,

    starts_at    TIMESTAMPTZ NOT NULL,
    ends_at      TIMESTAMPTZ,

    salon_id     UUID REFERENCES salons(id) ON DELETE SET NULL,

    price_cop    INT,
    -- capacity/seats_taken los lleva el staff a mano: como la reserva es
    -- por WhatsApp, no hay forma automática de conocer el cupo real.
    capacity     INT,
    seats_taken  INT NOT NULL DEFAULT 0,

    image_url    TEXT,
    status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'archived')),
    highlight    BOOLEAN NOT NULL DEFAULT false,

    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT events_seats_no_negativos  CHECK (seats_taken >= 0),
    CONSTRAINT events_seats_no_exceden    CHECK (capacity IS NULL OR seats_taken <= capacity),
    CONSTRAINT events_fin_despues_inicio  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE  events IS 'Eventos del restaurante (catas, maridajes). Informativo: la reserva de cupo se gestiona por WhatsApp.';
COMMENT ON COLUMN events.seats_taken IS 'Cupos vendidos, actualizado a mano por el staff desde el panel.';
COMMENT ON COLUMN events.highlight   IS 'Marca el evento que se muestra como pieza destacada en el sitio.';

-- Índice de la consulta caliente: próximos publicados ordenados por fecha
CREATE INDEX IF NOT EXISTS idx_events_publicos
    ON events (starts_at) WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_events_slug ON events (slug);

DROP TRIGGER IF EXISTS trg_events_updated ON events;
CREATE TRIGGER trg_events_updated
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 2. RLS --------------------------------------------------------------

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Sin política para anon: el público entra solo por get_upcoming_events().
DROP POLICY IF EXISTS "events_staff_only" ON events;
CREATE POLICY "events_staff_only" ON events
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );


-- 3. RPC PÚBLICO ------------------------------------------------------

CREATE OR REPLACE FUNCTION get_upcoming_events(p_limit INT DEFAULT 12)
RETURNS TABLE (
    id            UUID,
    slug          TEXT,
    title         TEXT,
    subtitle      TEXT,
    description   TEXT,
    starts_at     TIMESTAMPTZ,
    ends_at       TIMESTAMPTZ,
    salon_name    TEXT,
    price_cop     INT,
    capacity      INT,
    seats_taken   INT,
    seats_left    INT,
    sold_out      BOOLEAN,
    image_url     TEXT,
    highlight     BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        e.id,
        e.slug,
        e.title,
        e.subtitle,
        e.description,
        e.starts_at,
        e.ends_at,
        s.name AS salon_name,
        e.price_cop,
        e.capacity,
        e.seats_taken,
        -- NULL cuando el evento no maneja cupo limitado
        CASE WHEN e.capacity IS NULL THEN NULL
             ELSE GREATEST(e.capacity - e.seats_taken, 0) END AS seats_left,
        CASE WHEN e.capacity IS NULL THEN false
             ELSE e.seats_taken >= e.capacity END AS sold_out,
        e.image_url,
        e.highlight
    FROM events e
    LEFT JOIN salons s ON s.id = e.salon_id
    WHERE e.status = 'published'
      -- Un evento sigue vigente hasta que termina; si no tiene hora de
      -- fin, hasta el final de su día en hora de Bogotá.
      AND COALESCE(
            e.ends_at,
            ((e.starts_at AT TIME ZONE 'America/Bogota')::date + 1)::timestamp
                AT TIME ZONE 'America/Bogota'
          ) > now()
    ORDER BY e.highlight DESC, e.starts_at ASC
    LIMIT GREATEST(p_limit, 1);
$$;

REVOKE ALL ON FUNCTION get_upcoming_events(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_upcoming_events(INT) TO anon, authenticated;

COMMENT ON FUNCTION get_upcoming_events(INT) IS 'Eventos publicados aún vigentes. Único acceso del rol anon a la tabla events.';
