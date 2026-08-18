# Plan de arquitectura — Sistema de Reservas Mar&Tierra (v2)

> Documento de diseño. **No es código aún.** Sirve para alinear decisiones antes de implementar.
> Stack propuesto: **Supabase (Postgres + Auth + Realtime + Edge Functions) + frontend vanilla actual + Cloudflare DNS/CDN**.
> Fecha: 2026-05-19.

---

## 0. Por qué Supabase (y por qué no otras opciones)

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **Supabase** | Postgres real (no NoSQL), Auth incluida, RLS para seguridad fina, Edge Functions con Deno, dashboard admin gratis, $0 hasta 500MB DB | Necesitas aprender RLS, los Edge Functions son Deno (no Node) | ✅ **Elegido** |
| Firebase | Maduro, integración Google | Firestore es NoSQL (peor para reportes), vendor-lock fuerte, más caro a escala | ❌ |
| Backend custom (Node + Postgres + AWS) | Control total | 3–4 semanas de trabajo solo para basics que Supabase ya da, sin admin UI | ❌ |
| SaaS de reservas (OpenTable, Resy, ResOS, Mesa247) | Listo en horas | $50–200 USD/mes recurrente, branding ajeno, no escala a CRM propio, no se integra con el sitio actual | ❌ (por filosofía + costo) |
| **Continuar con Google Sheets** | Gratis, simple | Sin transacciones, sin disponibilidad real, emails caen en spam, no escala | ❌ (la razón por la que estamos rediseñando) |

**Costo estimado Supabase para Mar&Tierra:** $0/mes en plan Free durante el primer año (límites: 500MB DB + 5GB bandwidth + 2GB file storage). Si el restaurante crece, plan Pro $25/mes con backups diarios y 8GB DB — más que suficiente.

---

## 1. Principios de diseño

1. **Disponibilidad real con locking transaccional.** Imposible que dos reservas tomen la misma mesa en la misma franja.
2. **WhatsApp como canal de confirmación primario.** El cliente recibe confirmación por WhatsApp (no email-que-cae-en-spam).
3. **CRM por construcción.** Cada reserva enriquece el perfil del cliente automáticamente (cuántas veces vino, qué consumió, ocasiones especiales).
4. **Admin dashboard simple para el staff.** Vista de agenda diaria, calendario, asignación manual cuando sea necesario.
5. **No-show tracking.** El sistema marca clientes que no asisten sin avisar — útil para política de anticipos en grupos.
6. **Reservable desde el mismo sitio** (sin redirección externa) y desde WhatsApp (asistente conversacional opcional en V2).
7. **Datos del cliente bajo Ley 1581 de Colombia.** RLS + consentimiento explícito + derecho a la supresión.

---

## 2. Esquema de base de datos

### 2.1 Tablas core

```sql
-- Salones / espacios físicos
CREATE TABLE salons (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,       -- 'arca', 'almaterra', 'barco', 'chillout', 'rooftop', 'golden'
  name            text NOT NULL,
  capacity_min    int NOT NULL,
  capacity_max    int NOT NULL,
  is_pet_friendly boolean DEFAULT false,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- Mesas individuales (un salón tiene N mesas)
CREATE TABLE tables (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid REFERENCES salons(id) ON DELETE CASCADE,
  label       text NOT NULL,             -- "Mesa 1", "Mesa VIP", etc.
  seats       int NOT NULL,              -- capacidad
  is_active   boolean DEFAULT true,
  UNIQUE (salon_id, label)
);

-- Clientes (CRM lite)
CREATE TABLE customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  phone           text NOT NULL,         -- formato E.164 +57XXXXXXXXXX
  email           text,
  birthday        date,
  notes           text,                  -- alergias, preferencias
  total_visits    int DEFAULT 0,
  total_no_shows  int DEFAULT 0,
  marketing_optin boolean DEFAULT false, -- consentimiento Ley 1581
  data_consent_at timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (phone)
);

CREATE INDEX idx_customers_phone ON customers (phone);
CREATE INDEX idx_customers_email ON customers (email);

-- Reservas
CREATE TYPE reservation_status AS ENUM (
  'pending',      -- recibida, esperando confirmación staff
  'confirmed',    -- confirmada
  'seated',       -- cliente llegó, en mesa
  'completed',    -- terminó el servicio
  'cancelled',    -- cancelada por el cliente
  'no_show'       -- no se presentó
);

CREATE TYPE reservation_type AS ENUM (
  'standard',     -- reserva normal
  'event',        -- evento privado
  'decoration',   -- con plan de decoración
  'large_group'   -- 15+ personas
);

CREATE TABLE reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     uuid REFERENCES customers(id),
  salon_id        uuid REFERENCES salons(id),
  table_id        uuid REFERENCES tables(id),         -- nullable: se asigna en confirmación
  party_size      int NOT NULL CHECK (party_size > 0),
  reservation_at  timestamptz NOT NULL,               -- fecha+hora de la reserva
  duration_min    int DEFAULT 120,                    -- duración estimada
  status          reservation_status DEFAULT 'pending',
  type            reservation_type DEFAULT 'standard',
  decoration_plan text,                               -- 'plata', 'oro', 'luxury', etc.
  extra_services  jsonb DEFAULT '[]',                 -- ['saxofonista', 'dj', ...]
  deposit_amount  numeric(10,2) DEFAULT 0,
  deposit_paid    boolean DEFAULT false,
  special_notes   text,
  source          text DEFAULT 'website',             -- 'website', 'whatsapp', 'phone', 'walkin'
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  confirmed_at    timestamptz,
  cancelled_at    timestamptz
);

CREATE INDEX idx_reservations_date     ON reservations (reservation_at);
CREATE INDEX idx_reservations_salon    ON reservations (salon_id, reservation_at);
CREATE INDEX idx_reservations_customer ON reservations (customer_id);
CREATE INDEX idx_reservations_status   ON reservations (status);

-- Slots bloqueados (privatizaciones, eventos privados, mantenimiento)
CREATE TABLE blocked_slots (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  salon_id    uuid REFERENCES salons(id) ON DELETE CASCADE,
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  reason      text NOT NULL,
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz DEFAULT now()
);

-- Auditoría de cambios en reservas (quién modificó qué)
CREATE TABLE reservation_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  uuid REFERENCES reservations(id) ON DELETE CASCADE,
  actor_id        uuid REFERENCES auth.users(id),    -- null si fue self-service del cliente
  action          text NOT NULL,                     -- 'created', 'confirmed', 'cancelled', etc.
  before_state    jsonb,
  after_state     jsonb,
  created_at      timestamptz DEFAULT now()
);
```

### 2.2 Trigger para garantizar disponibilidad

El core del sistema. Bloquea reservas que choquen con otras existentes en la misma mesa.

```sql
CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS trigger AS $$
BEGIN
  IF NEW.table_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM reservations r
    WHERE r.id <> NEW.id
      AND r.table_id = NEW.table_id
      AND r.status IN ('pending', 'confirmed', 'seated')
      AND tstzrange(r.reservation_at, r.reservation_at + (r.duration_min * INTERVAL '1 min'))
          && tstzrange(NEW.reservation_at, NEW.reservation_at + (NEW.duration_min * INTERVAL '1 min'))
  ) THEN
    RAISE EXCEPTION 'Mesa ya reservada en ese horario'
      USING ERRCODE = 'M2001', HINT = 'Selecciona otro horario o mesa';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_overlap
BEFORE INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION check_reservation_overlap();
```

### 2.3 Trigger de auditoría

```sql
CREATE OR REPLACE FUNCTION log_reservation_change()
RETURNS trigger AS $$
BEGIN
  INSERT INTO reservation_logs (reservation_id, actor_id, action, before_state, after_state)
  VALUES (
    NEW.id,
    auth.uid(),
    CASE
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN OLD.status <> NEW.status THEN 'status_changed_to_' || NEW.status
      ELSE 'updated'
    END,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) END,
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservation_log
AFTER INSERT OR UPDATE ON reservations
FOR EACH ROW EXECUTE FUNCTION log_reservation_change();
```

---

## 3. Row Level Security (RLS)

Filosofía: **el público NO accede a la tabla directo. Todo va por Edge Functions.** RLS es la red de seguridad por si algo se filtra.

```sql
-- Activar RLS en todas las tablas con datos sensibles
ALTER TABLE customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_logs ENABLE ROW LEVEL SECURITY;

-- Lectura pública sólo de tablas y salones (catálogo del restaurante)
ALTER TABLE salons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catálogo público de salones"
  ON salons FOR SELECT USING (is_active = true);

CREATE POLICY "Catálogo público de mesas"
  ON tables FOR SELECT USING (is_active = true);

-- Reservas: sólo staff autenticado ve todo
CREATE POLICY "Staff ve todas las reservas"
  ON reservations FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('staff', 'admin'));

CREATE POLICY "Staff modifica reservas"
  ON reservations FOR ALL
  USING (auth.jwt() ->> 'role' IN ('staff', 'admin'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('staff', 'admin'));

-- Clientes: igual, sólo staff
CREATE POLICY "Staff ve clientes"
  ON customers FOR SELECT
  USING (auth.jwt() ->> 'role' IN ('staff', 'admin'));
```

El frontend público usa la **Edge Function `createReservation`**, no acceso directo a la BD.

---

## 4. Edge Functions

Tres funciones críticas. Lenguaje: TypeScript sobre Deno.

### 4.1 `checkAvailability`

**Input:** `{ salon_slug, date, party_size }`
**Output:** `{ available_slots: [{ time, table_label, table_id }] }`

Lógica:
1. Obtiene mesas del salón con `seats >= party_size`.
2. Genera slots cada 30 min entre apertura y cierre del día.
3. Para cada slot, descarta los que choquen con reservas o `blocked_slots`.
4. Devuelve los disponibles ordenados.

Frontend lo usa al cambiar `fecha` o `personas` en el formulario.

### 4.2 `createReservation`

**Input:** `{ customer: {name, phone, email}, salon_slug, table_id, reservation_at, party_size, ... }`
**Output:** `{ reservation_id, status, message }`

Lógica:
1. Valida que `customer.phone` esté en formato E.164.
2. `UPSERT` en `customers` por phone.
3. `INSERT` en `reservations` con `status = 'pending'`.
4. El trigger de overlap dispara error si la mesa ya estaba — devuelve 409 al frontend.
5. Encola notificación al staff vía `pg_notify` o llama a `notifyStaff` directamente.

### 4.3 `notifyReservation`

**Trigger:** webhook de Supabase al cambiar `status`.
**Output:** llama a WhatsApp Cloud API + envía email transaccional.

Mensajes:
- **Cliente — `pending` → confirmación recibida:** "Hola [nombre], recibimos tu solicitud de reserva para [fecha] [hora] · [salón] · [personas]. Te confirmaremos en breve. — Mar&Tierra"
- **Cliente — `confirmed`:** "✅ Tu reserva está confirmada. Te esperamos el [fecha] a las [hora] en el salón [salón]. Si necesitas modificar, responde a este chat."
- **Cliente — `cancelled`:** "Tu reserva del [fecha] fue cancelada. Esperamos verte pronto."
- **Cliente — 2h antes:** "Recordatorio: tu reserva en Mar&Tierra es hoy a las [hora]. ¿Confirmas asistencia?" (botones quick-reply)
- **Staff — nueva pending:** "📩 Nueva reserva: [nombre] · [fecha] [hora] · [personas] · [salón]. Ver: [link admin]"

### 4.4 Cron jobs (pg_cron)

```sql
-- Recordatorio 2h antes
SELECT cron.schedule('reminder-2h', '*/15 * * * *', $$
  SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/sendReminders'
  );
$$);

-- Marcar no-shows 30min después del horario sin check-in
SELECT cron.schedule('mark-no-shows', '*/10 * * * *', $$
  UPDATE reservations
  SET status = 'no_show'
  WHERE status = 'confirmed'
    AND reservation_at < now() - INTERVAL '30 minutes';
$$);
```

---

## 5. Notificaciones

### 5.1 WhatsApp Cloud API (Meta)

**Requisitos para producción:**
- Cuenta de Meta Business Verification (1–2 semanas de aprobación).
- Número dedicado (no se puede usar el WhatsApp Business actual de 300 826 3403 *al mismo tiempo* — hay que decidir si migrar ese número a la Cloud API o conseguir uno nuevo).
- Plantillas de mensaje pre-aprobadas por Meta (las 5 listadas arriba).

**Costo:** Meta cobra ~$0.0050–0.015 USD por mensaje de conversación enviado. Para 200 reservas/mes ≈ $3 USD/mes.

**Alternativa más barata para empezar:** Twilio WhatsApp Sandbox o WATI (~$40/mes) — más rápido de configurar pero menos pulido.

### 5.2 Email transaccional

**Resend** (recomendado): gratis hasta 3.000 emails/mes, dominio propio `noreply@marytierrarestaurantbga.com`, plantillas con React Email. Cero spam comparado con GAS.

**Plantillas mínimas:** confirmación reserva + recordatorio 24h + cancelación.

---

## 6. Frontend — cambios al sitio actual

El sitio actual mantiene su forma, pero el botón **"Reservar Mesa"** vuelve a abrir un modal — esta vez conectado al backend real.

### 6.1 Modal nuevo (sustituye el actual)

Flujo en 3 pasos (no todo en una pantalla — reduce ansiedad):

1. **Paso 1 — ¿Cuándo y cuántos?**
   - Selector de fecha (con `<input type="date">` mínimo HOY)
   - Selector de personas (1–14, "15+ contacta WhatsApp")
   - Selector de salón (con descripción y capacidad)
   - Botón "Ver horarios disponibles" → llama `checkAvailability`

2. **Paso 2 — Elige hora**
   - Grid de slots disponibles (chips clicables)
   - Si no hay slots: "No hay disponibilidad para esa configuración — prueba otra fecha o [contáctanos por WhatsApp]"

3. **Paso 3 — Tus datos**
   - Nombre completo
   - WhatsApp (con prefijo +57 visible)
   - Email (opcional)
   - Ocasión especial (cumpleaños, aniversario, otro) → para futura segmentación CRM
   - Notas (alergias, preferencias)
   - Checkbox consentimiento Ley 1581 (obligatorio)
   - Botón "Solicitar reserva" → llama `createReservation`

4. **Confirmación:**
   - "✅ Recibimos tu solicitud. Te confirmamos por WhatsApp en máx. 2 horas."
   - Link a WhatsApp por si quiere chatear directamente.

### 6.2 Código frontend

Mantener vanilla JS. Crear `js/reservations-v2.js`. Se comunicará con Supabase vía SDK oficial cargado por CDN:

```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
</script>
```

La `ANON_KEY` puede estar en el frontend — RLS protege los datos. Sólo Edge Functions tienen acceso completo.

---

## 7. Admin Dashboard

**Mínimo viable (MVP):** usar el dashboard nativo de Supabase + 1 vista custom (`/admin.html` protegida).

**V1 dedicado:** sub-app React/Vue dentro de `/admin/`, login con Supabase Auth (magic link al email del staff), 4 vistas:

1. **Agenda del día** — lista de reservas de hoy ordenadas por hora. Botones: marcar como `seated` / `no_show`, asignar mesa, escribir nota.
2. **Calendario semanal/mensual** — drag & drop para mover reservas.
3. **CRM** — buscador de clientes por nombre/teléfono, historial de visitas, notas.
4. **Configuración** — gestionar salones, mesas, horarios, slots bloqueados.

Para MVP no es indispensable construir esto desde cero. **El dashboard de Supabase ya permite editar registros** y es suficiente al principio.

---

## 8. Roadmap por fases

### Fase 1 — MVP (2–3 semanas de trabajo)
- [ ] Crear proyecto Supabase, ejecutar esquema SQL.
- [ ] Poblar `salons` y `tables` con los espacios reales.
- [ ] Edge Function `checkAvailability` y `createReservation`.
- [ ] Modal nuevo en el sitio (3 pasos).
- [ ] Email transaccional con Resend (sin WhatsApp todavía).
- [ ] Vista admin simple usando el dashboard nativo de Supabase.
- [ ] Mantener el botón flotante de WhatsApp como canal alternativo siempre visible.

### Fase 2 — WhatsApp y automatización (2–3 semanas más)
- [ ] Aprobar plantillas WhatsApp en Meta Business.
- [ ] Edge Function `notifyReservation`.
- [ ] Cron de recordatorios y no-shows.
- [ ] Login del staff con magic link.

### Fase 3 — Admin dashboard dedicado (3–4 semanas)
- [ ] Sub-app `/admin/` con calendario, agenda, drag & drop.
- [ ] Vista de cliente con historial y notas.
- [ ] Reportes básicos (ocupación, top platos, no-show rate por salón).

### Fase 4 — Inteligencia (futuro)
- [ ] Sugerencias de mesa basadas en historial.
- [ ] Asistente conversacional en WhatsApp (Claude API) que toma reservas 24/7.
- [ ] Lista de espera con notificación automática si se libera un slot.
- [ ] Programa de fidelidad / puntos.

---

## 9. Costos mensuales estimados (Fase 1 + 2)

| Servicio | Costo estimado | Notas |
|---|---|---|
| Supabase Free | $0 | Suficiente para <50K reservas/año |
| Resend | $0 | Hasta 3.000 emails/mes |
| Cloudflare DNS + CDN | $0 | Plan Free |
| WhatsApp Cloud API | ~$3–10 USD | 200–500 mensajes/mes |
| Dominio (ya tienes) | – | – |
| **Total** | **≈ $10 USD/mes** | Escala lineal con volumen |

Comparado con cualquier SaaS de reservas ($50–200 USD/mes), el ahorro paga el tiempo de desarrollo en 3–4 meses.

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Aprobación de plantillas WhatsApp demora | Lanzar Fase 1 sólo con email, añadir WhatsApp en Fase 2 |
| Staff no adopta el dashboard | Mantener WhatsApp manual como vía alternativa siempre. UX del admin debe imitar Excel: simple. |
| Bug de overlap deja mesas dobles | El trigger SQL es la red de seguridad — imposible que pase si está bien escrito. Tests automatizados antes de producción. |
| Dependencia de Supabase | Es Postgres puro; en cualquier momento se puede exportar y migrar a otro hosting. |
| Cliente da número WhatsApp falso | Validar formato + (opcional) enviar OTP de confirmación antes de marcar como confirmed |

---

## 11. Decisiones que necesito de ti antes de implementar

1. **¿Migrar el número actual (+57 300 826 3403) a WhatsApp Cloud API, o conseguir un número nuevo?** Migrar es más limpio pero deja el WhatsApp Business actual sin servicio durante la transición.
2. **¿Quiénes son los "usuarios staff" con acceso al admin?** ¿Sólo tú? ¿Maître? ¿Cocina? Define roles iniciales.
3. **¿Qué política de anticipos quieres para Fase 1?** El esquema soporta `deposit_amount` y `deposit_paid`, pero hay que decidir si Fase 1 ya integra pasarela de pago (PayU, Wompi) o se cobra en sede.
4. **¿Quieres que el admin muestre planos visuales de cada salón con mesas?** (Bonito pero +1 semana de trabajo.)
5. **¿Algún feriado o horario especial debe modelarse desde el inicio?** (Navidad, Día de la Madre, etc.)

---

## 12. Próximo paso concreto

Si decides arrancar, el orden es:

1. Creas la cuenta en Supabase (10 min).
2. Yo te genero las migraciones SQL completas listas para correr (~2h).
3. Yo te ayudo a poblar `salons` y `tables` con tus datos reales (~30 min).
4. Construimos `checkAvailability` y la probamos con datos dummy (~3h).
5. Construimos `createReservation` y un modal mínimo en el sitio para probar end-to-end (~6h).
6. Tomamos un descanso. Lanzamos Fase 1 en producción detrás de un feature flag (botón WhatsApp sigue siendo el principal hasta que valides).

**Estimado Fase 1 funcional:** 10–15 horas de trabajo distribuidas en 1–2 semanas.

---

*Documento vivo — se actualizará a medida que tomemos decisiones.*
