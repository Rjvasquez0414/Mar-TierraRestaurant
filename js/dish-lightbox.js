/* ===============================================
   DISH LIGHTBOX — la foto del plato en grande
   ===============================================
   Las fotos de la carta son verticales y grandes (2471x3742 la de
   Flor de Loto). El modal de plato las recorta con object-fit:cover
   a 378x252 en movil: se ve como un cuarto del plato.

   Este modulo hace tocable esa foto y la abre a pantalla completa
   sin recorte, reusando el PhotoSwipe 5 que ya carga la galeria.

   No toca js/script.js: el modal es HTML estatico y #modalDishImage
   persiste entre platos (openDishModal solo le reasigna el src), asi
   que basta con escuchar ese <img>.

   Aislado: quitar el <link> y el <script> de index.html revierte todo.
   =============================================== */

(function () {
    'use strict';

    var ANCHO_MAX = 1600;   // ancho que se le pide a Cloudinary
    var PLACEHOLDER = 'placeholder.jpg';

    var modal, img, wrap, visor = null;

    /* ---------- Cloudinary ----------
       Las URLs en menu-data.js vienen sin transformar, o sea que se
       descarga el original completo. Pedimos una version al ancho que
       de verdad se va a ver. c_limit evita agrandar las fotos que ya
       sean mas pequenas que ANCHO_MAX. */
    function optimizar(url) {
        if (!url || url.indexOf('res.cloudinary.com') === -1) return url;
        var partes = url.split('/upload/');
        if (partes.length !== 2) return url;
        // Si el primer segmento tras /upload/ no es la version (v1768570224),
        // ya hay transformaciones puestas y no las pisamos.
        if (!/^v\d+\//.test(partes[1])) return url;
        return partes[0] + '/upload/f_auto,q_auto,w_' + ANCHO_MAX + ',c_limit/' + partes[1];
    }

    /* ---------- Estado del plato actual ---------- */

    // El modal cae a images/placeholder.jpg cuando el plato no tiene
    // foto propia. Ampliar un placeholder no aporta nada.
    function tieneFoto() {
        var src = img && (img.currentSrc || img.src);
        return !!src && src.indexOf(PLACEHOLDER) === -1;
    }

    /* PhotoSwipe necesita las medidas para calcular el zoom. La imagen
       del modal ya esta cargada, asi que salen de ahi — sin datos nuevos
       que mantener en menu-data.js. Se escalan al ancho que pedimos a
       Cloudinary para que coincidan con el archivo que se descarga. */
    function medidas() {
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (!w || !h) return null;
        if (w > ANCHO_MAX) {
            h = Math.round(ANCHO_MAX * h / w);
            w = ANCHO_MAX;
        }
        return { w: w, h: h };
    }

    /* ---------- Abrir ---------- */

    function abrir() {
        if (!tieneFoto() || visor) return;
        if (typeof PhotoSwipe === 'undefined') {
            console.warn('[dish-lightbox] PhotoSwipe no esta cargado');
            return;
        }

        var m = medidas();
        if (!m) {
            // La foto todavia no termino de cargar: esperamos y reintentamos.
            if (img.decode) img.decode().then(abrir).catch(function () {});
            return;
        }

        var original = img.currentSrc || img.src;

        visor = new PhotoSwipe({
            dataSource: [{
                src: optimizar(original),
                msrc: original,          // se ve la del modal mientras carga la grande
                element: img,            // para que la animacion salga desde la foto
                width: m.w,
                height: m.h,
                alt: img.alt || ''
            }],
            index: 0,
            bgOpacity: 0.96,
            showHideAnimationType: 'zoom',
            zoom: true,
            counter: false,
            arrowPrev: false,
            arrowNext: false
        });

        visor.on('destroy', function () {
            visor = null;
            reponerBloqueoDeScroll();
        });

        visor.init();
    }

    /* ---------- El scroll de fondo ----------
       openDishModal() bloquea el scroll con body.overflow = hidden.
       PhotoSwipe lo gestiona por su cuenta y al cerrarse lo restaura,
       pisando el bloqueo del modal — que sigue abierto detras. Sin esto,
       la pagina de fondo se mueve debajo del modal. */
    function reponerBloqueoDeScroll() {
        if (modal && modal.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        }
    }

    /* ---------- Escape ----------
       script.js:844 cierra el modal de plato con Escape sin mirar si hay
       algo encima, asi que una sola pulsacion cerraba las dos capas. Lo
       atajamos en fase de captura: cerramos el visor nosotros y el evento
       no llega ni a PhotoSwipe ni a script.js. */
    function alPulsarEscape(e) {
        if (!visor || e.key !== 'Escape') return;
        e.stopPropagation();
        e.preventDefault();
        visor.close();
    }

    /* ---------- Afordancia ----------
       Sin esto nadie descubre que la foto se puede tocar. La clase la
       gobierna el estado real del plato: si no hay foto, no hay senal. */
    function marcar() {
        if (!wrap) return;
        var activo = modal.classList.contains('active') && tieneFoto();
        wrap.classList.toggle('dl-on', activo);
        if (activo) {
            wrap.setAttribute('role', 'button');
            wrap.setAttribute('tabindex', '0');
            wrap.setAttribute('aria-label', 'Ver la foto en grande');
        } else {
            wrap.removeAttribute('role');
            wrap.removeAttribute('tabindex');
            wrap.removeAttribute('aria-label');
        }
    }

    /* ---------- Init ---------- */

    function init() {
        modal = document.getElementById('dishModal');
        img = document.getElementById('modalDishImage');
        if (!modal || !img) return;
        wrap = img.closest('.dish-modal-image');
        if (!wrap) return;

        // El listener va en el contenedor, no en el <img>: encima de la foto
        // hay un .image-overlay (degradado + etiquetas) que se come los clics.
        // Escuchando aqui el evento llega por burbujeo caiga donde caiga, y de
        // paso toda la foto queda como area de toque — mejor en celular.
        wrap.addEventListener('click', function (e) {
            e.stopPropagation();
            abrir();
        });

        wrap.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            abrir();
        });

        document.addEventListener('keydown', alPulsarEscape, true);

        // openDishModal() asigna el src y despues agrega .active, asi que
        // para cuando cambia la clase la foto del plato ya esta puesta.
        new MutationObserver(marcar).observe(modal, {
            attributes: true,
            attributeFilter: ['class']
        });

        marcar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
