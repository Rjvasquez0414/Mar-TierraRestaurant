-- =====================================================================
-- LIMPIEZA PRE-PRODUCCIÓN — borrar SOLO datos de prueba
-- =====================================================================
-- Conserva las 7 reservas/clientes que parecen REALES:
--   Andres Martinez, Raul Andres Beltran, Nicolas Antonio, Diana Lineth pino,
--   Fabián Díaz guerrero, Yuliana Herrera, Andrés felipe navas.
--
-- Borra los 8 teléfonos de PRUEBA (QA / tests / tus propias pruebas / Sharikd):
--   3009999999  QA MONITOR
--   3001112233  VALIDACION FINAL
--   3001234567  Test E2E
--   3009876543  Test Valet
--   3107654321  Test Advisory Lock
--   3014235498  Roberto Jose Vasquez Davila (tus pruebas)
--   3215530423  Sharikd Esteban
--   573215530423 Sharikd
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- REVISA la lista de teléfonos antes de ejecutar.
-- =====================================================================

BEGIN;

-- 1) Reservas de los clientes de prueba (borra en cascada sus logs)
DELETE FROM reservations
WHERE customer_id IN (
  SELECT id FROM customers WHERE phone IN (
    '3009999999','3001112233','3001234567','3009876543',
    '3107654321','3014235498','3215530423','573215530423'
  )
);

-- 2) Los clientes de prueba
DELETE FROM customers WHERE phone IN (
  '3009999999','3001112233','3001234567','3009876543',
  '3107654321','3014235498','3215530423','573215530423'
);

-- 3) Log huérfano que dejé en el QA de integridad (acción de prueba)
DELETE FROM reservation_logs WHERE reservation_id IS NULL AND action = 'test_propio';

-- 4) (Opcional) Limpiar historial de accesos de prueba — se regenera en cada login
DELETE FROM access_logs;

-- Verificación: deben quedar 7 reservas reales y 7 clientes
SELECT
  (SELECT count(*) FROM reservations) AS reservas_restantes,
  (SELECT count(*) FROM customers)    AS clientes_restantes;

COMMIT;

-- Listado de control (debe mostrar solo las 7 reales)
SELECT r.reservation_code, r.status, c.name
FROM reservations r JOIN customers c ON c.id = r.customer_id
ORDER BY r.reservation_code;
