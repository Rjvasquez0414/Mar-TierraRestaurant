-- =====================================================================
-- Mar&Tierra Restaurant — Sistema de Reservas
-- Schema v1.0 · Supabase (PostgreSQL 17)
-- =====================================================================

-- 1. ENUMS
-- =====================================================================

CREATE TYPE reservation_type AS ENUM ('free', 'plata', 'oro', 'luxury');
CREATE TYPE reservation_status AS ENUM (
    'pending',           -- recién creada, esperando pago
    'confirmed',         -- pago verificado por admin
    'seated',            -- cliente llegó
    'completed',         -- servicio terminado
    'cancelled',         -- cancelada (admin o cliente)
    'no_show'            -- no se presentó
);
CREATE TYPE payment_status AS ENUM ('pending', 'verified', 'rejected');


-- 2. TABLES
-- =====================================================================

-- Salones del restaurante
CREATE TABLE salons (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    capacity INT NOT NULL,
    allows_shared BOOLEAN DEFAULT true,
    max_simultaneous INT DEFAULT 3,
    description TEXT,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Clientes (CRM lite — teléfono como identificador lógico)
CREATE TABLE customers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    total_reservations INT DEFAULT 0,
    no_show_count INT DEFAULT 0,
    last_visit DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reservas (tabla core)
CREATE TABLE reservations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_code TEXT NOT NULL UNIQUE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    salon_id UUID NOT NULL REFERENCES salons(id),
    reservation_type reservation_type NOT NULL,
    status reservation_status DEFAULT 'pending',
    payment_status payment_status DEFAULT 'pending',
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    party_size INT NOT NULL CHECK (party_size BETWEEN 1 AND 14),
    deposit_amount INT NOT NULL,
    is_consumable BOOLEAN DEFAULT false,
    special_requests TEXT,
    cancellation_reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bloqueos de slots (mantenimiento, eventos privados)
CREATE TABLE blocked_slots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    salon_id UUID REFERENCES salons(id),
    blocked_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    reason TEXT NOT NULL,
    is_full_day BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Logs de auditoría
CREATE TABLE reservation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    performed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);


-- 3. INDEXES
-- =====================================================================

CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_salon ON reservations(salon_id);
CREATE INDEX idx_reservations_customer ON reservations(customer_id);
CREATE INDEX idx_reservations_code ON reservations(reservation_code);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_blocked_slots_date ON blocked_slots(blocked_date);
CREATE INDEX idx_reservation_logs_reservation ON reservation_logs(reservation_id);


-- 4. HELPER FUNCTIONS
-- =====================================================================

-- Genera código de reserva legible: MT-YYYYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_reservation_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    code TEXT;
    today TEXT;
    seq INT;
BEGIN
    today := to_char(now(), 'YYYYMMDD');
    SELECT COUNT(*) + 1 INTO seq
    FROM reservations
    WHERE reservation_code LIKE 'MT-' || today || '-%';
    code := 'MT-' || today || '-' || lpad(seq::TEXT, 4, '0');
    RETURN code;
END;
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reservations_updated
    BEFORE UPDATE ON reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- 5. RPC FUNCTIONS (public-facing via anon key)
-- =====================================================================

-- 5a. Obtener salones disponibles para una fecha/hora/tamaño
CREATE OR REPLACE FUNCTION get_available_salons(
    p_date DATE,
    p_time TIME,
    p_party_size INT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    capacity INT,
    description TEXT,
    image_url TEXT,
    current_bookings BIGINT,
    is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.name,
        s.slug,
        s.capacity,
        s.description,
        s.image_url,
        COALESCE(active.cnt, 0) AS current_bookings,
        (
            -- Salon is active
            s.is_active
            -- Party fits in salon
            AND p_party_size <= s.capacity
            -- Not blocked
            AND NOT EXISTS (
                SELECT 1 FROM blocked_slots bs
                WHERE (bs.salon_id = s.id OR bs.salon_id IS NULL)
                AND bs.blocked_date = p_date
                AND (
                    bs.is_full_day
                    OR (p_time >= bs.start_time AND p_time < bs.end_time)
                )
            )
            -- Under max simultaneous bookings
            AND COALESCE(active.cnt, 0) < s.max_simultaneous
            -- If not allows_shared, must have 0 bookings
            AND (s.allows_shared OR COALESCE(active.cnt, 0) = 0)
        ) AS is_available
    FROM salons s
    LEFT JOIN (
        SELECT r.salon_id, COUNT(*) AS cnt
        FROM reservations r
        WHERE r.reservation_date = p_date
        AND r.reservation_time BETWEEN p_time - INTERVAL '2 hours' AND p_time + INTERVAL '2 hours'
        AND r.status IN ('pending', 'confirmed', 'seated')
        GROUP BY r.salon_id
    ) active ON active.salon_id = s.id
    WHERE s.is_active = true
    AND p_party_size <= s.capacity
    ORDER BY s.display_order;
END;
$$;


-- 5b. Crear reserva + upsert cliente
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
AS $$
DECLARE
    v_customer_id UUID;
    v_reservation_id UUID;
    v_code TEXT;
    v_deposit INT;
    v_consumable BOOLEAN;
    v_salon_name TEXT;
    v_available BOOLEAN;
BEGIN
    -- Validate party size
    IF p_party_size < 1 OR p_party_size > 14 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El número de personas debe ser entre 1 y 14');
    END IF;

    -- Validate date is future
    IF p_date < CURRENT_DATE THEN
        RETURN jsonb_build_object('success', false, 'error', 'La fecha debe ser hoy o posterior');
    END IF;

    -- Check salon availability
    SELECT gas.is_available, s.name INTO v_available, v_salon_name
    FROM get_available_salons(p_date, p_time, p_party_size) gas
    JOIN salons s ON s.id = gas.id
    WHERE gas.id = p_salon_id;

    IF v_available IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Salón no encontrado');
    END IF;

    IF NOT v_available THEN
        RETURN jsonb_build_object('success', false, 'error',
            'Lo sentimos, ' || v_salon_name || ' no tiene disponibilidad para esa fecha y hora. Intenta con otro horario o salón.');
    END IF;

    -- Calculate deposit
    CASE p_type
        WHEN 'free' THEN v_deposit := 100000; v_consumable := true;
        WHEN 'plata' THEN v_deposit := 80000; v_consumable := false;
        WHEN 'oro' THEN v_deposit := 120000; v_consumable := false;
        WHEN 'luxury' THEN v_deposit := 100000; v_consumable := false;
    END CASE;

    -- Upsert customer
    INSERT INTO customers (phone, name, email)
    VALUES (p_phone, p_name, p_email)
    ON CONFLICT (phone) DO UPDATE SET
        name = EXCLUDED.name,
        email = COALESCE(EXCLUDED.email, customers.email),
        updated_at = now()
    RETURNING id INTO v_customer_id;

    -- Generate reservation code
    v_code := generate_reservation_code();

    -- Create reservation
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

    -- Update customer stats
    UPDATE customers
    SET total_reservations = total_reservations + 1
    WHERE id = v_customer_id;

    -- Log creation
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
END;
$$;


-- 6. ROW LEVEL SECURITY
-- =====================================================================

ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_logs ENABLE ROW LEVEL SECURITY;

-- Salons: public read, admin write
CREATE POLICY "salons_public_read" ON salons
    FOR SELECT USING (true);
CREATE POLICY "salons_admin_all" ON salons
    FOR ALL USING (auth.role() = 'authenticated');

-- Customers: admin only
CREATE POLICY "customers_admin_all" ON customers
    FOR ALL USING (auth.role() = 'authenticated');

-- Reservations: admin full access
CREATE POLICY "reservations_admin_all" ON reservations
    FOR ALL USING (auth.role() = 'authenticated');

-- Blocked slots: admin only
CREATE POLICY "blocked_slots_admin_all" ON blocked_slots
    FOR ALL USING (auth.role() = 'authenticated');

-- Reservation logs: admin only
CREATE POLICY "logs_admin_all" ON reservation_logs
    FOR ALL USING (auth.role() = 'authenticated');


-- 7. REALTIME (para que el admin vea reservas nuevas al instante)
-- =====================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE reservations;


-- 8. SEED DATA — Salones
-- =====================================================================

INSERT INTO salons (name, slug, capacity, allows_shared, max_simultaneous, description, image_url, display_order) VALUES
(
    'Moon Terraza',
    'moon-terraza',
    30,
    true,
    3,
    'Nuestra exclusiva Moon Terraza bar ofrece vistas panorámicas de Bucaramanga y coctelería de autor.',
    'images/EspaciosRestaurante/rooftop/_MG_9320.webp',
    1
),
(
    'Golden',
    'golden',
    25,
    true,
    3,
    'El pináculo del lujo y la exclusividad. Ambiente donde cada detalle define la excelencia.',
    'images/EspaciosRestaurante/SalonVIP/_MG_8865.webp',
    2
),
(
    'Arca',
    'arca',
    60,
    true,
    5,
    'El corazón de Mar&Tierra. Nuestro salón principal combina elegancia clásica con toques contemporáneos.',
    'images/EspaciosRestaurante/arca/_MG_8885.webp',
    3
),
(
    'Barco',
    'barco',
    16,
    true,
    2,
    'Una travesía gastronómica en nuestro salón temático del primer piso inspirado en los grandes transatlánticos.',
    'images/EspaciosRestaurante/barco/_MG_8908.webp',
    4
),
(
    'Chill Out',
    'chill-out',
    8,
    false,
    1,
    'Un oasis de relajación al aire libre donde las mascotas son bienvenidas. Terraza con ambiente distendido.',
    'images/EspaciosRestaurante/Chillout/_MG_9344.webp',
    5
);
