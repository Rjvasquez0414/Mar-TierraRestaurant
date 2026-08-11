/* ===============================================
   EVENTS DEMO — datos de prueba del Calendario
   ===============================================
   Permite ver la sección funcionando ANTES de aplicar
   sql/migration-017-events.sql en Supabase.

   ⚠ Solo se activa en vista previa local (localhost / 127.0.0.1 /
   archivo abierto directo) o con ?demo=eventos en la URL. En el
   dominio de producción NUNCA se usa, aunque el archivo se despliegue:
   ahí manda siempre Supabase, y si no hay eventos la sección se oculta.

   El shape es idéntico al que devuelve get_upcoming_events(), así que
   js/events.js no distingue el origen.
   =============================================== */

(function () {
    'use strict';

    var host = window.location.hostname;
    var esLocal = host === 'localhost' || host === '127.0.0.1' || host === '' || host === '::1';
    var forzado = /(?:^|[?&])demo=eventos(?:&|$)/.test(window.location.search);

    window.eventsDemoPermitido = esLocal || forzado;

    // Fechas relativas a hoy para que el demo no venza nunca
    function enDias(dias, hora, minuto) {
        var d = new Date();
        d.setDate(d.getDate() + dias);
        d.setHours(hora, minuto || 0, 0, 0);
        return d.toISOString();
    }

    window.eventsDemoData = [
        {
            id: 'demo-1',
            slug: 'demo-cata-malbec',
            title: 'Cata de Malbec',
            subtitle: 'Vertical de tres cosechas de Mendoza',
            description: 'Una noche dedicada a la uva insignia de Argentina. Recorremos tres cosechas de un mismo valle para entender cómo el tiempo cambia un vino. Cada copa se acompaña de un bocado del chef pensado para ese perfil. Cupo reducido: la conversación es parte de la cata.',
            starts_at: enDias(9, 19),
            ends_at: enDias(9, 22),
            salon_name: 'Golden',
            price_cop: 120000,
            capacity: 24,
            seats_taken: 16,
            seats_left: 8,
            sold_out: false,
            image_url: 'https://res.cloudinary.com/dxvl2i2fy/image/upload/f_auto,q_auto,w_1400,c_fill,g_auto/v1768570224/Flor_de_Loto_bfu9oq.jpg',
            highlight: true
        },
        {
            id: 'demo-2',
            slug: 'demo-jazz-ostras',
            title: 'Noche de Jazz & Ostras',
            subtitle: 'Trío en vivo sobre la terraza',
            description: 'Ostras frescas, coctelería de autor y un trío de jazz al aire libre. Sin menú fijo: la carta abierta y la música hasta el cierre.',
            starts_at: enDias(17, 20),
            ends_at: null,
            salon_name: 'Moon Terraza',
            price_cop: 95000,
            capacity: 40,
            seats_taken: 12,
            seats_left: 28,
            sold_out: false,
            image_url: 'https://res.cloudinary.com/dxvl2i2fy/image/upload/f_auto,q_auto,w_1000,c_fill,g_auto/v1768570221/Mare_oliva_xfhwiu.jpg',
            highlight: false
        },
        {
            id: 'demo-3',
            slug: 'demo-maridaje-autor',
            title: 'Maridaje de Autor',
            subtitle: 'Siete tiempos del chef, siete copas',
            description: 'El menú completo del chef servido en siete tiempos, cada uno con su vino elegido. La versión más larga y más personal de nuestra cocina.',
            starts_at: enDias(31, 19, 30),
            ends_at: null,
            salon_name: 'Arca',
            price_cop: 180000,
            capacity: 20,
            seats_taken: 20,
            seats_left: 0,
            sold_out: true,
            image_url: 'https://res.cloudinary.com/dxvl2i2fy/image/upload/f_auto,q_auto,w_1000,c_fill,g_auto/v1779924791/beef-wellington_kdrakv.jpg',
            highlight: false
        }
    ];
})();
