-- =====================================================================
-- Migration 005 — Actualizar precio del Plan Luxury a $150.000
-- =====================================================================
-- Contexto: el anticipo cobrado lo determina el servidor leyendo la
-- tabla `pricing` dentro de la RPC create_reservation (ver migration-001
-- y migration-002). El frontend solo MUESTRA el precio; el valor real
-- que queda guardado en la reserva proviene de esta tabla.
--
-- Por eso, cambiar el precio en el frontend NO es suficiente: hay que
-- actualizar aquí o el resumen de confirmación seguirá mostrando $100.000.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================

UPDATE pricing
SET deposit_amount = 150000
WHERE reservation_type = 'luxury';

-- Verificación (debe devolver 150000, is_consumable = false)
SELECT reservation_type, deposit_amount, is_consumable
FROM pricing
WHERE reservation_type = 'luxury';
