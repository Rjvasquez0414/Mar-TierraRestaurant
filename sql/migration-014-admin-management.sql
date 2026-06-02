-- =====================================================================
-- MIGRATION 014 — Gestión avanzada del admin
--   1) Asignar mesa a una reserva (table_label, solo uso interno)
--   2) Modificar la cantidad de personas (con aforo / forzar)
--   3) Crear reservas grandes (15+) personalizadas desde el admin
--   (color por plan es solo frontend, no requiere SQL)
-- =====================================================================
-- Sigue el patrón de migration-013: SECURITY DEFINER + guarda staff_roles
-- + advisory lock + aforo (±2h, excluyendo la propia reserva) + log con
-- performed_by.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================


-- 0. SCHEMA
-- ---------------------------------------------------------------------
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS table_label TEXT;

-- Relajar el límite de personas (15+ las registra el admin). Arca=54 es el aforo máx.
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_party_size_check;
ALTER TABLE reservations ADD CONSTRAINT reservations_party_size_check CHECK (party_size BETWEEN 1 AND 60);

-- Tipo nuevo para reservas personalizadas (anticipo libre). Si ya existe, no falla.
ALTER TYPE reservation_type ADD VALUE IF NOT EXISTS 'personalizada';


-- 1. ASIGNAR MESA — admin_set_table
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_set_table(
    p_reservation_id UUID,
    p_table_label TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor UUID;
    v_salon_id UUID;
    v_date DATE;
    v_time TIME;
    v_clean TEXT;
    v_conflict TEXT;
BEGIN
    v_actor := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    SELECT salon_id, reservation_date, reservation_time
    INTO v_salon_id, v_date, v_time
    FROM reservations WHERE id = p_reservation_id;
    IF v_salon_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    v_clean := NULLIF(trim(p_table_label), '');

    -- Aviso (no bloquea): ¿la misma mesa ya está en otra reserva activa del turno?
    IF v_clean IS NOT NULL THEN
        SELECT r.reservation_code INTO v_conflict
        FROM reservations r
        WHERE r.salon_id = v_salon_id
          AND r.reservation_date = v_date
          AND r.reservation_time BETWEEN v_time - INTERVAL '2 hours' AND v_time + INTERVAL '2 hours'
          AND r.id != p_reservation_id
          AND r.table_label = v_clean
          AND r.status IN ('pending', 'confirmed', 'seated')
        LIMIT 1;
    END IF;

    UPDATE reservations SET table_label = v_clean, updated_at = now()
    WHERE id = p_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (p_reservation_id, 'admin_set_table',
        jsonb_build_object('table_label', v_clean), v_actor);

    RETURN jsonb_build_object('success', true, 'table_label', v_clean,
        'warning', CASE WHEN v_conflict IS NOT NULL
            THEN 'La mesa ' || v_clean || ' ya está asignada a ' || v_conflict || ' en este turno.'
            ELSE NULL END);
END;
$$;


-- 2. MODIFICAR CANTIDAD DE PERSONAS — admin_modify_party_size
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_modify_party_size(
    p_reservation_id UUID,
    p_new_party_size INT,
    p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor UUID;
    v_status reservation_status;
    v_salon_id UUID;
    v_date DATE;
    v_time TIME;
    v_old INT;
    v_capacity INT;
    v_salon_name TEXT;
    v_seats_taken BIGINT;
    v_lock_key BIGINT;
BEGIN
    v_actor := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;
    IF p_new_party_size < 1 OR p_new_party_size > 60 THEN
        RETURN jsonb_build_object('success', false, 'error', 'La cantidad debe estar entre 1 y 60');
    END IF;

    SELECT status, salon_id, reservation_date, reservation_time, party_size
    INTO v_status, v_salon_id, v_date, v_time, v_old
    FROM reservations WHERE id = p_reservation_id;
    IF v_salon_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
    IF v_status NOT IN ('pending', 'confirmed', 'seated') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta reserva no se puede modificar (estado: ' || v_status || ')');
    END IF;

    v_lock_key := abs(hashtext(v_salon_id::text || v_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT name, capacity INTO v_salon_name, v_capacity FROM salons WHERE id = v_salon_id;

    IF NOT p_force THEN
        SELECT COALESCE(SUM(r.party_size), 0) INTO v_seats_taken
        FROM reservations r
        WHERE r.salon_id = v_salon_id
          AND r.reservation_date = v_date
          AND r.reservation_time BETWEEN v_time - INTERVAL '2 hours' AND v_time + INTERVAL '2 hours'
          AND r.id != p_reservation_id
          AND (
              r.status IN ('confirmed', 'seated')
              OR (r.status = 'pending' AND (r.expires_at IS NULL OR r.expires_at > now()))
          );
        IF v_seats_taken + p_new_party_size > v_capacity THEN
            RETURN jsonb_build_object('success', false, 'error',
                'No hay cupo en ' || v_salon_name || ' para ' || p_new_party_size || ' personas. Cupos disponibles: '
                || GREATEST(v_capacity - v_seats_taken, 0) || '. (Puedes forzar el cambio.)');
        END IF;
    END IF;

    UPDATE reservations SET party_size = p_new_party_size, updated_at = now()
    WHERE id = p_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (p_reservation_id, 'admin_modified_party_size',
        jsonb_build_object('old', v_old, 'new', p_new_party_size, 'forced', p_force), v_actor);

    RETURN jsonb_build_object('success', true, 'message', 'Cantidad actualizada', 'party_size', p_new_party_size);
END;
$$;


-- 3. CREAR RESERVA (admin / 15+ personalizadas) — admin_create_reservation
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_create_reservation(
    p_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_salon_id UUID,
    p_type reservation_type,
    p_date DATE,
    p_time TIME,
    p_party_size INT,
    p_deposit INT,
    p_requests TEXT DEFAULT NULL,
    p_admin_notes TEXT DEFAULT NULL,
    p_is_consumable BOOLEAN DEFAULT false,
    p_status reservation_status DEFAULT 'confirmed',
    p_force BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor UUID;
    v_customer_id UUID;
    v_reservation_id UUID;
    v_code TEXT;
    v_salon_name TEXT;
    v_salon_active BOOLEAN;
    v_capacity INT;
    v_seats_taken BIGINT;
    v_lock_key BIGINT;
BEGIN
    v_actor := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;
    IF p_party_size < 1 OR p_party_size > 60 THEN
        RETURN jsonb_build_object('success', false, 'error', 'La cantidad debe estar entre 1 y 60');
    END IF;
    IF p_date < (now() AT TIME ZONE 'America/Bogota')::date THEN
        RETURN jsonb_build_object('success', false, 'error', 'La fecha debe ser hoy o posterior');
    END IF;
    IF length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El telefono debe tener al menos 10 digitos');
    END IF;
    IF p_deposit IS NULL OR p_deposit < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El anticipo no es válido');
    END IF;

    v_lock_key := abs(hashtext(p_salon_id::text || p_date::text));
    PERFORM pg_advisory_xact_lock(v_lock_key);

    SELECT name, is_active, capacity INTO v_salon_name, v_salon_active, v_capacity
    FROM salons WHERE id = p_salon_id;
    IF v_salon_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salon no encontrado');
    END IF;
    IF NOT v_salon_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este salon no esta disponible actualmente');
    END IF;

    IF NOT p_force THEN
        IF p_party_size > v_capacity THEN
            RETURN jsonb_build_object('success', false, 'error',
                v_salon_name || ' tiene un aforo de ' || v_capacity || ' personas. (Puedes forzar.)');
        END IF;
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
                'No hay cupo en ' || v_salon_name || ' para esa fecha/hora. Cupos disponibles: '
                || GREATEST(v_capacity - v_seats_taken, 0) || '. (Puedes forzar.)');
        END IF;
    END IF;

    -- Upsert cliente (igual que create_reservation)
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
        reservation_code, customer_id, salon_id, reservation_type, status, payment_status,
        reservation_date, reservation_time, party_size,
        deposit_amount, is_consumable, special_requests, admin_notes, expires_at
    ) VALUES (
        v_code, v_customer_id, p_salon_id, p_type, p_status,
        CASE WHEN p_status = 'confirmed' THEN 'verified'::payment_status ELSE 'pending'::payment_status END,
        p_date, p_time, p_party_size,
        p_deposit, p_is_consumable, p_requests, p_admin_notes, NULL
    ) RETURNING id INTO v_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (v_reservation_id, 'admin_created', jsonb_build_object(
        'type', p_type::TEXT, 'salon', v_salon_name, 'date', p_date::TEXT, 'time', p_time::TEXT,
        'party_size', p_party_size, 'deposit', p_deposit, 'status', p_status::TEXT, 'forced', p_force
    ), v_actor);

    RETURN jsonb_build_object('success', true, 'reservation_id', v_reservation_id, 'reservation_code', v_code);
END;
$$;


-- 4. PERMISOS (solo staff autenticado)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION admin_set_table(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_table(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION admin_modify_party_size(UUID, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_modify_party_size(UUID, INT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION admin_create_reservation(TEXT, TEXT, TEXT, UUID, reservation_type, DATE, TIME, INT, INT, TEXT, TEXT, BOOLEAN, reservation_status, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_reservation(TEXT, TEXT, TEXT, UUID, reservation_type, DATE, TIME, INT, INT, TEXT, TEXT, BOOLEAN, reservation_status, BOOLEAN) TO authenticated;
