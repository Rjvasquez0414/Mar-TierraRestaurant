-- =====================================================================
-- SEED — Dar rol de admin + nombre a los 2 hosts (Felipe y Deivis)
-- =====================================================================
-- REQUISITOS PREVIOS:
--   1. Haber corrido migration-010-monitoring.sql (agrega staff_roles.name).
--   2. Haber creado los usuarios en Supabase → Authentication → Users → Add user:
--        - felipemartierra@gmail.com  (con su contraseña)
--        - deivismartierra@gmail.com  (con su contraseña)
--
-- Este script SOLO les asigna el rol y el nombre. No crea las cuentas de login
-- (eso se hace en el panel de Supabase, paso 2 de arriba).
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================

INSERT INTO staff_roles (user_id, role, name)
SELECT id, 'admin', 'Felipe' FROM auth.users WHERE email = 'felipemartierra@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', name = 'Felipe';

INSERT INTO staff_roles (user_id, role, name)
SELECT id, 'admin', 'Deivis' FROM auth.users WHERE email = 'deivismartierra@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', name = 'Deivis';

-- Verificación: debe listar Felipe, Deivis y el Administrador existente
SELECT sr.name, sr.role, u.email
FROM staff_roles sr
JOIN auth.users u ON u.id = sr.user_id
ORDER BY sr.name;
