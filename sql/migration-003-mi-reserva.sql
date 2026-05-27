-- =====================================================================
-- MIGRATION 003: Customer self-service (Mi Reserva)
-- Functions for: lookup, cancel, modify reservations by code
-- =====================================================================

-- 1. Lookup reservation by code (public)
CREATE OR REPLACE FUNCTION get_reservation_by_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'success', true,
        'reservation', jsonb_build_object(
            'id', r.id,
            'code', r.reservation_code,
            'status', r.status,
            'payment_status', r.payment_status,
            'date', r.reservation_date,
            'time', r.reservation_time,
            'party_size', r.party_size,
            'type', r.reservation_type,
            'deposit_amount', r.deposit_amount,
            'is_consumable', r.is_consumable,
            'special_requests', r.special_requests,
            'salon_name', s.name,
            'salon_image', s.image_url,
            'customer_name', c.name,
            'customer_email', regexp_replace(c.email, '(^.).*(.)(@.*)', '\1***\2\3'),
            'created_at', r.created_at,
            'cancellation_reason', r.cancellation_reason
        )
    ) INTO v_result
    FROM reservations r
    JOIN salons s ON s.id = r.salon_id
    JOIN customers c ON c.id = r.customer_id
    WHERE r.reservation_code = upper(trim(p_code));

    IF v_result IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se encontro una reserva con ese codigo');
    END IF;

    RETURN v_result;
END;
$$;


-- 2. Customer self-cancel (validates 48h policy)
CREATE OR REPLACE FUNCTION customer_cancel_reservation(
    p_code TEXT,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_status reservation_status;
    v_date DATE;
    v_time TIME;
    v_customer_phone TEXT;
    v_hours_until FLOAT;
BEGIN
    SELECT r.id, r.status, r.reservation_date, r.reservation_time, c.phone
    INTO v_id, v_status, v_date, v_time, v_customer_phone
    FROM reservations r
    JOIN customers c ON c.id = r.customer_id
    WHERE r.reservation_code = upper(trim(p_code));

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    -- Verify phone (last 4 digits)
    IF right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4) != right(v_customer_phone, 4) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Los ultimos 4 digitos del telefono no coinciden');
    END IF;

    IF v_status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta reserva no puede ser cancelada (estado: ' || v_status || ')');
    END IF;

    -- Check 48h policy
    v_hours_until := EXTRACT(EPOCH FROM (v_date + v_time - now())) / 3600;
    IF v_hours_until < 48 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se puede cancelar con menos de 48 horas de anticipacion. Contacta al restaurante por WhatsApp.');
    END IF;

    -- Cancel
    UPDATE reservations
    SET status = 'cancelled',
        cancellation_reason = 'Cancelada por el cliente',
        updated_at = now()
    WHERE id = v_id;

    UPDATE customers
    SET total_reservations = GREATEST(total_reservations - 1, 0),
        updated_at = now()
    WHERE phone = v_customer_phone;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_id, 'customer_cancelled', jsonb_build_object('method', 'self-service'));

    RETURN jsonb_build_object('success', true, 'message', 'Reserva cancelada exitosamente');
END;
$$;


-- 3. Customer modify reservation (change date/time)
CREATE OR REPLACE FUNCTION customer_modify_reservation(
    p_code TEXT,
    p_phone TEXT,
    p_new_date DATE,
    p_new_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
    v_status reservation_status;
    v_salon_id UUID;
    v_party_size INT;
    v_customer_phone TEXT;
    v_old_date DATE;
    v_old_time TIME;
    v_hours_until FLOAT;
    v_current_bookings BIGINT;
    v_max_sim INT;
    v_allows_shared BOOLEAN;
    v_salon_name TEXT;
    v_lock_key BIGINT;
BEGIN
    SELECT r.id, r.status, r.salon_id, r.party_size, c.phone,
           r.reservation_date, r.reservation_time
    INTO v_id, v_status, v_salon_id, v_party_size, v_customer_phone,
         v_old_date, v_old_time
    FROM reservations r
    JOIN customers c ON c.id = r.customer_id
    WHERE r.reservation_code = upper(trim(p_code));

    IF v_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    IF right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4) != right(v_customer_phone, 4) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Los ultimos 4 digitos del telefono no coinciden');
    END IF;

    IF v_status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta reserva no puede ser modificada');
    END IF;

    IF p_new_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'La nueva fecha debe ser hoy o posterior');
    END IF;

    -- Check 48h policy on original date
    v_hours_until := EXTRACT(EPOCH FROM (v_old_date + v_old_time - now())) / 3600;
    IF v_hours_until < 48 THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se puede modificar con menos de 48 horas de anticipacion');
    END IF;

    -- Advisory lock on new salon+date
    v_lock_key := abs(hashtext(v_salon_id::text || p_new_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Check availability at new slot
    SELECT s.name, s.max_simultaneous, s.allows_shared
    INTO v_salon_name, v_max_sim, v_allows_shared
    FROM salons s WHERE s.id = v_salon_id;

    SELECT COUNT(*) INTO v_current_bookings
    FROM reservations r
    WHERE r.salon_id = v_salon_id
    AND r.reservation_date = p_new_date
    AND r.reservation_time BETWEEN p_new_time - INTERVAL '2 hours' AND p_new_time + INTERVAL '2 hours'
    AND r.status IN ('pending', 'confirmed', 'seated')
    AND r.id != v_id;

    IF v_current_bookings >= v_max_sim THEN
        RETURN jsonb_build_object('success', false, 'error', 'No hay disponibilidad en ' || v_salon_name || ' para la nueva fecha y hora');
    END IF;

    IF NOT v_allows_shared AND v_current_bookings > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', v_salon_name || ' ya tiene una reserva en ese horario');
    END IF;

    -- Update reservation
    UPDATE reservations
    SET reservation_date = p_new_date,
        reservation_time = p_new_time,
        updated_at = now()
    WHERE id = v_id;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_id, 'customer_modified', jsonb_build_object(
        'old_date', v_old_date, 'old_time', v_old_time,
        'new_date', p_new_date, 'new_time', p_new_time
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Reserva actualizada exitosamente');
END;
$$;
