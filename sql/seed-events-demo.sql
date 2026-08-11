-- =====================================================================
-- SEED DEMO — eventos de prueba para el módulo Calendario
-- =====================================================================
-- ⚠  DATOS DE PRUEBA. Edítalos o bórralos antes de que el sitio nuevo
--    salga a producción. Para borrarlos todos:
--
--      DELETE FROM events WHERE slug LIKE 'demo-%';
--
-- Las fechas son relativas a hoy, así que el seed nunca queda vencido
-- por más que tardes en aplicarlo.
-- =====================================================================

INSERT INTO events (slug, title, subtitle, description, starts_at, ends_at,
                    salon_id, price_cop, capacity, seats_taken,
                    image_url, status, highlight)
VALUES
(
    'demo-cata-malbec',
    'Cata de Malbec',
    'Vertical de tres cosechas de Mendoza',
    'Una noche dedicada a la uva insignia de Argentina. Recorremos tres cosechas de un mismo valle para entender cómo el tiempo cambia un vino. Cada copa se acompaña de un bocado del chef pensado para ese perfil. Cupo reducido: la conversación es parte de la cata.',
    (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '9 days' + interval '19 hours') AT TIME ZONE 'America/Bogota',
    (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '9 days' + interval '22 hours') AT TIME ZONE 'America/Bogota',
    (SELECT id FROM salons WHERE slug = 'salon-vip' OR name ILIKE '%golden%' ORDER BY name LIMIT 1),
    120000, 24, 16,
    'https://res.cloudinary.com/dxvl2i2fy/image/upload/f_auto,q_auto,w_1400,c_fill,g_auto/v1768570224/Flor_de_Loto_bfu9oq.jpg',
    'published', true
),
(
    'demo-jazz-ostras',
    'Noche de Jazz & Ostras',
    'Trío en vivo sobre la terraza',
    'Ostras frescas, coctelería de autor y un trío de jazz al aire libre. Sin menú fijo: la carta abierta y la música hasta el cierre.',
    (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '17 days' + interval '20 hours') AT TIME ZONE 'America/Bogota',
    NULL,
    (SELECT id FROM salons WHERE name ILIKE '%moon%' LIMIT 1),
    95000, 40, 12,
    'https://res.cloudinary.com/dxvl2i2fy/image/upload/f_auto,q_auto,w_1000,c_fill,g_auto/v1768570221/Mare_oliva_xfhwiu.jpg',
    'published', false
),
(
    'demo-maridaje-autor',
    'Maridaje de Autor',
    'Siete tiempos del chef, siete copas',
    'El menú completo del chef servido en siete tiempos, cada uno con su vino elegido. La versión más larga y más personal de nuestra cocina.',
    (date_trunc('day', now() AT TIME ZONE 'America/Bogota') + interval '31 days' + interval '19 hours' + interval '30 minutes') AT TIME ZONE 'America/Bogota',
    NULL,
    (SELECT id FROM salons WHERE name ILIKE '%arca%' LIMIT 1),
    180000, 20, 20,   -- agotado a propósito, para ver ese estado
    'https://res.cloudinary.com/dxvl2i2fy/image/upload/f_auto,q_auto,w_1000,c_fill,g_auto/v1779924791/beef-wellington_kdrakv.jpg',
    'published', false
)
ON CONFLICT (slug) DO NOTHING;
