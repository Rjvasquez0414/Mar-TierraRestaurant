-- =====================================================================
-- MIGRATION 002: Advisory lock for create_reservation
-- Fixes: race condition where two concurrent requests can double-book
-- Uses pg_advisory_xact_lock(hash(salon+date)) to serialize bookings
-- =====================================================================

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
    v_current_bookings BIGINT;
    v_max_simultaneous INT;
    v_allows_shared BOOLEAN;
    v_capacity INT;
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

    -- Advisory lock: unique key per salon+date combination
    -- Serializes ALL reservations for the same salon on the same date
    v_lock_key := abs(hashtext(p_salon_id::text || p_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Now safe: only one transaction at a time per salon+date
    SELECT s.name, s.is_active, s.max_simultaneous, s.allows_shared, s.capacity
    INTO v_salon_name, v_salon_active, v_max_simultaneous, v_allows_shared, v_capacity
    FROM salons s WHERE s.id = p_salon_id;

    IF v_salon_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salon no encontrado');
    END IF;
    IF NOT v_salon_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este salon no esta disponible actualmente');
    END IF;
    IF p_party_size > v_capacity THEN
        RETURN jsonb_build_object('success', false, 'error', 'El salon no tiene capacidad para ' || p_party_size || ' personas');
    END IF;

    SELECT COUNT(*) INTO v_current_bookings
    FROM reservations r
    WHERE r.salon_id = p_salon_id
    AND r.reservation_date = p_date
    AND r.reservation_time BETWEEN p_time - INTERVAL '2 hours' AND p_time + INTERVAL '2 hours'
    AND r.status IN ('pending', 'confirmed', 'seated');

    IF v_current_bookings >= v_max_simultaneous THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Lo sentimos, ' || v_salon_name || ' no tiene disponibilidad para esa fecha y hora.');
    END IF;
    IF NOT v_allows_shared AND v_current_bookings > 0 THEN
        RETURN jsonb_build_object('success', false, 'error',
            v_salon_name || ' es un espacio exclusivo y ya tiene una reserva en ese horario.');
    END IF;

    -- Check blocked slots
    IF EXISTS (
        SELECT 1 FROM blocked_slots bs
        WHERE (bs.salon_id = p_salon_id OR bs.salon_id IS NULL)
        AND bs.blocked_date = p_date
        AND (bs.is_full_day OR (p_time >= bs.start_time AND p_time < bs.end_time))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error',
            v_salon_name || ' esta bloqueado para esa fecha.');
    END IF;

    -- Get pricing
    SELECT deposit_amount, is_consumable INTO v_deposit, v_consumable
    FROM pricing
    WHERE reservation_type = p_type AND effective_to IS NULL
    ORDER BY effective_from DESC LIMIT 1;

    IF v_deposit IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de reserva no encontrado');
    END IF;

    -- Upsert customer
    INSERT INTO customers (phone, name, email, total_reservations)
    VALUES (regexp_replace(p_phone, '[^0-9]', '', 'g'), p_name, p_email, 1)
    ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, customers.email),
        total_reservations = customers.total_reservations + 1,
        updated_at = now()
    RETURNING id INTO v_customer_id;

    v_code := generate_reservation_code();

    INSERT INTO reservations (
        reservation_code, customer_id, salon_id, reservation_type,
        reservation_date, reservation_time, party_size,
        deposit_amount, is_consumable, special_requests
    ) VALUES (
        v_code, v_customer_id, p_salon_id, p_type,
        p_date, p_time, p_party_size,
        v_deposit, v_consumable, p_requests
    ) RETURNING id INTO v_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_reservation_id, 'created', jsonb_build_object(
        'type', p_type::TEXT, 'salon', v_salon_name,
        'date', p_date::TEXT, 'time', p_time::TEXT,
        'party_size', p_party_size, 'deposit', v_deposit
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
