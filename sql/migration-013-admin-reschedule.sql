-- =====================================================================
-- MIGRATION 013 — El admin puede cambiar fecha/hora de una reserva
-- =====================================================================
-- RPC para que un host reagende una reserva (pending o confirmed). Re-valida
-- el aforo del nuevo turno (±2h, excluyendo esta reserva) y los bloqueos, con
-- advisory lock, para no sobrevender. Queda registrado en el monitoreo con el
-- host responsable (action 'admin_rescheduled').
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================

CREATE OR REPLACE FUNCTION admin_reschedule_reservation(
    p_reservation_id UUID,
    p_new_date DATE,
    p_new_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor UUID;
    v_status reservation_status;
    v_salon_id UUID;
    v_party_size INT;
    v_old_date DATE;
    v_old_time TIME;
    v_salon_name TEXT;
    v_salon_active BOOLEAN;
    v_capacity INT;
    v_seats_taken BIGINT;
    v_lock_key BIGINT;
BEGIN
    -- Solo personal autorizado
    v_actor := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    SELECT status, salon_id, party_size, reservation_date, reservation_time
    INTO v_status, v_salon_id, v_party_size, v_old_date, v_old_time
    FROM reservations WHERE id = p_reservation_id;

    IF v_salon_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
    IF v_status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Solo se pueden reagendar reservas pendientes o confirmadas (estado actual: ' || v_status || ').');
    END IF;
    IF p_new_date < (now() AT TIME ZONE 'America/Bogota')::date THEN
        RETURN jsonb_build_object('success', false, 'error', 'La nueva fecha debe ser hoy o posterior');
    END IF;

    -- Lock por salón + nueva fecha (serializa con creaciones/otros cambios)
    v_lock_key := abs(hashtext(v_salon_id::text || p_new_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT name, is_active, capacity INTO v_salon_name, v_salon_active, v_capacity
    FROM salons WHERE id = v_salon_id;

    IF NOT v_salon_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este salon no esta disponible actualmente');
    END IF;

    -- Bloqueos en el nuevo slot
    IF EXISTS (
        SELECT 1 FROM blocked_slots bs
        WHERE (bs.salon_id = v_salon_id OR bs.salon_id IS NULL)
          AND bs.blocked_date = p_new_date
          AND (bs.is_full_day OR (p_new_time >= bs.start_time AND p_new_time < bs.end_time))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', v_salon_name || ' esta bloqueado para esa fecha.');
    END IF;

    -- Aforo por personas en el nuevo turno (±2h), EXCLUYENDO esta reserva
    SELECT COALESCE(SUM(r.party_size), 0) INTO v_seats_taken
    FROM reservations r
    WHERE r.salon_id = v_salon_id
      AND r.reservation_date = p_new_date
      AND r.reservation_time BETWEEN p_new_time - INTERVAL '2 hours' AND p_new_time + INTERVAL '2 hours'
      AND r.id != p_reservation_id
      AND (
          r.status IN ('confirmed', 'seated')
          OR (r.status = 'pending' AND (r.expires_at IS NULL OR r.expires_at > now()))
      );

    IF v_seats_taken + v_party_size > v_capacity THEN
        RETURN jsonb_build_object('success', false, 'error',
            'No hay cupo en ' || v_salon_name || ' para esa fecha y hora. Cupos disponibles: '
            || GREATEST(v_capacity - v_seats_taken, 0) || '.');
    END IF;

    UPDATE reservations
    SET reservation_date = p_new_date,
        reservation_time = p_new_time,
        updated_at = now()
    WHERE id = p_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (p_reservation_id, 'admin_rescheduled', jsonb_build_object(
        'old_date', v_old_date, 'old_time', v_old_time,
        'new_date', p_new_date, 'new_time', p_new_time
    ), v_actor);

    RETURN jsonb_build_object('success', true, 'message', 'Reserva reagendada',
        'new_date', p_new_date, 'new_time', p_new_time);
END;
$$;

REVOKE ALL ON FUNCTION admin_reschedule_reservation(UUID, DATE, TIME) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_reschedule_reservation(UUID, DATE, TIME) TO authenticated;
