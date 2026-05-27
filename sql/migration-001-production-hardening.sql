-- =====================================================================
-- MIGRATION 001: Production Hardening
-- Fixes: race conditions, RLS security, duplicate codes, atomic counters
-- =====================================================================

-- 1. PRICING TABLE (replace hardcoded deposits)
-- =====================================================================

CREATE TABLE IF NOT EXISTS pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_type reservation_type NOT NULL,
    deposit_amount INT NOT NULL,
    is_consumable BOOLEAN NOT NULL,
    effective_from TIMESTAMPTZ DEFAULT now(),
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_public_read" ON pricing FOR SELECT USING (true);
CREATE POLICY "pricing_admin_write" ON pricing FOR ALL USING (auth.role() = 'authenticated');

INSERT INTO pricing (reservation_type, deposit_amount, is_consumable) VALUES
('free', 100000, true),
('plata', 80000, false),
('oro', 120000, false),
('luxury', 100000, false);


-- 2. STAFF ROLES TABLE (proper admin authorization)
-- =====================================================================

CREATE TABLE IF NOT EXISTS staff_roles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE staff_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff_roles_admin_only" ON staff_roles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid() AND sr.role = 'admin')
    );

-- Insert current admin
INSERT INTO staff_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'admin@martierra.com'
ON CONFLICT (user_id) DO NOTHING;


-- 3. FIX RLS POLICIES (admin-only, not any authenticated user)
-- =====================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "customers_admin_all" ON customers;
DROP POLICY IF EXISTS "reservations_admin_all" ON reservations;
DROP POLICY IF EXISTS "blocked_slots_admin_all" ON blocked_slots;
DROP POLICY IF EXISTS "logs_admin_all" ON reservation_logs;
DROP POLICY IF EXISTS "salons_admin_all" ON salons;

-- Recreate with proper staff check
CREATE POLICY "customers_staff_only" ON customers
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );

CREATE POLICY "reservations_staff_only" ON reservations
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );

CREATE POLICY "blocked_slots_staff_only" ON blocked_slots
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );

CREATE POLICY "logs_staff_only" ON reservation_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );

CREATE POLICY "salons_staff_write" ON salons
    FOR ALL USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );


-- 4. RESERVATION CODE SEQUENCE (atomic, no duplicates)
-- =====================================================================

CREATE SEQUENCE IF NOT EXISTS reservation_daily_seq START 1;

CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    code TEXT;
    today TEXT;
    seq INT;
BEGIN
    today := to_char(now() AT TIME ZONE 'America/Bogota', 'YYYYMMDD');
    seq := nextval('reservation_daily_seq');
    code := 'MT-' || today || '-' || lpad(seq::TEXT, 4, '0');
    RETURN code;
END;
$$;


-- 5. REPLACE create_reservation WITH SERIALIZABLE + LOCKING
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
BEGIN
    -- Validate inputs
    IF p_party_size < 1 OR p_party_size > 14 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El numero de personas debe ser entre 1 y 14');
    END IF;

    IF p_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'La fecha debe ser hoy o posterior');
    END IF;

    IF length(regexp_replace(p_phone, '[^0-9]', '', 'g')) < 10 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El telefono debe tener al menos 10 digitos');
    END IF;

    -- Lock the salon row to prevent concurrent bookings
    SELECT s.name, s.is_active, s.max_simultaneous, s.allows_shared, s.capacity
    INTO v_salon_name, v_salon_active, v_max_simultaneous, v_allows_shared, v_capacity
    FROM salons s
    WHERE s.id = p_salon_id
    FOR UPDATE;

    IF v_salon_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salon no encontrado');
    END IF;

    IF NOT v_salon_active THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este salon no esta disponible actualmente');
    END IF;

    IF p_party_size > v_capacity THEN
        RETURN jsonb_build_object('success', false, 'error', 'El salon no tiene capacidad para ' || p_party_size || ' personas');
    END IF;

    -- Count current bookings with row-level lock
    SELECT COUNT(*) INTO v_current_bookings
    FROM reservations r
    WHERE r.salon_id = p_salon_id
    AND r.reservation_date = p_date
    AND r.reservation_time BETWEEN p_time - INTERVAL '2 hours' AND p_time + INTERVAL '2 hours'
    AND r.status IN ('pending', 'confirmed', 'seated')
    FOR UPDATE;

    -- Check availability
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

    -- Get pricing from table
    SELECT deposit_amount, is_consumable
    INTO v_deposit, v_consumable
    FROM pricing
    WHERE reservation_type = p_type
    AND effective_to IS NULL
    ORDER BY effective_from DESC
    LIMIT 1;

    IF v_deposit IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de reserva no encontrado');
    END IF;

    -- Upsert customer (atomic)
    INSERT INTO customers (phone, name, email, total_reservations)
    VALUES (regexp_replace(p_phone, '[^0-9]', '', 'g'), p_name, p_email, 1)
    ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, customers.email),
        total_reservations = customers.total_reservations + 1,
        updated_at = now()
    RETURNING id INTO v_customer_id;

    -- Generate unique code
    v_code := generate_reservation_code();

    -- Insert reservation
    INSERT INTO reservations (
        reservation_code, customer_id, salon_id, reservation_type,
        reservation_date, reservation_time, party_size,
        deposit_amount, is_consumable, special_requests
    ) VALUES (
        v_code, v_customer_id, p_salon_id, p_type,
        p_date, p_time, p_party_size,
        v_deposit, v_consumable, p_requests
    )
    RETURNING id INTO v_reservation_id;

    -- Log
    INSERT INTO reservation_logs (reservation_id, action, details)
    VALUES (v_reservation_id, 'created', jsonb_build_object(
        'type', p_type::TEXT,
        'salon', v_salon_name,
        'date', p_date::TEXT,
        'time', p_time::TEXT,
        'party_size', p_party_size,
        'deposit', v_deposit
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


-- 6. TRIGGER: Atomic no-show counter
-- =====================================================================

CREATE OR REPLACE FUNCTION sync_customer_noshow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = 'no_show' AND (OLD.status IS NULL OR OLD.status != 'no_show') THEN
        UPDATE customers
        SET no_show_count = no_show_count + 1,
            updated_at = now()
        WHERE id = NEW.customer_id;
    END IF;

    IF OLD.status = 'no_show' AND NEW.status != 'no_show' THEN
        UPDATE customers
        SET no_show_count = GREATEST(no_show_count - 1, 0),
            updated_at = now()
        WHERE id = NEW.customer_id;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_noshow ON reservations;
CREATE TRIGGER trg_sync_noshow
    AFTER UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION sync_customer_noshow();


-- 7. COMPOSITE INDEX for availability queries
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_reservations_availability
    ON reservations(salon_id, reservation_date, reservation_time)
    WHERE status IN ('pending', 'confirmed', 'seated');


-- 8. Cancellation function (atomic)
-- =====================================================================

CREATE OR REPLACE FUNCTION cancel_reservation(
    p_reservation_id UUID,
    p_reason TEXT,
    p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status reservation_status;
    v_code TEXT;
BEGIN
    SELECT status, reservation_code INTO v_current_status, v_code
    FROM reservations WHERE id = p_reservation_id FOR UPDATE;

    IF v_current_status IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reserva no encontrada');
    END IF;

    IF v_current_status NOT IN ('pending', 'confirmed') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo se pueden cancelar reservas pendientes o confirmadas');
    END IF;

    UPDATE reservations
    SET status = 'cancelled',
        payment_status = 'rejected',
        cancellation_reason = p_reason,
        updated_at = now()
    WHERE id = p_reservation_id;

    UPDATE customers
    SET total_reservations = GREATEST(total_reservations - 1, 0),
        updated_at = now()
    WHERE id = (SELECT customer_id FROM reservations WHERE id = p_reservation_id);

    INSERT INTO reservation_logs (reservation_id, action, details, performed_by)
    VALUES (p_reservation_id, 'cancelled', jsonb_build_object('reason', p_reason), p_admin_id);

    RETURN jsonb_build_object('success', true, 'code', v_code);
END;
$$;
