/* ===============================================
   HERO CINEMA — rotacion del carrusel editorial
   ===============================================
   El slide 1 viene con src real en el HTML (es el LCP).
   Los demas traen data-src y se cargan despues del load
   para no competir con la primera pintura.

   Sin dependencias. Si el JS falla, queda el slide 1 fijo.
   =============================================== */

(function () {
    'use strict';

    var DURACION = 7600;      // ms visibles por slide (coincide con --hc-dur)
    var hero, stage, slides, ticks, cap, capKicker, capTitle;
    var indice = 0;
    var timer = null;
    var pausado = false;
    var reduce = false;

    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

    /* ---------- Carga diferida de los slides 2..n ---------- */

    /* Atributo propio (data-hc-src, no data-src): enhancements.js,
       instalaciones.js y script.js ya reclaman img[data-src] y le
       reasignaban src cuando este modulo ya habia limpiado el atributo,
       dejando la imagen apuntando a "/undefined". */
    /* Un slide puede traer mas de una capa (plato + fondo desenfocado) */
    function activar(slide) {
        if (!slide) return;
        $$('img[data-hc-src]', slide).forEach(function (img) {
            img.src = img.getAttribute('data-hc-src');
            img.removeAttribute('data-hc-src');
        });
    }

    function cargarRestantes() {
        slides.forEach(function (slide, i) {
            if (i === 0) return;
            activar(slide);
        });
    }

    /* ---------- Pintado ---------- */

    function pintarCaption(slide) {
        var kicker = slide.getAttribute('data-kicker') || '';
        var titulo = slide.getAttribute('data-title') || '';

        // Si el caption no cambia, no lo parpadeamos
        if (capTitle.textContent === titulo) return;

        cap.classList.add('is-swapping');
        window.setTimeout(function () {
            capKicker.textContent = kicker;
            capTitle.textContent = titulo;
            cap.classList.remove('is-swapping');
        }, 320);
    }

    /* Las fotos de plato son oscuras y las de salon claras: el velo
       de legibilidad se ajusta al slide para no aplastar la imagen. */
    function aplicarTono(slide) {
        hero.setAttribute('data-tone', slide.getAttribute('data-tone') || 'light');
    }

    function mostrar(nuevo) {
        if (nuevo === indice) return;

        slides[indice].classList.remove('is-active');
        ticks[indice].classList.remove('is-active');
        ticks[indice].classList.add('is-done');

        indice = nuevo;

        // Reiniciamos la animacion de relleno del tick
        var tick = ticks[indice];
        tick.classList.remove('is-done');
        // forzar reflow para que la animacion vuelva a correr
        void tick.offsetWidth;
        tick.classList.add('is-active');

        slides[indice].classList.add('is-active');
        aplicarTono(slides[indice]);
        pintarCaption(slides[indice]);

        // El siguiente en la fila se precarga si aun no tiene src
        activar(slides[(indice + 1) % slides.length]);
    }

    function avanzar() {
        mostrar((indice + 1) % slides.length);
    }

    /* ---------- Reloj ---------- */

    function arrancar() {
        if (reduce || pausado || slides.length < 2) return;
        detener();
        timer = window.setInterval(avanzar, DURACION);
    }

    function detener() {
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
    }

    /* ---------- Init ---------- */

    function init() {
        hero = $('.hero');
        stage = $('.hero-stage');
        if (!hero || !stage) return;

        slides = $$('.hero-slide', stage);
        cap = $('.hero-cap');
        ticks = $$('.hero-tick');

        if (!slides.length || !cap || !ticks.length) return;

        capKicker = $('.hero-cap-kicker', cap);
        capTitle = $('.hero-cap-title', cap);
        if (!capKicker || !capTitle) return;

        var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        reduce = mq.matches;
        if (mq.addEventListener) {
            mq.addEventListener('change', function (e) {
                reduce = e.matches;
                if (reduce) { detener(); } else { arrancar(); }
            });
        }

        // Estado inicial
        slides[0].classList.add('is-active');
        ticks[0].classList.add('is-active');
        aplicarTono(slides[0]);
        capKicker.textContent = slides[0].getAttribute('data-kicker') || '';
        capTitle.textContent = slides[0].getAttribute('data-title') || '';

        // Navegacion manual
        ticks.forEach(function (tick, i) {
            tick.addEventListener('click', function () {
                mostrar(i);
                arrancar(); // reinicia el conteo desde el slide elegido
            });
        });

        // Pausa al pasar el mouse por el rail (el CSS pausa la barra,
        // aca pausamos el avance real para que coincidan)
        var rail = $('.hero-rail');
        if (rail) {
            rail.addEventListener('mouseenter', function () { pausado = true; detener(); });
            rail.addEventListener('mouseleave', function () { pausado = false; arrancar(); });
        }

        // No gastar ciclos ni datos con la pestana en segundo plano
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { detener(); } else { arrancar(); }
        });

        // Ni cuando el hero ya no esta en pantalla
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entradas) {
                entradas.forEach(function (e) {
                    if (e.isIntersecting) { arrancar(); } else { detener(); }
                });
            }, { threshold: 0.12 }).observe(stage);
        }

        // Las imagenes pesadas entran cuando la pagina ya cargo
        var diferir = function () {
            if (window.requestIdleCallback) {
                window.requestIdleCallback(cargarRestantes, { timeout: 2200 });
            } else {
                window.setTimeout(cargarRestantes, 900);
            }
        };

        if (document.readyState === 'complete') {
            diferir();
        } else {
            window.addEventListener('load', diferir, { once: true });
        }

        arrancar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
