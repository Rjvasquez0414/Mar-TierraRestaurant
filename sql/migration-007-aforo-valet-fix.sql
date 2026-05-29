-- =====================================================================
-- MIGRATION 007 — Consolidar create_reservation (aforo + valet)
-- =====================================================================
-- Contexto / bug encontrado en QA:
--   Existían DOS funciones create_reservation:
--     (a) 9 params  — la original (migration-002), que migration-006
--                     actualizó a lógica de AFORO.
--     (b) 11 params — añadida con el feature de valet parking
--                     directamente en Supabase (nunca quedó en el repo).
--                     Conservaba la lógica VIEJA por CONTEO de reservas.
--
--   El wizard llama la versión (b) con p_has_valet/p_valet_vehicles, así
--   que el control de aforo de migration-006 NO se estaba aplicando a las
--   reservas reales. Además, tener ambas firmas provoca ambigüedad
--   (PostgREST PGRST203) para llamadas de 9 params.
--
-- Solución:
--   1. Eliminar la versión de 9 params (ya nadie la usa).
--   2. Reescribir la versión de 11 params (valet) con lógica de AFORO
--      por personas (turno ±2h) + advisory lock + expires_at 24h.
--
-- Esta función queda como la ÚNICA y canónica (documentada en el repo).
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================


-- 1. Eliminar la versión de 9 parámetros (legacy, ya no se llama)
DROP FUNCTION IF EXISTS create_reservation(
    TEXT, TEXT, TEXT, UUID, reservation_type, DATE, TIME, INT, TEXT
);


-- 2. Versión canónica: 11 params (con valet) + AFORO por personas
CREATE OR REPLACE FUNCTION create_reservation(
    p_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_salon_id UUID,
    p_type reservation_type,
    p_date DATE,
    p_time TIME,
    p_party_size INT,
    p_requests TEXT DEFAULT NULL,
    p_has_valet BOOLEAN DEFAULT false,
    p_valet_vehicles INT DEFAULT 0
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
    -- mismo salón/día (evita doble-booking en días pico)
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
        deposit_amount, is_consumable, special_requests,
        has_valet, valet_vehicles, expires_at
    ) VALUES (
        v_code, v_customer_id, p_salon_id, p_type,
        p_date, p_time, p_party_size,
        v_deposit, v_consumable, p_requests,
        p_has_valet, p_valet_vehicles, now() + INTERVAL '24 hours'
    ) RETURNING id INTO v_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_reservation_id, 'created', jsonb_build_object(
        'type', p_type::TEXT, 'salon', v_salon_name,
        'date', p_date::TEXT, 'time', p_time::TEXT,
        'party_size', p_party_size, 'deposit', v_deposit,
        'has_valet', p_has_valet, 'valet_vehicles', p_valet_vehicles,
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
