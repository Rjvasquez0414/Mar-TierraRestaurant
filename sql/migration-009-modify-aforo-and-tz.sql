-- =====================================================================
-- MIGRATION 009 — Reagendamiento con AFORO + corrección de zona horaria
-- =====================================================================
-- Hallazgos del análisis de producción (2026-05-28):
--
-- 1) customer_modify_reservation (migration-003) quedó con la lógica VIEJA
--    por CONTEO de reservas (max_simultaneous), igual que la create_reservation
--    que migration-007 corrigió. Un cliente podía REAGENDAR a un turno ya
--    lleno por aforo y SOBREVENDER el salón, o moverse a un slot bloqueado.
--    => Se reescribe con aforo por personas (±2h), excluyendo la propia
--       reserva, + re-chequeo de blocked_slots.
--
-- 2) La regla de 48h (cancelar y modificar) calculaba
--       (fecha + hora) - now()
--    mezclando un timestamp SIN zona con now() (timestamptz). El servidor
--    corre en UTC y el restaurante está en Colombia (UTC-5) => desfase de 5h
--    que podía rechazar/permitir cancelaciones y modificaciones cerca del
--    límite. Se ancla con AT TIME ZONE 'America/Bogota'. Igual para
--    "fecha >= hoy" (CURRENT_DATE en UTC adelantaba el día por la noche).
--
-- 3) Consistente con la cancelación: la penalidad de 48h aplica solo a
--    reservas CONFIRMADAS (pagadas). Pendientes sin pago se modifican libres.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================


-- 1. customer_cancel_reservation — corregir zona horaria en la regla de 48h
-- ---------------------------------------------------------------------
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

    IF right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4) != right(v_customer_phone, 4) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Los ultimos 4 digitos del telefono no coinciden');
    END IF;

    IF v_status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta reserva no puede ser cancelada (estado: ' || v_status || ')');
    END IF;

    -- 48h + no reembolsable: SOLO para confirmadas (pagadas). TZ Colombia.
    IF v_status = 'confirmed' THEN
        v_hours_until := EXTRACT(EPOCH FROM ((v_date + v_time) AT TIME ZONE 'America/Bogota' - now())) / 3600;
        IF v_hours_until < 48 THEN
            RETURN jsonb_build_object('success', false, 'error', 'No se puede cancelar con menos de 48 horas de anticipacion. Contacta al restaurante por WhatsApp.');
        END IF;
    END IF;

    UPDATE reservations
    SET status = 'cancelled',
        cancellation_reason = CASE WHEN v_status = 'pending'
            THEN 'Cancelada por el cliente (sin pago)'
            ELSE 'Cancelada por el cliente' END,
        updated_at = now()
    WHERE id = v_id;

    UPDATE customers
    SET total_reservations = GREATEST(total_reservations - 1, 0),
        updated_at = now()
    WHERE phone = v_customer_phone;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_id, 'customer_cancelled', jsonb_build_object('method', 'self-service', 'was_status', v_status::TEXT));

    RETURN jsonb_build_object('success', true, 'message', 'Reserva cancelada exitosamente');
END;
$$;


-- 2. customer_modify_reservation — AFORO por personas + blocked_slots + TZ
-- ---------------------------------------------------------------------
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
    v_capacity INT;
    v_salon_active BOOLEAN;
    v_salon_name TEXT;
    v_seats_taken BIGINT;
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

    -- Máx 2 modificaciones por reserva
    IF (SELECT COUNT(*) FROM reservation_logs
        WHERE reservation_id = v_id AND action = 'customer_modified') >= 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Has alcanzado el limite de 2 modificaciones. Contacta al restaurante por WhatsApp para mas cambios.');
    END IF;

    -- "Hoy o posterior" en hora de Colombia
    IF p_new_date < (now() AT TIME ZONE 'America/Bogota')::date THEN
        RETURN jsonb_build_object('success', false, 'error', 'La nueva fecha debe ser hoy o posterior');
    END IF;

    -- 48h sobre la fecha ORIGINAL: solo confirmadas (pagadas). TZ Colombia.
    IF v_status = 'confirmed' THEN
        v_hours_until := EXTRACT(EPOCH FROM ((v_old_date + v_old_time) AT TIME ZONE 'America/Bogota' - now())) / 3600;
        IF v_hours_until < 48 THEN
            RETURN jsonb_build_object('success', false, 'error', 'No se puede modificar con menos de 48 horas de anticipacion');
        END IF;
    END IF;

    -- Lock por salón + nueva fecha (serializa con creaciones/otros cambios)
    v_lock_key := abs(hashtext(v_salon_id::text || p_new_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT s.name, s.is_active, s.capacity
    INTO v_salon_name, v_salon_active, v_capacity
    FROM salons s WHERE s.id = v_salon_id;

    IF NOT v_salon_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este salon no esta disponible actualmente');
    END IF;

    -- Bloqueos (mantenimiento / evento privado) en el nuevo slot
    IF EXISTS (
        SELECT 1 FROM blocked_slots bs
        WHERE (bs.salon_id = v_salon_id OR bs.salon_id IS NULL)
          AND bs.blocked_date = p_new_date
          AND (bs.is_full_day OR (p_new_time >= bs.start_time AND p_new_time < bs.end_time))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', v_salon_name || ' esta bloqueado para esa fecha.');
    END IF;

    -- AFORO por personas en el nuevo turno (±2h), EXCLUYENDO esta reserva
    SELECT COALESCE(SUM(r.party_size), 0) INTO v_seats_taken
    FROM reservations r
    WHERE r.salon_id = v_salon_id
      AND r.reservation_date = p_new_date
      AND r.reservation_time BETWEEN p_new_time - INTERVAL '2 hours' AND p_new_time + INTERVAL '2 hours'
      AND r.id != v_id
      AND (
          r.status IN ('confirmed', 'seated')
          OR (r.status = 'pending' AND (r.expires_at IS NULL OR r.expires_at > now()))
      );

    IF v_seats_taken + v_party_size > v_capacity THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Lo sentimos, ' || v_salon_name || ' no tiene cupo para la nueva fecha y hora. Cupos disponibles: '
            || GREATEST(v_capacity - v_seats_taken, 0) || '.');
    END IF;

    UPDATE reservations
    SET reservation_date = p_new_date,
        reservation_time = p_new_time,
        updated_at = now()
    WHERE id = v_id;

    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_id, 'customer_modified', jsonb_build_object(
        'old_date', v_old_date, 'old_time', v_old_time,
        'new_date', p_new_date, 'new_time', p_new_time,
        'seats_taken_before', v_seats_taken, 'capacity', v_capacity
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Reserva actualizada exitosamente');
END;
$$;
