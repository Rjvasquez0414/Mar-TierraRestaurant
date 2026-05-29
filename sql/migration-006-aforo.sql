-- =====================================================================
-- MIGRATION 006 — Sistema de AFORO por personas + expiración de pendientes
-- =====================================================================
-- Problema que resuelve:
--   El sistema anterior bloqueaba salones por NÚMERO DE RESERVAS
--   (max_simultaneous), nunca por aforo de personas. Un salón podía
--   sobrevenderse (5 reservas de 10 personas = 50) o bloquearse de más.
--
-- Solución:
--   La disponibilidad pasa a medirse por PERSONAS, sumando party_size de
--   las reservas que ocupan el mismo TURNO (ventana de ±2 horas), contra
--   el aforo (capacity) del salón.
--
--   Cupo "duro"  = reservas confirmed/seated (ya pagaron) → no se liberan.
--   Cupo "blando" = reservas pending (sin pago) → retienen cupo pero
--                   EXPIRAN a las 24h si no se confirma el pago.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================


-- 1. CAPACIDADES CORRECTAS (fuente de verdad del aforo)
-- ---------------------------------------------------------------------
UPDATE salons SET capacity = 54 WHERE slug = 'arca';    -- antes 60
UPDATE salons SET capacity = 44 WHERE slug = 'golden';  -- antes 25
-- Chill Out deja de ser exclusivo: ahora se llena por personas (aforo 8)
UPDATE salons SET allows_shared = true WHERE slug = 'chill-out';
-- (Moon Terraza 30, Barco 16, Chill Out 8 ya estaban correctos)


-- 2. EXPIRACIÓN DE PENDIENTES SIN PAGO
-- ---------------------------------------------------------------------
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill: las pendientes existentes expiran 24h después de su creación
UPDATE reservations
SET expires_at = created_at + INTERVAL '24 hours'
WHERE status = 'pending' AND expires_at IS NULL;

-- Índice para barrer pendientes vencidas rápido
CREATE INDEX IF NOT EXISTS idx_reservations_expires
    ON reservations(expires_at) WHERE status = 'pending';


-- 3. get_available_salons → AFORO POR PERSONAS (turno ±2h)
-- ---------------------------------------------------------------------
-- Cambia el RETURNS TABLE (quita current_bookings, añade seats_taken /
-- seats_available), por eso hay que DROP + CREATE. Postgres re-otorga
-- EXECUTE a PUBLIC por defecto, así que el rol anon sigue pudiendo llamarla.
DROP FUNCTION IF EXISTS get_available_salons(DATE, TIME, INT);

CREATE FUNCTION get_available_salons(
    p_date DATE,
    p_time TIME,
    p_party_size INT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    capacity INT,
    description TEXT,
    image_url TEXT,
    seats_taken BIGINT,
    seats_available INT,
    is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.slug,
        s.capacity,
        s.description,
        s.image_url,
        COALESCE(taken.seats, 0) AS seats_taken,
        GREATEST(s.capacity - COALESCE(taken.seats, 0), 0)::INT AS seats_available,
        (
            s.is_active
            -- No bloqueado (mantenimiento / evento privado)
            AND NOT EXISTS (
                SELECT 1 FROM blocked_slots bs
                WHERE (bs.salon_id = s.id OR bs.salon_id IS NULL)
                  AND bs.blocked_date = p_date
                  AND (bs.is_full_day OR (p_time >= bs.start_time AND p_time < bs.end_time))
            )
            -- Cabe el grupo nuevo dentro del aforo restante del turno
            AND COALESCE(taken.seats, 0) + p_party_size <= s.capacity
        ) AS is_available
    FROM salons s
    LEFT JOIN (
        SELECT r.salon_id, SUM(r.party_size) AS seats
        FROM reservations r
        WHERE r.reservation_date = p_date
          AND r.reservation_time BETWEEN p_time - INTERVAL '2 hours' AND p_time + INTERVAL '2 hours'
          AND (
              r.status IN ('confirmed', 'seated')                                   -- cupo duro
              OR (r.status = 'pending' AND (r.expires_at IS NULL OR r.expires_at > now()))  -- cupo blando vigente
          )
        GROUP BY r.salon_id
    ) taken ON taken.salon_id = s.id
    WHERE s.is_active = true
    ORDER BY s.display_order;
END;
$$;


-- 4. create_reservation → enforcement por AFORO (conserva el advisory lock)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_reservation(
    p_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_salon_id UUID,
    p_type reservation_type,
    p_date DATE,
    p_time TIME,
    p_party_size INT,
    p_requests TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
    v_customer_id UUID;
    v_reservation_id UUID;
    v_code TEXT;
    v_deposit INT;
    v_consumable BOOLEAN;
    v_salon_name TEXT;
    v_salon_active BOOLEAN;
    v_capacity INT;
    v_seats_taken BIGINT;
    v_lock_key BIGINT;
BEGIN
    IF p_party_size < 1 OR p_party_size > 14 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El numero de personas debe ser entre 1 y 14');
    END IF;
    IF p_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'La fecha debe ser hoy o posterior');
    END IF;
    IF length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El telefono debe tener al menos 10 digitos');
    END IF;

    -- Advisory lock por salon+fecha: serializa reservas concurrentes del
    -- mismo salón/día (evita doble-booking en días pico como Día de la Madre)
    v_lock_key := abs(hashtext(p_salon_id::text || p_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT s.name, s.is_active, s.capacity
    INTO v_salon_name, v_salon_active, v_capacity
    FROM salons s WHERE s.id = p_salon_id;

    IF v_salon_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salon no encontrado');
    END IF;
    IF NOT v_salon_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este salon no esta disponible actualmente');
    END IF;
    IF p_party_size > v_capacity THEN
        RETURN jsonb_build_object('success', false, 'error',
            v_salon_name || ' tiene un aforo de ' || v_capacity || ' personas.');
    END IF;

    -- Aforo ocupado en el turno (±2h): suma de personas con cupo vigente
    SELECT COALESCE(SUM(r.party_size), 0) INTO v_seats_taken
    FROM reservations r
    WHERE r.salon_id = p_salon_id
      AND r.reservation_date = p_date
      AND r.reservation_time BETWEEN p_time - INTERVAL '2 hours' AND p_time + INTERVAL '2 hours'
      AND (
          r.status IN ('confirmed', 'seated')
          OR (r.status = 'pending' AND (r.expires_at IS NULL OR r.expires_at > now()))
      );

    IF v_seats_taken + p_party_size > v_capacity THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Lo sentimos, ' || v_salon_name || ' ya no tiene cupo para esa fecha y hora. Cupos disponibles: '
            || GREATEST(v_capacity - v_seats_taken, 0) || '.');
    END IF;

    -- Bloqueos (mantenimiento / eventos privados)
    IF EXISTS (
        SELECT 1 FROM blocked_slots bs
        WHERE (bs.salon_id = p_salon_id OR bs.salon_id IS NULL)
          AND bs.blocked_date = p_date
          AND (bs.is_full_day OR (p_time >= bs.start_time AND p_time < bs.end_time))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error',
            v_salon_name || ' esta bloqueado para esa fecha.');
    END IF;

    -- Precio vigente
    SELECT deposit_amount, is_consumable INTO v_deposit, v_consumable
    FROM pricing
    WHERE reservation_type = p_type AND effective_to IS NULL
    ORDER BY effective_from DESC LIMIT 1;

    IF v_deposit IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de reserva no encontrado');
    END IF;

    -- Upsert cliente
    INSERT INTO customers (phone, name, email, total_reservations)
    VALUES (regexp_replace(p_phone, '[^0-9]', '', 'g'), p_name, p_email, 1)
    ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, customers.email),
        total_reservations = customers.total_reservations + 1,
        updated_at = now()
    RETURNING id INTO v_customer_id;

    v_code := generate_reservation_code();

    -- La reserva nace 'pending' y retiene cupo 24h (expira si no se paga)
    INSERT INTO reservations (
        reservation_code, customer_id, salon_id, reservation_type,
        reservation_date, reservation_time, party_size,
        deposit_amount, is_consumable, special_requests, expires_at
    ) VALUES (
        v_code, v_customer_id, p_salon_id, p_type,
        p_date, p_time, p_party_size,
        v_deposit, v_consumable, p_requests, now() + INTERVAL '24 hours'
    ) RETURNING id INTO v_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_reservation_id, 'created', jsonb_build_object(
        'type', p_type::TEXT, 'salon', v_salon_name,
        'date', p_date::TEXT, 'time', p_time::TEXT,
        'party_size', p_party_size, 'deposit', v_deposit,
        'seats_taken_before', v_seats_taken, 'capacity', v_capacity
    ));

    RETURN jsonb_build_object(
        'success', true,
        'reservation_id', v_reservation_id,
        'reservation_code', v_code,
        'deposit_amount', v_deposit,
        'is_consumable', v_consumable,
        'salon_name', v_salon_name
    );

EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'Error al generar la reserva. Intenta de nuevo.');
WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'Error interno. Intenta de nuevo.');
END;
$$;


-- 5. expire_stale_reservations() → vence pendientes sin pago (>24h)
-- ---------------------------------------------------------------------
-- La disponibilidad ya IGNORA las pendientes vencidas (cálculo "lazy"),
-- pero esta función las pasa a 'cancelled' para dejar el panel limpio.
-- El admin la llama al abrir el panel; opcionalmente se agenda con pg_cron.
CREATE OR REPLACE FUNCTION expire_stale_reservations()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INT;
BEGIN
    WITH expired AS (
        UPDATE reservations
        SET status = 'cancelled',
            payment_status = 'rejected',
            cancellation_reason = 'Expiracion automatica: sin pago tras 24h'
        WHERE status = 'pending'
          AND expires_at IS NOT NULL
          AND expires_at <= now()
        RETURNING id
    ),
    logged AS (
        INSERT INTO reservation_logs (reservation_id, action, details)
        SELECT id, 'expired', jsonb_build_object('reason', 'auto-24h-sin-pago') FROM expired
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM expired;
    RETURN v_count;
END;
$$;

-- Solo el panel admin (rol authenticated) la ejecuta
REVOKE ALL ON FUNCTION expire_stale_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_stale_reservations() TO authenticated;

-- (Opcional) Agendar con pg_cron para que corra sola cada 30 min:
--   SELECT cron.schedule('expire-stale-reservations', '*/30 * * * *',
--                        'SELECT expire_stale_reservations()');


-- 6. VERIFICACIÓN
-- ---------------------------------------------------------------------
-- Aforos correctos:
SELECT name, slug, capacity, allows_shared FROM salons ORDER BY display_order;

-- Prueba de disponibilidad por personas (ajusta fecha):
-- SELECT name, capacity, seats_taken, seats_available, is_available
-- FROM get_available_salons('2026-05-31', '12:30', 4);
