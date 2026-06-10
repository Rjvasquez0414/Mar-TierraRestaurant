-- =====================================================================
-- MIGRATION 016 — El admin puede cambiar el paquete/tipo de una reserva
-- =====================================================================
-- RPC para cambiar el plan (free/plata/oro/luxury/personalizada) de una
-- reserva existente, ajustando el anticipo (deposit_amount) y si es
-- consumible. El paquete NO afecta el aforo (eso depende de party_size),
-- así que no se re-valida capacidad ni se necesita advisory lock. Queda
-- registrado en el monitoreo (reservation_logs).
--
-- Patrón de migration-015 (admin_change_salon). Correr en: Supabase → SQL Editor.
-- =====================================================================

CREATE OR REPLACE FUNCTION admin_change_type(
    p_reservation_id UUID,
    p_new_type reservation_type,
    p_new_deposit INT,
    p_is_consumable BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_actor UUID;
    v_status reservation_status;
    v_old_type reservation_type;
    v_old_deposit INT;
BEGIN
    v_actor := auth.uid();
    IF NOT EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = v_actor) THEN
        RETURN jsonb_build_object('success', false, 'error', 'No autorizado');
    END IF;

    SELECT r.status, r.reservation_type, r.deposit_amount
    INTO v_status, v_old_type, v_old_deposit
    FROM reservations r
    WHERE r.id = p_reservation_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;
    IF v_status NOT IN ('pending', 'confirmed', 'seated') THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Esta reserva no se puede modificar (estado: ' || v_status || ').');
    END IF;
    IF p_new_deposit IS NULL OR p_new_deposit < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El anticipo no puede ser negativo.');
    END IF;

    UPDATE reservations
    SET reservation_type = p_new_type,
        deposit_amount   = p_new_deposit,
        is_consumable    = p_is_consumable,
        updated_at       = now()
    WHERE id = p_reservation_id;

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (p_reservation_id, 'admin_changed_type', jsonb_build_object(
        'old_type', v_old_type, 'new_type', p_new_type,
        'old_deposit', v_old_deposit, 'new_deposit', p_new_deposit,
        'is_consumable', p_is_consumable
    ), v_actor);

    RETURN jsonb_build_object('success', true, 'message', 'Paquete actualizado a ' || p_new_type);
END;
$$;

REVOKE ALL ON FUNCTION admin_change_type(UUID, reservation_type, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_change_type(UUID, reservation_type, INT, BOOLEAN) TO authenticated;
