-- =====================================================================
-- MIGRATION 008 — Cancelación libre de pendientes + datos para correo de liberación
-- =====================================================================
-- 1. customer_cancel_reservation: la regla de 48h + "no reembolsable" solo
--    aplica a reservas CONFIRMADAS (pagadas). Una reserva PENDIENTE (sin
--    pago) se puede cancelar en cualquier momento y libera el cupo al instante.
--
-- 2. expire_stale_reservations: ahora devuelve la LISTA de reservas vencidas
--    (código, nombre, email, teléfono...) para que el panel admin envíe el
--    correo de "reserva liberada" a cada cliente. Antes devolvía solo el conteo.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================


-- 1. CANCELACIÓN: 48h solo para confirmadas
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

    -- Verificar teléfono (últimos 4 dígitos)
    IF right(regexp_replace(p_phone, '[^0-9]', '', 'g'), 4) != right(v_customer_phone, 4) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Los ultimos 4 digitos del telefono no coinciden');
    END IF;

    IF v_status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta reserva no puede ser cancelada (estado: ' || v_status || ')');
    END IF;

    -- Política de 48h + anticipo no reembolsable: SOLO para reservas
    -- confirmadas (ya pagadas). Las pendientes sin pago se cancelan libres.
    IF v_status = 'confirmed' THEN
        v_hours_until := EXTRACT(EPOCH FROM (v_date + v_time - now())) / 3600;
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


-- 2. EXPIRACIÓN: devuelve la lista de vencidas (para correos de liberación)
-- ---------------------------------------------------------------------
-- Cambia el tipo de retorno (INT → JSONB), por eso DROP + CREATE.
DROP FUNCTION IF EXISTS expire_stale_reservations();

CREATE FUNCTION expire_stale_reservations()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH expired AS (
        UPDATE reservations r
        SET status = 'cancelled',
            payment_status = 'rejected',
            cancellation_reason = 'Expiracion automatica: sin pago tras 24h'
        WHERE r.status = 'pending'
          AND r.expires_at IS NOT NULL
          AND r.expires_at <= now()
        RETURNING r.id, r.reservation_code, r.customer_id,
                  r.reservation_date, r.reservation_time, r.party_size, r.salon_id
    ),
    logged AS (
        INSERT INTO reservation_logs (reservation_id, action, details)
        SELECT id, 'expired', jsonb_build_object('reason', 'auto-24h-sin-pago') FROM expired
        RETURNING 1
    )
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'reservation_code', e.reservation_code,
        'name', c.name,
        'email', c.email,
        'phone', c.phone,
        'date', e.reservation_date,
        'time', e.reservation_time,
        'party_size', e.party_size,
        'salon_name', s.name
    )), '[]'::jsonb)
    INTO v_result
    FROM expired e
    JOIN customers c ON c.id = e.customer_id
    LEFT JOIN salons s ON s.id = e.salon_id;

    RETURN v_result;
END;
$$;

-- Solo el panel admin (rol authenticated) la ejecuta
REVOKE ALL ON FUNCTION expire_stale_reservations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION expire_stale_reservations() TO authenticated;
