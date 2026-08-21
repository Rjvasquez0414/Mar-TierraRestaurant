/* ===============================================
   CALENDARIO — eventos del restaurante
   ===============================================
   Origen de datos: RPC get_upcoming_events() de Supabase.
   En vista previa local cae a js/events-demo.js (ver ese archivo).

   Criterio de diseño: si no hay eventos, o si la consulta falla, la
   sección y su enlace del nav se ocultan por completo. Un "proximamente
   no hay eventos" o un mensaje de error hacen ver el restaurante
   abandonado — peor que no tener la sección.
   =============================================== */

(function () {
    'use strict';

    var WA = '573015062669';
    var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
                 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    var MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                       'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

    var seccion, grid, destacado, modal;
    var eventos = [];

    function $(s, c) { return (c || document).querySelector(s); }

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------- Fechas (hora de Bogotá) ---------- */

    // El sitio puede abrirse desde cualquier zona horaria; las fechas de
    // un evento presencial siempre se leen en la hora del restaurante.
    function partesBogota(iso) {
        var d = new Date(iso);
        var f = new Intl.DateTimeFormat('es-CO', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: 'numeric', minute: 'numeric', hour12: false, weekday: 'short'
        }).formatToParts(d);
        var o = {};
        f.forEach(function (p) { o[p.type] = p.value; });
        return {
            dia: parseInt(o.day, 10),
            mes: parseInt(o.month, 10) - 1,
            anio: parseInt(o.year, 10),
            hora: parseInt(o.hour, 10) % 24,
            minuto: parseInt(o.minute, 10),
            diaSemana: new Date(
                Date.UTC(parseInt(o.year, 10), parseInt(o.month, 10) - 1, parseInt(o.day, 10))
            ).getUTCDay()
        };
    }

    function horaTexto(p) {
        var h = p.hora % 12; if (h === 0) h = 12;
        var m = p.minuto ? ':' + String(p.minuto).padStart(2, '0') : '';
        return h + m + ' ' + (p.hora >= 12 ? 'p.m.' : 'a.m.');
    }

    function precioTexto(cop) {
        if (cop == null) return '';
        return '$' + Number(cop).toLocaleString('es-CO');
    }

    // Los mensajes de WhatsApp del sitio van en ASCII limpio
    function sinTildes(t) {
        return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    /* ---------- Enlace de WhatsApp ----------
       Sin emojis ni tildes, siguiendo la convención del resto del sitio. */
    function enlaceWA(ev) {
        var p = partesBogota(ev.starts_at);
        var msg = 'Hola Mar&Tierra! Quiero reservar un cupo para el evento "' +
            sinTildes(ev.title) + '".' +
            '\n\n- Fecha: ' + p.dia + ' de ' + MESES_LARGO[p.mes] +
            '\n- Hora: ' + horaTexto(p).replace('.', '').replace('.', '') +
            '\n- Numero de personas: ' +
            '\n\nQuedo atento(a).';
        return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg);
    }

    /* ---------- Plantillas ---------- */

    function cupos(ev) {
        if (ev.capacity == null) return '';
        if (ev.sold_out) {
            return '<p class="ev-cupos ev-cupos--agotado">Cupos agotados</p>';
        }
        var pct = Math.min(100, Math.round((ev.seats_taken / ev.capacity) * 100));
        var quedan = ev.seats_left;
        return '<div class="ev-cupos">' +
               '<div class="ev-barra" role="img" aria-label="Quedan ' + quedan + ' de ' + ev.capacity + ' cupos">' +
               '<span style="width:' + pct + '%"></span></div>' +
               '<p class="ev-cupos-txt">Quedan <strong>' + quedan + '</strong> de ' + ev.capacity + ' cupos</p>' +
               '</div>';
    }

    function meta(ev) {
        var p = partesBogota(ev.starts_at);
        var partes = [horaTexto(p)];
        if (ev.salon_name) partes.push(esc(ev.salon_name));
        if (ev.price_cop != null) partes.push(precioTexto(ev.price_cop) + ' por persona');
        return partes.join('<span class="ev-sep">·</span>');
    }

    function cta(ev, clase) {
        if (ev.sold_out) {
            return '<span class="' + clase + ' ' + clase + '--off" aria-disabled="true">Agotado</span>';
        }
        return '<a class="' + clase + '" href="' + enlaceWA(ev) + '" target="_blank" rel="noopener"' +
               ' onclick="event.stopPropagation()">Reservar mi cupo <span aria-hidden="true">&rarr;</span></a>';
    }

    function plantillaDestacado(ev) {
        var p = partesBogota(ev.starts_at);
        return '<article class="ev-destacado' + (ev.sold_out ? ' is-agotado' : '') + '"' +
               ' data-slug="' + esc(ev.slug) + '" tabindex="0" role="button"' +
               ' aria-label="Ver detalle de ' + esc(ev.title) + '">' +
               (ev.image_url
                   ? '<div class="ev-destacado-foto"><img src="' + esc(ev.image_url) + '" alt="" loading="lazy" decoding="async"></div>'
                   : '') +
               '<div class="ev-destacado-cuerpo">' +
                   '<p class="ev-kicker">Próximo evento</p>' +
                   '<h3 class="ev-titulo">' + esc(ev.title) + '</h3>' +
                   (ev.subtitle ? '<p class="ev-subtitulo">' + esc(ev.subtitle) + '</p>' : '') +
                   '<div class="ev-regla"></div>' +
                   '<p class="ev-fecha-larga">' +
                       DIAS[p.diaSemana] + ' ' + p.dia + ' de ' + MESES_LARGO[p.mes] +
                   '</p>' +
                   '<p class="ev-meta">' + meta(ev) + '</p>' +
                   cupos(ev) +
                   cta(ev, 'ev-cta') +
               '</div>' +
               '</article>';
    }

    function plantillaEntrada(ev) {
        var p = partesBogota(ev.starts_at);
        return '<article class="ev-item' + (ev.sold_out ? ' is-agotado' : '') + '"' +
               ' data-slug="' + esc(ev.slug) + '" tabindex="0" role="button"' +
               ' aria-label="Ver detalle de ' + esc(ev.title) + '">' +
               '<div class="ev-fecha">' +
                   '<span class="ev-dia">' + String(p.dia).padStart(2, '0') + '</span>' +
                   '<span class="ev-mes">' + MESES[p.mes] + '</span>' +
               '</div>' +
               '<div class="ev-cuerpo">' +
                   '<h3 class="ev-titulo">' + esc(ev.title) + '</h3>' +
                   (ev.subtitle ? '<p class="ev-subtitulo">' + esc(ev.subtitle) + '</p>' : '') +
                   '<p class="ev-meta">' + meta(ev) + '</p>' +
                   cupos(ev) +
               '</div>' +
               (ev.image_url
                   ? '<div class="ev-mini"><img src="' + esc(ev.image_url) + '" alt="" loading="lazy" decoding="async"></div>'
                   : '') +
               '<span class="ev-flecha" aria-hidden="true">&rarr;</span>' +
               '</article>';
    }

    /* ---------- Modal de detalle ---------- */

    function abrirModal(slug, empujarHash) {
        var ev = eventos.filter(function (e) { return e.slug === slug; })[0];
        if (!ev) return;
        var p = partesBogota(ev.starts_at);

        modal.innerHTML =
            '<div class="ev-modal-fondo" data-cerrar></div>' +
            '<div class="ev-modal-caja" role="dialog" aria-modal="true" aria-label="' + esc(ev.title) + '">' +
                '<button type="button" class="ev-modal-x" data-cerrar aria-label="Cerrar">&times;</button>' +
                (ev.image_url
                    ? '<div class="ev-modal-foto"><img src="' + esc(ev.image_url) + '" alt="" decoding="async"></div>'
                    : '') +
                '<div class="ev-modal-cuerpo">' +
                    '<p class="ev-kicker">' + DIAS[p.diaSemana] + ' ' + p.dia + ' de ' + MESES_LARGO[p.mes] + '</p>' +
                    '<h3 class="ev-titulo">' + esc(ev.title) + '</h3>' +
                    (ev.subtitle ? '<p class="ev-subtitulo">' + esc(ev.subtitle) + '</p>' : '') +
                    '<div class="ev-regla"></div>' +
                    (ev.description ? '<p class="ev-modal-desc">' + esc(ev.description) + '</p>' : '') +
                    '<p class="ev-meta">' + meta(ev) + '</p>' +
                    cupos(ev) +
                    cta(ev, 'ev-cta') +
                '</div>' +
            '</div>';

        modal.classList.add('is-abierto');
        document.body.style.overflow = 'hidden';
        if (empujarHash) {
            history.pushState(null, '', '#evento-' + ev.slug);
        }
        var x = $('.ev-modal-x', modal);
        if (x) x.focus();
    }

    function cerrarModal(limpiarHash) {
        modal.classList.remove('is-abierto');
        modal.innerHTML = '';
        document.body.style.overflow = '';
        if (limpiarHash && /^#evento-/.test(window.location.hash)) {
            history.pushState(null, '', window.location.pathname + '#calendario');
        }
    }

    /* ---------- Render ---------- */

    // Se oculta con clase, no con style.display: showSection() resetea el
    // display inline de todas las secciones marketing al navegar, y eso
    // volvería a mostrar un calendario vacío.
    function ocultarSeccion() {
        if (seccion) seccion.classList.add('ev-sin-eventos');
        document.querySelectorAll('[data-nav-calendario]').forEach(function (n) {
            n.classList.add('ev-sin-eventos');
        });
    }

    function render() {
        if (!eventos.length) { ocultarSeccion(); return; }

        var dest = eventos.filter(function (e) { return e.highlight; })[0] || eventos[0];
        var resto = eventos.filter(function (e) { return e !== dest; });

        destacado.innerHTML = plantillaDestacado(dest);
        grid.innerHTML = resto.map(plantillaEntrada).join('');

        seccion.classList.add('is-listo');
        seccion.removeAttribute('aria-busy');

        // Deep-link: /#evento-<slug>
        var m = /^#evento-(.+)$/.exec(window.location.hash);
        if (m) {
            var slug = decodeURIComponent(m[1]);
            if (eventos.some(function (e) { return e.slug === slug; })) {
                seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
                abrirModal(slug, false);
            }
        }
    }

    /* ---------- Carga ---------- */

    function desdeSupabase() {
        if (typeof sb === 'undefined' || !sb || !sb.rpc) return Promise.reject(new Error('sin cliente supabase'));
        return sb.rpc('get_upcoming_events', { p_limit: 12 }).then(function (r) {
            if (r.error) throw r.error;
            return r.data || [];
        });
    }

    function cargar() {
        desdeSupabase()
            .then(function (filas) {
                eventos = filas;
                render();
            })
            .catch(function (err) {
                // Sin tabla todavía, o Supabase caído. En vista previa local
                // mostramos el demo; en producción la sección desaparece.
                if (window.eventsDemoPermitido && window.eventsDemoData) {
                    console.info('[calendario] usando datos de demostración —', err && err.message);
                    eventos = window.eventsDemoData;
                    render();
                } else {
                    console.warn('[calendario] sección oculta:', err && err.message);
                    ocultarSeccion();
                }
            });
    }

    /* ---------- Init ---------- */

    function init() {
        seccion = $('#calendario');
        if (!seccion) return;
        grid = $('.ev-lista', seccion);
        destacado = $('.ev-destacado-slot', seccion);
        modal = $('#ev-modal');
        if (!grid || !destacado || !modal) return;

        // Abrir detalle desde cualquier tarjeta
        seccion.addEventListener('click', function (e) {
            var card = e.target.closest('[data-slug]');
            if (card) abrirModal(card.getAttribute('data-slug'), true);
        });
        seccion.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var card = e.target.closest('[data-slug]');
            if (card) { e.preventDefault(); abrirModal(card.getAttribute('data-slug'), true); }
        });

        modal.addEventListener('click', function (e) {
            if (e.target.hasAttribute('data-cerrar')) cerrarModal(true);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('is-abierto')) cerrarModal(true);
        });
        window.addEventListener('popstate', function () {
            var m = /^#evento-(.+)$/.exec(window.location.hash);
            if (m) { abrirModal(decodeURIComponent(m[1]), false); }
            else if (modal.classList.contains('is-abierto')) { cerrarModal(false); }
        });

        cargar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
