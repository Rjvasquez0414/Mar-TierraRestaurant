-- =====================================================================
-- MIGRATION 011 — Integridad del registro de auditoría (monitoreo)
-- =====================================================================
-- Hallazgo (confirmado en vivo): la política de reservation_logs era
--   FOR ALL USING (EXISTS staff_roles...)
-- Una política FOR ALL sin WITH CHECK reusa el USING como WITH CHECK en los
-- INSERT, y solo validaba "¿eres staff?", NO "¿performed_by eres tú?". Por eso
-- un host (Felipe) podía registrar un log a nombre de OTRO (Deivis), y además
-- podía EDITAR/BORRAR cualquier log → se podía falsificar o borrar evidencia
-- del monitoreo. Eso rompe el objetivo de "quién hace qué".
--
-- Fix: separar en SELECT (cualquier staff lee) + INSERT (staff, y SOLO con su
-- propia identidad). Sin políticas UPDATE/DELETE → los logs quedan INMUTABLES.
-- Las RPC SECURITY DEFINER (created/customer_*/expired/slot_*) insertan con
-- performed_by NULL y bypassean RLS (owner postgres), así que NO se afectan.
--
-- Correr en: Supabase → SQL Editor (proyecto ocynnsdxzdoudqpqpgje)
-- =====================================================================

-- Quitar la política permisiva anterior (ambos nombres por si acaso)
DROP POLICY IF EXISTS "logs_staff_only" ON reservation_logs;
DROP POLICY IF EXISTS "logs_admin_all" ON reservation_logs;

-- Lectura: cualquier miembro del staff
CREATE POLICY "logs_staff_read" ON reservation_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );

-- Inserción: solo staff, y obligatoriamente con SU PROPIA identidad
-- (no se puede registrar a nombre de otro host)
CREATE POLICY "logs_staff_insert" ON reservation_logs
    FOR INSERT WITH CHECK (
        performed_by = auth.uid()
        AND EXISTS (SELECT 1 FROM staff_roles sr WHERE sr.user_id = auth.uid())
    );

-- (Intencional) NO se crean políticas UPDATE ni DELETE: los registros de
-- auditoría son inmutables para el staff. La limpieza/mantenimiento se hace
-- desde el SQL Editor (service role), que bypassa RLS.

-- Verificación rápida: las políticas vigentes deben ser logs_staff_read y
-- logs_staff_insert (y ninguna FOR ALL).
-- SELECT polname, cmd FROM pg_policies WHERE tablename = 'reservation_logs';
