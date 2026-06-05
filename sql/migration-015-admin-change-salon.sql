-- =====================================================================
-- MIGRATION 015 — El admin puede cambiar el salón/zona de una reserva
-- =====================================================================
-- RPC para mover una reserva a otro salón, manteniendo fecha/hora. Re-valida
-- el aforo del NUEVO salón (±2h, excluyendo esta reserva) + bloqueos, con
-- advisory lock y opción de forzar. Como la mesa asignada pertenece al salón
-- anterior, se limpia (table_label = NULL). Queda registrado en el monitoreo.
--
-- Patrón de migration-013/014. Correr en: Supabase → SQL Editor.
-- =====================================================================

CREATE OR REPLACE FUNCTION admin_change_salon(
    p_reservation_id UUID,
    p_new_salon_id UUID,
    p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor UUID;
    v_status reservation_status;
    v_old_salon_id UUID;
    v_old_salon_name TEXT;
    v_party_size INT;
    v_date DATE;
    v_time TIME;
    v_new_name TEXT;
    v_new_active BOOLEAN;
    v_capacity INT;
    v_seats_taken BIGINT;
    v_lock_key BIGINT;
BEGIN
    v_actor := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    SELECT r.status, r.salon_id, s.name, r.party_size, r.reservation_date, r.reservation_time
    INTO v_status, v_old_salon_id, v_old_salon_name, v_party_size, v_date, v_time
    FROM reservations r LEFT JOIN salons s ON s.id = r.salon_id
    WHERE r.id = p_reservation_id;

    IF v_old_salon_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
    IF v_status NOT IN ('pending', 'confirmed', 'seated') THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Esta reserva no se puede mover (estado: ' || v_status || ').');
    END IF;
    IF p_new_salon_id = v_old_salon_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'La reserva ya está en ese salón.');
    END IF;

    -- Lock por NUEVO salón + fecha
    v_lock_key := abs(hashtext(p_new_salon_id::text || v_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT name, is_active, capacity INTO v_new_name, v_new_active, v_capacity
    FROM salons WHERE id = p_new_salon_id;
    IF v_new_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salón destino no encontrado');
    END IF;
    IF NOT v_new_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Ese salón no está disponible actualmente');
    END IF;

    -- Bloqueos en el nuevo salón/slot
    IF EXISTS (
        SELECT 1 FROM blocked_slots bs
        WHERE (bs.salon_id = p_new_salon_id OR bs.salon_id IS NULL)
          AND bs.blocked_date = v_date
          AND (bs.is_full_day OR (v_time >= bs.start_time AND v_time < bs.end_time))
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', v_new_name || ' está bloqueado para esa fecha.');
    END IF;

    -- Aforo del NUEVO salón (±2h, excluyendo esta reserva) salvo forzar
    IF NOT p_force THEN
        IF v_party_size > v_capacity THEN
            RETURN jsonb_build_object('success', false, 'error',
                v_new_name || ' tiene un aforo de ' || v_capacity || ' personas. (Puedes forzar.)');
        END IF;
        SELECT COALESCE(SUM(r.party_size), 0) INTO v_seats_taken
        FROM reservations r
        WHERE r.salon_id = p_new_salon_id
          AND r.reservation_date = v_date
          AND r.reservation_time BETWEEN v_time - INTERVAL '2 hours' AND v_time + INTERVAL '2 hours'
          AND r.id != p_reservation_id
          AND (
              r.status IN ('confirmed', 'seated')
              OR (r.status = 'pending' AND (r.expires_at IS NULL OR r.expires_at > now()))
          );
        IF v_seats_taken + v_party_size > v_capacity THEN
            RETURN jsonb_build_object('success', false, 'error',
                'No hay cupo en ' || v_new_name || ' para esa fecha/hora. Cupos disponibles: '
                || GREATEST(v_capacity - v_seats_taken, 0) || '. (Puedes forzar.)');
        END IF;
    END IF;

    -- Mover de salón + limpiar la mesa (pertenece al salón anterior)
    UPDATE reservations
    SET salon_id = p_new_salon_id,
        table_label = NULL,
        updated_at = now()
    WHERE id = p_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (p_reservation_id, 'admin_changed_salon', jsonb_build_object(
        'old_salon', v_old_salon_name, 'new_salon', v_new_name, 'forced', p_force
    ), v_actor);

    RETURN jsonb_build_object('success', true, 'message', 'Reserva movida a ' || v_new_name);
END;
$$;

REVOKE ALL ON FUNCTION admin_change_salon(UUID, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_change_salon(UUID, UUID, BOOLEAN) TO authenticated;
