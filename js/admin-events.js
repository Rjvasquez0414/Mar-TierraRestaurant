/* ===============================================
   ADMIN — Eventos (Calendario)
   ===============================================
   CRUD sobre la tabla `events`. Va en su propio archivo y no dentro de
   admin.js (2.100+ líneas) para que la vista sea legible y aislable.

   Acceso: RLS `events_staff_only` — la sesión autenticada del panel es
   la que autoriza. Sin RPCs admin_* a diferencia de las reservas: aquí
   no hay concurrencia que proteger (dos administradores editando la
   misma cata no es un escenario real).
   =============================================== */

(function () {
    'use strict';

    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    var lista, modal, salones = [];
    var editandoId = null;

    function $(id) { return document.getElementById(id); }

    function esc(t) {
        return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------- Fechas en hora de Bogotá ----------
       El navegador del staff puede estar en otra zona; la fecha de un
       evento presencial siempre se captura y se muestra en hora local
       del restaurante. */

    function partesBogota(iso) {
        var f = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Bogota',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false
        }).formatToParts(new Date(iso));
        var o = {};
        f.forEach(function (p) { o[p.type] = p.value; });
        return {
            fecha: o.year + '-' + o.month + '-' + o.day,
            hora: (o.hour === '24' ? '00' : o.hour) + ':' + o.minute,
            dia: parseInt(o.day, 10),
            mes: parseInt(o.month, 10) - 1,
            anio: parseInt(o.year, 10)
        };
    }

    // Bogotá es UTC-5 todo el año (sin horario de verano), así que la
    // conversión a UTC es un desplazamiento fijo.
    function aISO(fecha, hora) {
        if (!fecha || !hora) return null;
        return new Date(fecha + 'T' + hora + ':00-05:00').toISOString();
    }

    function fechaCorta(iso) {
        var p = partesBogota(iso);
        return p.dia + ' ' + MESES[p.mes] + ' ' + p.anio + ' · ' + p.hora;
    }

    function money(v) {
        return v == null ? '—' : '$' + Number(v).toLocaleString('es-CO');
    }

    function slugify(t) {
        return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '').slice(0, 80);
    }

    /* ---------- Datos ---------- */

    function cargarSalones() {
        return sb.from('salons').select('id,name').order('name').then(function (r) {
            salones = r.data || [];
            var sel = $('ev-f-salon');
            if (!sel) return;
            sel.innerHTML = '<option value="">Sin salón definido</option>' +
                salones.map(function (s) {
                    return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
                }).join('');
        });
    }

    function cargar() {
        var verTodo = $('ev-ver-pasados') && $('ev-ver-pasados').checked;
        var q = sb.from('events')
            .select('*, salons(name)')
            .order('starts_at', { ascending: true });

        if (!verTodo) {
            q = q.gte('starts_at', new Date(Date.now() - 86400000).toISOString())
                 .neq('status', 'archived');
        }

        lista.innerHTML = '<p class="adm-ev-vacio">Cargando…</p>';

        return q.then(function (r) {
            if (r.error) throw r.error;
            pintar(r.data || []);
        }).catch(function (e) {
            // Antes de aplicar migration-017 la tabla no existe: se dice
            // explícitamente en vez de dejar un "cargando" eterno.
            var falta = /relation .*events.* does not exist|schema cache/i.test(e.message || '');
            lista.innerHTML = '<p class="adm-ev-vacio">' +
                (falta
                    ? 'La tabla <code>events</code> todavía no existe. Aplica <code>sql/migration-017-events.sql</code> en Supabase.'
                    : 'No se pudieron cargar los eventos: ' + esc(e.message || 'error desconocido')) +
                '</p>';
        });
    }

    function pintar(filas) {
        if (!filas.length) {
            lista.innerHTML = '<p class="adm-ev-vacio">No hay eventos. Crea el primero con “Nuevo evento”.</p>';
            return;
        }

        lista.innerHTML = filas.map(function (e) {
            var cupos = e.capacity == null
                ? '<span class="adm-ev-dim">sin límite</span>'
                : e.seats_taken + ' / ' + e.capacity +
                  (e.seats_taken >= e.capacity ? ' <strong class="adm-ev-lleno">lleno</strong>' : '');

            var badge = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }[e.status] || e.status;

            return '<div class="adm-ev-row" data-id="' + e.id + '">' +
                '<div class="adm-ev-cuando">' + fechaCorta(e.starts_at) + '</div>' +
                '<div class="adm-ev-main">' +
                    '<strong>' + esc(e.title) + '</strong>' +
                    (e.highlight ? ' <span class="adm-ev-star" title="Destacado">★</span>' : '') +
                    '<div class="adm-ev-sub">' +
                        (e.salons && e.salons.name ? esc(e.salons.name) + ' · ' : '') +
                        money(e.price_cop) + ' · cupos ' + cupos +
                    '</div>' +
                '</div>' +
                '<span class="adm-ev-estado adm-ev-estado--' + esc(e.status) + '">' + badge + '</span>' +
                '<div class="adm-ev-acciones">' +
                    '<button type="button" class="adm-btn adm-btn-sm" data-ev-editar="' + e.id + '">Editar</button>' +
                    (e.status === 'published'
                        ? '<button type="button" class="adm-btn adm-btn-sm adm-btn-warn" data-ev-estado="' + e.id + '" data-a="draft">Ocultar</button>'
                        : '<button type="button" class="adm-btn adm-btn-sm adm-btn-confirm" data-ev-estado="' + e.id + '" data-a="published">Publicar</button>') +
                    '<button type="button" class="adm-btn adm-btn-sm adm-btn-ghost" data-ev-borrar="' + e.id + '">Eliminar</button>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    /* ---------- Formulario ---------- */

    function abrir(ev) {
        editandoId = ev ? ev.id : null;
        $('ev-modal-titulo').textContent = ev ? 'Editar evento' : 'Nuevo evento';
        $('ev-error').textContent = '';

        var p = ev ? partesBogota(ev.starts_at) : null;
        var pf = ev && ev.ends_at ? partesBogota(ev.ends_at) : null;

        $('ev-f-title').value       = ev ? (ev.title || '') : '';
        $('ev-f-slug').value        = ev ? (ev.slug || '') : '';
        $('ev-f-subtitle').value    = ev ? (ev.subtitle || '') : '';
        $('ev-f-description').value = ev ? (ev.description || '') : '';
        $('ev-f-date').value        = p ? p.fecha : '';
        $('ev-f-start').value       = p ? p.hora : '';
        $('ev-f-end').value         = pf ? pf.hora : '';
        $('ev-f-salon').value       = ev ? (ev.salon_id || '') : '';
        $('ev-f-price').value       = ev && ev.price_cop != null ? ev.price_cop : '';
        $('ev-f-capacity').value    = ev && ev.capacity != null ? ev.capacity : '';
        $('ev-f-taken').value       = ev ? (ev.seats_taken || 0) : 0;
        $('ev-f-status').value      = ev ? ev.status : 'draft';
        $('ev-f-image').value       = ev ? (ev.image_url || '') : '';
        $('ev-f-highlight').checked = ev ? !!ev.highlight : false;

        modal.style.display = 'flex';
    }

    function cerrar() {
        modal.style.display = 'none';
        editandoId = null;
    }

    function guardar() {
        var err = $('ev-error');
        err.textContent = '';

        var title = $('ev-f-title').value.trim();
        var slug  = $('ev-f-slug').value.trim() || slugify(title);
        var fecha = $('ev-f-date').value;
        var hIni  = $('ev-f-start').value;
        var hFin  = $('ev-f-end').value;

        if (!title)        { err.textContent = 'El título es obligatorio.'; return; }
        if (!fecha || !hIni) { err.textContent = 'La fecha y la hora de inicio son obligatorias.'; return; }
        if (!slug)         { err.textContent = 'El enlace (slug) es obligatorio.'; return; }

        var cap   = $('ev-f-capacity').value === '' ? null : parseInt($('ev-f-capacity').value, 10);
        var taken = parseInt($('ev-f-taken').value, 10) || 0;
        if (cap != null && taken > cap) {
            err.textContent = 'Los cupos vendidos no pueden superar los cupos totales.';
            return;
        }

        var inicio = aISO(fecha, hIni);
        var fin    = hFin ? aISO(fecha, hFin) : null;
        if (fin && new Date(fin) <= new Date(inicio)) {
            err.textContent = 'La hora de fin debe ser posterior a la de inicio.';
            return;
        }

        var fila = {
            slug: slug,
            title: title,
            subtitle: $('ev-f-subtitle').value.trim() || null,
            description: $('ev-f-description').value.trim() || null,
            starts_at: inicio,
            ends_at: fin,
            salon_id: $('ev-f-salon').value || null,
            price_cop: $('ev-f-price').value === '' ? null : parseInt($('ev-f-price').value, 10),
            capacity: cap,
            seats_taken: taken,
            image_url: $('ev-f-image').value.trim() || null,
            status: $('ev-f-status').value,
            highlight: $('ev-f-highlight').checked
        };

        var btn = $('ev-guardar');
        btn.disabled = true;
        btn.textContent = 'Guardando…';

        var op = editandoId
            ? sb.from('events').update(fila).eq('id', editandoId)
            : sb.from('events').insert(fila);

        op.then(function (r) {
            if (r.error) throw r.error;
            // Destacado excluyente: solo un evento a la vez en el sitio
            if (fila.highlight) {
                var q = sb.from('events').update({ highlight: false }).eq('highlight', true);
                if (editandoId) q = q.neq('id', editandoId);
                else q = q.neq('slug', fila.slug);
                return q;
            }
        }).then(function () {
            cerrar();
            return cargar();
        }).catch(function (e) {
            var dup = /duplicate key|unique constraint/i.test(e.message || '');
            err.textContent = dup
                ? 'Ya existe un evento con ese enlace (slug). Usa otro.'
                : 'No se pudo guardar: ' + (e.message || 'error desconocido');
        }).then(function () {
            btn.disabled = false;
            btn.textContent = 'Guardar evento';
        });
    }

    /* ---------- Acciones de fila ---------- */

    function cambiarEstado(id, estado) {
        sb.from('events').update({ status: estado }).eq('id', id).then(function (r) {
            if (r.error) { alert('No se pudo actualizar: ' + r.error.message); return; }
            cargar();
        });
    }

    function borrar(id) {
        sb.from('events').select('title').eq('id', id).single().then(function (r) {
            var nombre = r.data ? r.data.title : 'este evento';
            if (!confirm('¿Eliminar "' + nombre + '"? Esta acción no se puede deshacer.\n\n' +
                         'Si solo quieres quitarlo del sitio, usa "Ocultar".')) return;
            return sb.from('events').delete().eq('id', id).then(function (d) {
                if (d.error) { alert('No se pudo eliminar: ' + d.error.message); return; }
                cargar();
            });
        });
    }

    function editar(id) {
        sb.from('events').select('*').eq('id', id).single().then(function (r) {
            if (r.error) { alert('No se pudo cargar el evento: ' + r.error.message); return; }
            abrir(r.data);
        });
    }

    /* ---------- Init ---------- */

    function init() {
        lista = $('ev-lista');
        modal = $('ev-modal-admin');
        if (!lista || !modal) return;

        $('ev-nuevo').addEventListener('click', function () { abrir(null); });
        $('ev-cerrar').addEventListener('click', cerrar);
        $('ev-guardar').addEventListener('click', guardar);
        modal.addEventListener('click', function (e) { if (e.target === modal) cerrar(); });

        // Slug sugerido desde el título, sin pisar lo que el staff escriba
        $('ev-f-title').addEventListener('input', function () {
            if (!editandoId && !$('ev-f-slug').dataset.tocado) {
                $('ev-f-slug').value = slugify(this.value);
            }
        });
        $('ev-f-slug').addEventListener('input', function () { this.dataset.tocado = '1'; });

        var chk = $('ev-ver-pasados');
        if (chk) chk.addEventListener('change', cargar);

        lista.addEventListener('click', function (e) {
            var b = e.target.closest('[data-ev-editar],[data-ev-estado],[data-ev-borrar]');
            if (!b) return;
            if (b.hasAttribute('data-ev-editar')) editar(b.getAttribute('data-ev-editar'));
            else if (b.hasAttribute('data-ev-estado')) cambiarEstado(b.getAttribute('data-ev-estado'), b.getAttribute('data-a'));
            else borrar(b.getAttribute('data-ev-borrar'));
        });

        // La vista se carga la primera vez que se abre su pestaña
        var cargada = false;
        document.querySelectorAll('.adm-tab[data-view="eventos"]').forEach(function (t) {
            t.addEventListener('click', function () {
                if (cargada) return;
                cargada = true;
                cargarSalones().then(cargar).catch(cargar);
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
